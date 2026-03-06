import traceback
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from app.orchestra.crew import run_trend_analysis
from app.models.domain import TrendingCache
from sqlalchemy.orm import Session

from app.models.schemas import ResortTelemetry
from app.models.domain import Resort, ResortTelemetryCache
from app.database import get_db
from app.orchestra.agents.telemetry_officer import gather_resort_telemetry, fetch_official_skimap, generate_resort_profile

router = APIRouter(tags=["Telemetry"])

@router.get("/resorts/{resort_id}/profile")
def get_or_generate_resort_profile(resort_id: int, force: bool = False, db: Session = Depends(get_db)):
    resort = db.query(Resort).filter(Resort.id == resort_id).first()
    if not resort:
        raise HTTPException(status_code=404, detail="Resort not found.")

    # Return existing profile if it exists and we aren't forcing a refresh
    if not force and resort.description_overview:
        return {
            "overview": resort.description_overview,
            "slopes": resort.description_slopes,
            "atmosphere": resort.description_atmosphere,
            "official_url": resort.official_website_url
        }

    # Generate new profile
    profile_data = generate_resort_profile(resort.name)
    
    if not profile_data:
        raise HTTPException(status_code=500, detail="Failed to compile briefing.")

    # Save permanently to DB
    resort.description_overview = profile_data["overview"]
    resort.description_slopes = profile_data["slopes"]
    resort.description_atmosphere = profile_data["atmosphere"]
    resort.official_website_url = profile_data["official_url"]
    
    db.commit()
    
    return profile_data

def get_current_winter_season_start() -> datetime:
    """
    Dynamically calculates the start of the current winter season (Assumed November 1st).
    E.g., In March 2026, the season started Nov 1, 2025. 
    In Dec 2026, the season started Nov 1, 2026.
    """
    now = datetime.now(timezone.utc)
    start_year = now.year if now.month >= 11 else now.year - 1
    return datetime(start_year, 11, 1, tzinfo=timezone.utc)

@router.get("/resorts/{resort_slug}/telemetry", response_model=ResortTelemetry)
async def get_resort_telemetry(resort_slug: str, db: Session = Depends(get_db)):
    resort_record = db.query(Resort).filter(Resort.name.ilike(f"%{resort_slug}%")).first()
    
    if not resort_record:
        raise HTTPException(status_code=403, detail="ACCESS DENIED.")
        
    target_resort = resort_record.name
    now = datetime.now(timezone.utc)

    try:
        # ==========================================
        # STEP 1: DYNAMIC SEASONAL MAP CHECK
        # ==========================================
        season_start = get_current_winter_season_start()
        map_needs_update = True
        
        if resort_record.official_ski_map_url and resort_record.ski_map_updated_at:
            # Ensure the DB timestamp is timezone-aware for comparison
            updated_at = resort_record.ski_map_updated_at
            if updated_at.tzinfo is None:
                updated_at = updated_at.replace(tzinfo=timezone.utc)
                
            if updated_at >= season_start:
                map_needs_update = False

        if map_needs_update:
            print(f"🗺️ [DB] Ski map for {target_resort} is missing or stale. Fetching fresh map...")
            new_map_url = fetch_official_skimap(target_resort)
            
            # Save it to the database so we don't fetch it again this season
            if new_map_url:
                resort_record.official_ski_map_url = new_map_url
            resort_record.ski_map_updated_at = now
            db.commit()


        # ==========================================
        # STEP 2: DAILY WEATHER/SNOW CACHE CHECK
        # ==========================================
        cached_record = db.query(ResortTelemetryCache).filter(ResortTelemetryCache.resort_name == target_resort).first()
        
        if cached_record and cached_record.updated_at:
            updated_time = cached_record.updated_at
            if updated_time.tzinfo is None:
                updated_time = updated_time.replace(tzinfo=timezone.utc)
                
            age_in_hours = (now - updated_time).total_seconds() / 3600
            
            if age_in_hours < 24.0:
                payload = cached_record.telemetry_data
                payload["source_urls"] = cached_record.source_urls
                payload["last_updated"] = updated_time.isoformat()
                
                # INJECT THE MAP FROM THE DB
                payload["official_ski_map_url"] = resort_record.official_ski_map_url
                return ResortTelemetry(**payload)

        # Cache Miss: Scrape new weather
        telemetry_data = gather_resort_telemetry(target_resort)
        source_urls = telemetry_data.pop("source_urls", [])

        if cached_record:
            cached_record.telemetry_data = telemetry_data
            cached_record.source_urls = source_urls
        else:
            new_record = ResortTelemetryCache(
                resort_name=target_resort,
                telemetry_data=telemetry_data,
                source_urls=source_urls
            )
            db.add(new_record)
            
        db.commit()

        telemetry_data["source_urls"] = source_urls
        telemetry_data["last_updated"] = now.isoformat()
        
        # INJECT THE MAP FROM THE DB
        telemetry_data["official_ski_map_url"] = resort_record.official_ski_map_url

        return ResortTelemetry(**telemetry_data)
        
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to establish uplink.")
    
@router.get("/telemetry/trending")
def get_trending_resorts(force: bool = Query(False), db: Session = Depends(get_db)):
    """
    Fetches the top 3 trending resorts. 
    Uses a 12-hour database cache to save LLM tokens unless 'force=true' is passed.
    """
    now = datetime.now(timezone.utc)
    cache_record = db.query(TrendingCache).first()

    # --- 1. CHECK CACHE ---
    if cache_record and not force:
        updated_time = cache_record.updated_at
        if updated_time.tzinfo is None:
            updated_time = updated_time.replace(tzinfo=timezone.utc)
            
        age_in_hours = (now - updated_time).total_seconds() / 3600
        
        if age_in_hours < 12.0:
            print("⚡ [Cache Hit] Returning cached trending data.")
            return cache_record.data

    # --- 2. CACHE MISS OR FORCE REFRESH: DEPLOY AI AGENTS ---
    print(f"🤖 [{'Force Rescan' if force else 'Cache Stale'}] Deploying Trend Analyzer Agents...")
    try:
        new_trending_data = run_trend_analysis()
        
        # Ensure we always have an array, even if the AI fails
        if "resorts" not in new_trending_data:
            new_trending_data = {"resorts": []}

        # --- 3. SAVE TO CACHE ---
        if cache_record:
            cache_record.data = new_trending_data
            cache_record.updated_at = now
        else:
            new_record = TrendingCache(data=new_trending_data)
            db.add(new_record)
            
        db.commit()
        return new_trending_data

    except Exception as e:
        db.rollback()
        print(f"❌ [Trend API Error]: {e}")
        # Fallback payload to keep the UI from crashing
        return {
            "resorts": [
                { 
                    "name": "SYSTEM_OFFLINE", 
                    "metric": "API_ERROR", 
                    "condition": "AWAITING_REBOOT", 
                    "color": "text-red-500", 
                    "border": "border-red-500" 
                }
            ]
        }