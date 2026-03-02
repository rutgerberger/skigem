import os
import traceback
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from langchain_groq import ChatGroq

# Import our updated Pydantic models
from app.models.schemas import SearchCriteria, Phase1Result, Phase2Result, UserFeedback, Chalet, ResortTelemetry, ResortResponse
# Added 'Resort' to the domain imports
from app.models.domain import User, InteractionLog, SavedChalet, ResortTelemetryCache, Resort
from app.database import get_db, SessionLocal

# Import our workflows and the new personality updater
from app.orchestra.crew import run_phase_a_scout, run_phase_b_hunter
from app.orchestra.agents.personality_updater import update_user_profile
from app.orchestra.agents.telemetry_officer import gather_resort_telemetry

router = APIRouter()

# Helper model so the frontend can send both the criteria AND the chosen resort for Phase 2
class PhaseBRequest(BaseModel):
    criteria: SearchCriteria
    target_resort: str
    user_id: Optional[int] = None

# Helper model for saving a specific chalet
class SaveChaletRequest(BaseModel):
    user_id: int
    resort_name: str
    chalet: Chalet

class UpdateImageRequest(BaseModel):
    image_url: str

# ==========================================
# BACKGROUND TASKS
# ==========================================
def process_feedback_background(user_id: int, feedback_dict: dict):
    """Runs asynchronously to update the user's profile using the LLM."""
    db = SessionLocal() # Open a new session for the background task
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return
            
        current_profile = user.personality_summary or ""
        
        # Initialize the LLM
        llm = ChatGroq(
            model="meta-llama/llama-4-scout-17b-16e-instruct", 
            temperature=0.2, 
            api_key=os.environ.get("GROQ_API_KEY")
        )
        
        # Generate the new profile string
        new_profile = update_user_profile(current_profile, feedback_dict, llm)
        
        # Save back to DB
        user.personality_summary = new_profile
        db.commit()
        print(f"⛷️ [Personality Engine] Profile updated for User {user_id}:\n{new_profile}")
        
    except Exception as e:
        print(f"❌ Background Task Error: {e}")
    finally:
        db.close()

# ==========================================
# USER FAVORITES (STEP 6)
# ==========================================
@router.post("/chalets/save")
async def save_chalet(request: SaveChaletRequest, db: Session = Depends(get_db)):
    """
    Saves a specific chalet to the user's favorites in the database.
    """
    try:
        # Ensure user exists
        user = db.query(User).filter(User.id == request.user_id).first()
        if not user:
            user = User(id=request.user_id, personality_summary="")
            db.add(user)
            db.commit()
            
        # Add the chalet to the database
        saved_item = SavedChalet(
            user_id=request.user_id,
            resort_name=request.resort_name,
            chalet_name=request.chalet.name,
            village=request.chalet.village,
            url=request.chalet.url,
            image_url=request.chalet.image_url,
            price_per_night=request.chalet.price_per_night,
            distance_to_lift_m=request.chalet.distance_to_lift_m
        )
        
        db.add(saved_item)
        db.commit()
        
        # Also log this as a positive interaction to feed the personality engine!
        new_log = InteractionLog(
            user_id=request.user_id,
            chalet_id=saved_item.id,
            action="saved",
            reason="User explicitly saved this chalet to favorites."
        )
        db.add(new_log)
        db.commit()

        return {"status": "success", "message": "Chalet successfully saved to favorites."}
        
    except Exception as e:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user/{user_id}/saved")
async def get_saved_chalets(user_id: int, db: Session = Depends(get_db)):
    """
    Retrieves all saved chalets for a specific user.
    """
    try:
        saved_items = db.query(SavedChalet).filter(SavedChalet.user_id == user_id).all()
        return {"user_id": user_id, "saved_chalets": saved_items}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/user/{user_id}/saved/{chalet_id}")
async def delete_saved_chalet(user_id: int, chalet_id: int, db: Session = Depends(get_db)):
    """
    Removes a specific chalet from the user's favorites archive.
    """
    try:
        # Find the record that matches both the ID and the User ID (for security)
        item_to_delete = db.query(SavedChalet).filter(
            SavedChalet.id == chalet_id, 
            SavedChalet.user_id == user_id
        ).first()

        if not item_to_delete:
            raise HTTPException(status_code=404, detail="Target record not found in archive.")

        db.delete(item_to_delete)
        db.commit()

        return {"status": "success", "message": "Target purged from archive."}
    except Exception as e:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/user/{user_id}/saved/{chalet_id}/image")
async def update_saved_chalet_image(
    user_id: int, 
    chalet_id: int, 
    request: UpdateImageRequest, 
    db: Session = Depends(get_db)
):
    """
    Allows the user to manually override the image URL for a saved target.
    """
    try:
        item = db.query(SavedChalet).filter(
            SavedChalet.id == chalet_id, 
            SavedChalet.user_id == user_id
        ).first()

        if not item:
            raise HTTPException(status_code=404, detail="Target record not found in archive.")

        item.image_url = request.image_url
        db.commit()

        return {"status": "success", "message": "Image data successfully overwritten."}
    except Exception as e:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# USER FEEDBACK ENDPOINT
# ==========================================
@router.post("/feedback")
async def submit_feedback(
    feedback: UserFeedback, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    """
    Saves a thumbs up/down interaction and triggers an asynchronous update 
    of the user's personality profile.
    """
    try:
        # Ensure the user exists in the DB (Create if they don't)
        user = db.query(User).filter(User.id == feedback.user_id).first()
        if not user:
            user = User(id=feedback.user_id, personality_summary="")
            db.add(user)
            db.commit()
            db.refresh(user)

        # Save the raw interaction log
        new_log = InteractionLog(
            user_id=feedback.user_id,
            chalet_id=feedback.chalet_id,
            action=f"thumbs_{feedback.thumb_status}",
            reason=feedback.reason
        )
        db.add(new_log)
        db.commit()

        # Trigger the LLM profile update in the background
        feedback_dict = {"thumb_status": feedback.thumb_status, "reason": feedback.reason}
        background_tasks.add_task(process_feedback_background, user.id, feedback_dict)

        return {"status": "success", "message": "Feedback logged and personality update queued."}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# DIRECT SEARCH ENDPOINTS (STEP 5)
# ==========================================
@router.get("/resorts", response_model=List[ResortResponse])
async def get_all_resorts(db: Session = Depends(get_db)):
    """
    Returns the full list of active resorts from the database.
    Useful for populating frontend state and dropdowns.
    """
    return db.query(Resort).all()

@router.get("/resorts/search")
async def autocomplete_resorts(q: str = Query(""), db: Session = Depends(get_db)):
    """
    Quickly searches the database for frontend autocomplete dropdowns.
    Returns a list of matching resort names.
    """
    query_lower = f"%{q.lower()}%"
    resorts = db.query(Resort).filter(Resort.name.ilike(query_lower)).all()
    
    # Returning just the names as a list to maintain compatibility with your existing frontend
    return {"results": [resort.name for resort in resorts]}

@router.post("/hunt_direct", response_model=Phase2Result)
async def hunt_direct(request: PhaseBRequest, db: Session = Depends(get_db)):
    """
    Directly hunts for chalets in a known resort, completely bypassing the Resort Scout phase.
    """
    try:
        user_personality = ""
        # Fetch the user's personality if an ID was provided
        if request.user_id:
            user = db.query(User).filter(User.id == request.user_id).first()
            if user and user.personality_summary:
                user_personality = user.personality_summary
                print(f"🧠 [Agent Info] Direct Hunt with personality: {user_personality}")
                
        criteria_dict = request.criteria.model_dump()
        
        # Directly invoke Phase B logic
        result_data = run_phase_b_hunter(criteria_dict, request.target_resort, user_personality)
        return Phase2Result(**result_data)
        
    except Exception as e:
        print("\n" + "="*50)
        print("🔥 FASTAPI CRASH REPORT (DIRECT HUNT):")
        traceback.print_exc()
        print("="*50 + "\n")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# PHASE A: THE RESORT BRIEFING
# ==========================================
@router.post("/search/resorts", response_model=Phase1Result)
async def scout_resorts(criteria: SearchCriteria):
    """
    Phase A: Takes user criteria and returns 3-5 highly curated ski resorts.
    """
    try:
        criteria_dict = criteria.model_dump()
        result_data = run_phase_a_scout(criteria_dict)
        return Phase1Result(**result_data)
        
    except Exception as e:
        print("\n" + "="*50)
        print("🔥 FASTAPI CRASH REPORT (PHASE A):")
        traceback.print_exc()
        print("="*50 + "\n")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# PHASE B: THE DEEP-WEB CHALET HUNT
# ==========================================
@router.post("/search/chalets", response_model=Phase2Result)
async def hunt_chalets(request: PhaseBRequest, db: Session = Depends(get_db)):
    """
    Phase B: Scrapes chalets, taking user personality into account if a user_id is provided.
    (Used when continuing from Phase A)
    """
    try:
        user_personality = ""
        if request.user_id:
            user = db.query(User).filter(User.id == request.user_id).first()
            if user and user.personality_summary:
                user_personality = user.personality_summary
                print(f"🧠 [Agent Info] Hunting with personality: {user_personality}")
                
        criteria_dict = request.criteria.model_dump()
        result_data = run_phase_b_hunter(criteria_dict, request.target_resort, user_personality)
        return Phase2Result(**result_data)
        
    except Exception as e:
        print("\n" + "="*50)
        print("🔥 FASTAPI CRASH REPORT (PHASE B):")
        traceback.print_exc()
        print("="*50 + "\n")
        raise HTTPException(status_code=500, detail=str(e))
    
# ==========================================
# RESORT TELEMETRY HUB (CACHED)
# ==========================================
@router.get("/resort/{resort_slug}/telemetry", response_model=ResortTelemetry)
async def get_resort_telemetry(resort_slug: str, db: Session = Depends(get_db)):
    """
    Fetches real-time weather, snow, and lift data for a verified resort.
    Checks cache first to prevent redundant agent scraping.
    """
    target_resort = resort_slug 

    # 1. STRICT VALIDATION VIA DATABASE
    resort_record = db.query(Resort).filter(Resort.name.ilike(f"%{target_resort}%")).first()
    
    if not resort_record:
        raise HTTPException(
            status_code=403, 
            detail=f"ACCESS DENIED. '{target_resort}' is not within authorized scouting parameters."
        )
        
    # Standardize the target name based on our DB source of truth
    target_resort = resort_record.name

    try:
        now = datetime.now(timezone.utc)
        
        # 2. CHECK THE CACHE
        cached_record = db.query(ResortTelemetryCache).filter(ResortTelemetryCache.resort_name == target_resort).first()
        
        if cached_record and cached_record.updated_at:
            # Safely handle timezone-naive DB timestamps (SQLite)
            updated_time = cached_record.updated_at
            if updated_time.tzinfo is None:
                updated_time = updated_time.replace(tzinfo=timezone.utc)
                
            age_in_hours = (now - updated_time).total_seconds() / 3600
            
            # If the data is less than 24 hours old, intercept and return immediately!
            if age_in_hours < 24.0:
                print(f"⚡ [Cache Hit] Returning stored telemetry for {target_resort} (Age: {round(age_in_hours, 1)}h)")
                
                payload = cached_record.telemetry_data
                payload["source_urls"] = cached_record.source_urls
                payload["last_updated"] = updated_time.isoformat()
                
                return ResortTelemetry(**payload)

        # 3. CACHE MISS / EXPIRED -> DEPLOY AGENT
        print(f"📡 [Cache Miss] Scraping fresh telemetry streams for {target_resort}...")
        telemetry_data = gather_resort_telemetry(target_resort)
        
        source_urls = telemetry_data.pop("source_urls", [])

        # 4. SAVE OR UPDATE THE DATABASE
        if cached_record:
            cached_record.telemetry_data = telemetry_data
            cached_record.source_urls = source_urls
            # SQLAlchemy `onupdate=func.now()` handles the timestamp refresh automatically
        else:
            new_record = ResortTelemetryCache(
                resort_name=target_resort,
                telemetry_data=telemetry_data,
                source_urls=source_urls
            )
            db.add(new_record)
            
        db.commit()

        # 5. ATTACH THE FRESH TIMESTAMP AND RETURN TO FRONTEND
        telemetry_data["source_urls"] = source_urls
        telemetry_data["last_updated"] = now.isoformat()

        return ResortTelemetry(**telemetry_data)
        
    except Exception as e:
        db.rollback()
        print("\n" + "="*50)
        print("🔥 FASTAPI CRASH REPORT (TELEMETRY HUB):")
        traceback.print_exc()
        print("="*50 + "\n")
        raise HTTPException(status_code=500, detail="Failed to establish uplink with weather and snow arrays.")