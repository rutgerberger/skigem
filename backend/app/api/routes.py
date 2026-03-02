import os
import traceback
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from langchain_groq import ChatGroq

# Import our updated Pydantic models (Added Trip schemas)
from app.models.schemas import (
    SearchCriteria, Phase1Result, Phase2Result, UserFeedback, Chalet, 
    ResortTelemetry, ResortResponse, TripCreate, TripResponse, 
    TripLegCreate, TripLegResponse
)

# Import our domain models 
# NOTE: We alias the DB model to 'DBChalet' to prevent collision with the Pydantic 'Chalet' schema!
from app.models.domain import (
    User, InteractionLog, ResortTelemetryCache, Resort, 
    Chalet as DBChalet, Trip, TripLeg
)

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
# USER FAVORITES / CHALET SAVING
# ==========================================
@router.post("/chalets/save")
async def save_chalet(request: SaveChaletRequest, db: Session = Depends(get_db)):
    """
    Saves a specific chalet to the database.
    """
    try:
        # Ensure user exists
        user = db.query(User).filter(User.id == request.user_id).first()
        if not user:
            user = User(id=request.user_id, personality_summary="")
            db.add(user)
            db.commit()
            
        # Add the chalet to the database (Using the aliased DBChalet model)
        saved_item = DBChalet(
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
        
        # Log interaction for personality engine
        new_log = InteractionLog(
            user_id=request.user_id,
            chalet_id=saved_item.id,
            action="saved",
            reason="User explicitly saved this chalet to favorites."
        )
        db.add(new_log)
        db.commit()

        return {"status": "success", "message": "Chalet successfully saved to database.", "chalet_id": saved_item.id}
        
    except Exception as e:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user/{user_id}/saved")
async def get_saved_chalets(user_id: int, db: Session = Depends(get_db)):
    try:
        saved_items = db.query(DBChalet).filter(DBChalet.user_id == user_id).all()
        return {"user_id": user_id, "saved_chalets": saved_items}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/user/{user_id}/saved/{chalet_id}")
async def delete_saved_chalet(user_id: int, chalet_id: int, db: Session = Depends(get_db)):
    try:
        item_to_delete = db.query(DBChalet).filter(
            DBChalet.id == chalet_id, 
            DBChalet.user_id == user_id
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
async def update_saved_chalet_image(user_id: int, chalet_id: int, request: UpdateImageRequest, db: Session = Depends(get_db)):
    try:
        item = db.query(DBChalet).filter(
            DBChalet.id == chalet_id, 
            DBChalet.user_id == user_id
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
# TRIP PLANNER ENDPOINTS (PHASE 2 UPGRADE)
# ==========================================

@router.post("/trips", response_model=TripResponse)
async def create_trip(trip_data: TripCreate, db: Session = Depends(get_db)):
    """Creates a new empty trip."""
    try:
        new_trip = Trip(**trip_data.model_dump())
        db.add(new_trip)
        db.commit()
        db.refresh(new_trip)
        return new_trip
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/trips", response_model=List[TripResponse])
async def get_all_trips(user_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Fetches all trips, optionally filtered by user ID."""
    try:
        query = db.query(Trip)
        if user_id:
            query = query.filter(Trip.user_id == user_id)
        return query.all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/trips/{trip_id}", response_model=TripResponse)
async def get_trip_by_id(trip_id: int, db: Session = Depends(get_db)):
    """Fetches a specific trip, auto-populating all associated legs, resorts, and chalets."""
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found in database.")
        return trip
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/trips/{trip_id}/legs", response_model=TripLegResponse)
async def add_trip_leg(trip_id: int, leg_data: TripLegCreate, db: Session = Depends(get_db)):
    """Adds a resort (and optionally a chalet) as a stop on an existing trip."""
    try:
        # Verify trip exists
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            raise HTTPException(status_code=404, detail="Target Trip not found.")
            
        # Verify resort exists
        resort = db.query(Resort).filter(Resort.id == leg_data.resort_id).first()
        if not resort:
            raise HTTPException(status_code=404, detail="Target Resort not found.")

        # If a chalet ID was provided, verify it exists too
        if leg_data.chalet_id:
            chalet = db.query(DBChalet).filter(DBChalet.id == leg_data.chalet_id).first()
            if not chalet:
                raise HTTPException(status_code=404, detail="Target Chalet not found.")

        new_leg = TripLeg(
            trip_id=trip_id,
            resort_id=leg_data.resort_id,
            chalet_id=leg_data.chalet_id,
            arrival_date=leg_data.arrival_date,
            departure_date=leg_data.departure_date,
            order_index=leg_data.order_index
        )
        
        db.add(new_leg)
        db.commit()
        db.refresh(new_leg)
        
        return new_leg
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/trips/{trip_id}")
async def delete_trip(trip_id: int, db: Session = Depends(get_db)):
    """Nukes a trip and cascades the deletion to all associated trip legs."""
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found.")
            
        db.delete(trip)
        db.commit()
        return {"status": "success", "message": f"Trip {trip_id} and all nested legs successfully erased."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# USER FEEDBACK ENDPOINT
# ==========================================
@router.post("/feedback")
async def submit_feedback(feedback: UserFeedback, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        user = db.query(User).filter(User.id == feedback.user_id).first()
        if not user:
            user = User(id=feedback.user_id, personality_summary="")
            db.add(user)
            db.commit()
            db.refresh(user)

        new_log = InteractionLog(
            user_id=feedback.user_id,
            chalet_id=feedback.chalet_id,
            action=f"thumbs_{feedback.thumb_status}",
            reason=feedback.reason
        )
        db.add(new_log)
        db.commit()

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
    return db.query(Resort).all()

@router.get("/resorts/search")
async def autocomplete_resorts(q: str = Query(""), db: Session = Depends(get_db)):
    query_lower = f"%{q.lower()}%"
    resorts = db.query(Resort).filter(Resort.name.ilike(query_lower)).all()
    return {"results": [resort.name for resort in resorts]}

@router.post("/hunt_direct", response_model=Phase2Result)
async def hunt_direct(request: PhaseBRequest, db: Session = Depends(get_db)):
    try:
        user_personality = ""
        if request.user_id:
            user = db.query(User).filter(User.id == request.user_id).first()
            if user and user.personality_summary:
                user_personality = user.personality_summary
                print(f"🧠 [Agent Info] Direct Hunt with personality: {user_personality}")
                
        criteria_dict = request.criteria.model_dump()
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
    target_resort = resort_slug 

    resort_record = db.query(Resort).filter(Resort.name.ilike(f"%{target_resort}%")).first()
    
    if not resort_record:
        raise HTTPException(
            status_code=403, 
            detail=f"ACCESS DENIED. '{target_resort}' is not within authorized scouting parameters."
        )
        
    target_resort = resort_record.name

    try:
        now = datetime.now(timezone.utc)
        
        cached_record = db.query(ResortTelemetryCache).filter(ResortTelemetryCache.resort_name == target_resort).first()
        
        if cached_record and cached_record.updated_at:
            updated_time = cached_record.updated_at
            if updated_time.tzinfo is None:
                updated_time = updated_time.replace(tzinfo=timezone.utc)
                
            age_in_hours = (now - updated_time).total_seconds() / 3600
            
            if age_in_hours < 24.0:
                print(f"⚡ [Cache Hit] Returning stored telemetry for {target_resort} (Age: {round(age_in_hours, 1)}h)")
                
                payload = cached_record.telemetry_data
                payload["source_urls"] = cached_record.source_urls
                payload["last_updated"] = updated_time.isoformat()
                
                return ResortTelemetry(**payload)

        print(f"📡 [Cache Miss] Scraping fresh telemetry streams for {target_resort}...")
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

        return ResortTelemetry(**telemetry_data)
        
    except Exception as e:
        db.rollback()
        print("\n" + "="*50)
        print("🔥 FASTAPI CRASH REPORT (TELEMETRY HUB):")
        traceback.print_exc()
        print("="*50 + "\n")
        raise HTTPException(status_code=500, detail="Failed to establish uplink with weather and snow arrays.")