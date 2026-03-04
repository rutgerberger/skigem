from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.models.schemas import TripCreate, TripResponse, TripLegCreate, TripLegResponse
from app.models.domain import Trip, TripLeg, Resort, Chalet as DBChalet
from app.database import get_db

router = APIRouter(tags=["Trip Planner"])

class TripLegUpdate(BaseModel):
    arrival_date: Optional[str] = None
    departure_date: Optional[str] = None
    chalet_id: Optional[int] = None 
    remove_chalet: Optional[bool] = False

@router.post("/trips", response_model=TripResponse)
async def create_trip(trip_data: TripCreate, db: Session = Depends(get_db)):
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
    try:
        query = db.query(Trip)
        if user_id: query = query.filter(Trip.user_id == user_id)
        return query.all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/trips/{trip_id}", response_model=TripResponse)
async def get_trip_by_id(trip_id: int, db: Session = Depends(get_db)):
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip: raise HTTPException(status_code=404, detail="Trip not found.")
        return trip
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/trips/{trip_id}/legs", response_model=TripLegResponse)
async def add_trip_leg(trip_id: int, leg_data: TripLegCreate, db: Session = Depends(get_db)):
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip: raise HTTPException(status_code=404, detail="Target Trip not found.")
            
        resort = db.query(Resort).filter(Resort.id == leg_data.resort_id).first()
        if not resort: raise HTTPException(status_code=404, detail="Target Resort not found.")

        if leg_data.chalet_id:
            chalet = db.query(DBChalet).filter(DBChalet.id == leg_data.chalet_id).first()
            if not chalet: raise HTTPException(status_code=404, detail="Target Chalet not found.")

        new_leg = TripLeg(trip_id=trip_id, **leg_data.model_dump())
        db.add(new_leg)
        db.commit()
        db.refresh(new_leg)
        return new_leg
    except HTTPException: raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/trips/{trip_id}", response_model=TripResponse)
async def update_trip(trip_id: int, trip_data: TripCreate, db: Session = Depends(get_db)):
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip: raise HTTPException(status_code=404, detail="Trip not found.")
            
        trip.name = trip_data.name
        if trip_data.start_date is not None: trip.start_date = trip_data.start_date
        if trip_data.end_date is not None: trip.end_date = trip_data.end_date
            
        db.commit()
        db.refresh(trip)
        return trip
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    
@router.patch("/trips/legs/{leg_id}", response_model=TripLegResponse)
async def update_trip_leg(leg_id: int, update_data: TripLegUpdate, db: Session = Depends(get_db)):
    try:
        leg = db.query(TripLeg).filter(TripLeg.id == leg_id).first()
        if not leg: raise HTTPException(status_code=404, detail="Leg not found.")

        if update_data.arrival_date: leg.arrival_date = datetime.strptime(update_data.arrival_date, "%Y-%m-%d").date()
        if update_data.departure_date: leg.departure_date = datetime.strptime(update_data.departure_date, "%Y-%m-%d").date()

        if update_data.remove_chalet: leg.chalet_id = None
        elif update_data.chalet_id: leg.chalet_id = update_data.chalet_id

        db.commit()
        db.refresh(leg)
        return leg
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/trips/{trip_id}")
async def delete_trip(trip_id: int, db: Session = Depends(get_db)):
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip: raise HTTPException(status_code=404, detail="Trip not found.")
        db.delete(trip)
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/trips/legs/{leg_id}")
async def remove_trip_leg(leg_id: int, db: Session = Depends(get_db)):
    try:
        leg = db.query(TripLeg).filter(TripLeg.id == leg_id).first()
        if not leg: raise HTTPException(status_code=404, detail="Leg not found.")
        db.delete(leg)
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))