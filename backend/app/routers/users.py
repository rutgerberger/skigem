import os
import traceback
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from langchain_groq import ChatGroq

from app.models.schemas import UserFeedback, Chalet, UserResortAction
from app.models.domain import User, InteractionLog, Chalet as DBChalet, Resort
from app.database import get_db, SessionLocal
from app.orchestra.agents.personality_updater import update_user_profile

router = APIRouter(tags=["User & Archives"])

# --- LOCAL SCHEMAS ---
class SaveChaletRequest(BaseModel):
    user_id: int
    resort_name: str
    chalet: Chalet

class UpdateImageRequest(BaseModel):
    image_url: str

# --- BACKGROUND TASKS ---
def process_feedback_background(user_id: int, feedback_dict: dict):
    db = SessionLocal() 
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return
            
        current_profile = user.personality_summary or ""
        llm = ChatGroq(
            model="meta-llama/llama-4-scout-17b-16e-instruct", 
            temperature=0.2, 
            api_key=os.environ.get("GROQ_API_KEY")
        )
        new_profile = update_user_profile(current_profile, feedback_dict, llm)
        
        user.personality_summary = new_profile
        db.commit()
        print(f"⛷️ [Personality Engine] Profile updated for User {user_id}:\n{new_profile}")
    except Exception as e:
        print(f"❌ Background Task Error: {e}")
    finally:
        db.close()

# --- FEEDBACK ---
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

# --- CHALET ARCHIVES ---
@router.post("/chalets/save")
async def save_chalet(request: SaveChaletRequest, db: Session = Depends(get_db)):
    try:
        user = db.query(User).filter(User.id == request.user_id).first()
        if not user:
            user = User(id=request.user_id, personality_summary="")
            db.add(user)
            db.commit()
            
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
        
        new_log = InteractionLog(user_id=request.user_id, chalet_id=saved_item.id, action="saved", reason="User explicitly saved this chalet.")
        db.add(new_log)
        db.commit()
        return {"status": "success", "message": "Chalet saved.", "chalet_id": saved_item.id}
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
        item = db.query(DBChalet).filter(DBChalet.id == chalet_id, DBChalet.user_id == user_id).first()
        if not item: raise HTTPException(status_code=404, detail="Target record not found.")
        db.delete(item)
        db.commit()
        return {"status": "success", "message": "Target purged."}
    except Exception as e:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/user/{user_id}/saved/{chalet_id}/image")
async def update_saved_chalet_image(user_id: int, chalet_id: int, request: UpdateImageRequest, db: Session = Depends(get_db)):
    try:
        item = db.query(DBChalet).filter(DBChalet.id == chalet_id, DBChalet.user_id == user_id).first()
        if not item: raise HTTPException(status_code=404, detail="Target record not found.")
        item.image_url = request.image_url
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# --- RESORT ARCHIVES ---
@router.post("/resorts/save")
async def save_resort(request: UserResortAction, db: Session = Depends(get_db)):
    try:
        user = db.query(User).filter(User.id == request.user_id).first()
        if not user:
            user = User(id=request.user_id, personality_summary="")
            db.add(user)
            db.commit()
            db.refresh(user)
            
        resort = db.query(Resort).filter(Resort.id == request.resort_id).first()
        if not resort: raise HTTPException(status_code=404, detail="Target resort not found.")

        if resort not in user.saved_resorts:
            user.saved_resorts.append(resort)
            db.commit()
            new_log = InteractionLog(user_id=request.user_id, chalet_id=None, action="saved_resort", reason=f"User explicitly saved resort '{resort.name}'.")
            db.add(new_log)
            db.commit()
        return {"status": "success", "resort_id": resort.id}
    except Exception as e:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user/{user_id}/saved_resorts")
async def get_saved_resorts(user_id: int, db: Session = Depends(get_db)):
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user: return {"user_id": user_id, "saved_resorts": []}
        return {"user_id": user_id, "saved_resorts": user.saved_resorts}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/user/{user_id}/saved_resorts/{resort_id}")
async def delete_saved_resort(user_id: int, resort_id: int, db: Session = Depends(get_db)):
    try:
        user = db.query(User).filter(User.id == user_id).first()
        resort = db.query(Resort).filter(Resort.id == resort_id).first()
        if user and resort and resort in user.saved_resorts:
            user.saved_resorts.remove(resort)
            db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))