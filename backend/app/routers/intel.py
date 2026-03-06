# --- app/routers/intel.py ---
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError # <--- NEW IMPORT
from datetime import datetime, timezone
from app.database import get_db
from app.models.domain import NewsIntelCache, AIBucketListCache, BucketListItem, TripLeg, User
from app.orchestra.agents.resort_intel_officer import gather_resort_news, generate_ai_bucket_targets

router = APIRouter()

# 1. FETCH NEWS INTEL (CACHED)
@router.get("/resorts/{resort_name:path}/intel")
def get_news_intel(resort_name: str, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    
    # Check 1: Quick cache hit
    cache_record = db.query(NewsIntelCache).filter(NewsIntelCache.resort_name == resort_name).first()
    if cache_record and cache_record.updated_at:
        updated_time = cache_record.updated_at.replace(tzinfo=timezone.utc) if cache_record.updated_at.tzinfo is None else cache_record.updated_at
        if (now - updated_time).total_seconds() / 3600 < 12.0:
            return cache_record.data

    # This AI task takes a few seconds...
    new_data = gather_resort_news(resort_name)
    
    # Check 2: RE-CHECK DB in case another React request finished while we were waiting!
    cache_record = db.query(NewsIntelCache).filter(NewsIntelCache.resort_name == resort_name).first()
    
    if cache_record:
        cache_record.data = new_data
        cache_record.updated_at = now
    else:
        db.add(NewsIntelCache(resort_name=resort_name, data=new_data))
    
    # Safe Commit: If a collision happens at the exact same microsecond, just rollback
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        print(f"⚠️ [DB] Collision averted for {resort_name} news cache.")
        
    return new_data

# 2. FETCH AI BUCKET LIST SUGGESTIONS (CACHED)
@router.get("/resorts/{resort_name:path}/ai-bucketlist")
def get_ai_bucketlist(resort_name: str, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    
    # Check 1
    cache_record = db.query(AIBucketListCache).filter(AIBucketListCache.resort_name == resort_name).first()
    if cache_record and cache_record.updated_at:
        updated_time = cache_record.updated_at.replace(tzinfo=timezone.utc) if cache_record.updated_at.tzinfo is None else cache_record.updated_at
        if (now - updated_time).total_seconds() / 3600 < 48.0:
            return cache_record.data

    # Deploy Agent
    new_data = generate_ai_bucket_targets(resort_name)
    
    # Check 2
    cache_record = db.query(AIBucketListCache).filter(AIBucketListCache.resort_name == resort_name).first()
    
    if cache_record:
        cache_record.data = new_data
        cache_record.updated_at = now
    else:
        db.add(AIBucketListCache(resort_name=resort_name, data=new_data))
    
    # Safe Commit
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        print(f"⚠️ [DB] Collision averted for {resort_name} bucket list cache.")
        
    return new_data


# ==========================================
# TARGET MANAGEMENT (BUCKET LIST CRUD)
# ==========================================

# 3. GET USER'S GENERAL BUCKET LIST ARCHIVE
@router.get("/users/{user_id}/bucketlist")
def get_user_bucket_archive(user_id: int, db: Session = Depends(get_db)):
    """Fetches all items a user has saved globally across all resorts."""
    items = db.query(BucketListItem).filter(BucketListItem.user_id == user_id).all()
    return items

# 4. CREATE NEW TARGET & OPTIONALLY ATTACH TO MISSION LEG
@router.post("/bucketlist")
def add_to_bucketlist(payload: dict, db: Session = Depends(get_db)):
    # 1. Check for existing global entry for this user + resort + name
    existing_item = db.query(BucketListItem).filter(
        BucketListItem.user_id == payload["user_id"],
        BucketListItem.resort_id == payload.get("resort_id"),
        BucketListItem.name == payload["name"]
    ).first()

    target_item = existing_item

    # 2. If it doesn't exist, create it
    if not target_item:
        target_item = BucketListItem(
            user_id=payload["user_id"],
            resort_id=payload.get("resort_id"),
            name=payload["name"],
            logo=payload.get("logo", "🎯"),
            description=payload.get("description"),
            url=payload.get("url"),
            category=payload.get("category")
        )
        db.add(target_item)
        db.commit()
        db.refresh(target_item)

    # 3. Handle Trip Leg Attachment
    if "trip_leg_id" in payload:
        leg = db.query(TripLeg).filter(TripLeg.id == payload["trip_leg_id"]).first()
        if leg:
            # Prevent duplicate attachment to the SAME leg
            if target_item not in leg.bucket_items:
                leg.bucket_items.append(target_item)
                db.commit()
            
    return target_item

# 5. ATTACH EXISTING ARCHIVED TARGET TO A SPECIFIC MISSION LEG
@router.post("/trip_legs/{leg_id}/bucketlist/{item_id}")
def attach_bucket_item_to_leg(leg_id: int, item_id: int, db: Session = Depends(get_db)):
    leg = db.query(TripLeg).filter(TripLeg.id == leg_id).first()
    item = db.query(BucketListItem).filter(BucketListItem.id == item_id).first()
    
    if not leg or not item:
        raise HTTPException(status_code=404, detail="Target or Mission Leg not found.")
        
    if item not in leg.bucket_items:
        leg.bucket_items.append(item)
        db.commit()
        
    return {"status": "TARGET_SECURED"}

# 6. DETACH TARGET FROM MISSION LEG (Keep in Archive)
@router.delete("/trip_legs/{leg_id}/bucketlist/{item_id}")
def detach_bucket_item(leg_id: int, item_id: int, db: Session = Depends(get_db)):
    leg = db.query(TripLeg).filter(TripLeg.id == leg_id).first()
    item = db.query(BucketListItem).filter(BucketListItem.id == item_id).first()
    
    if leg and item in leg.bucket_items:
        leg.bucket_items.remove(item)
        db.commit()
        
    return {"status": "TARGET_DETACHED"}

# 7. PERMANENTLY ERASE TARGET FROM DATABASE
@router.delete("/bucketlist/{item_id}")
def delete_bucket_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(BucketListItem).filter(BucketListItem.id == item_id).first()
    if item:
        db.delete(item)
        db.commit()
    return {"status": "TARGET_ERASED"}