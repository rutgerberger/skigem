import traceback
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.models.schemas import SearchCriteria, Phase1Result, Phase2Result, ResortResponse
from app.models.domain import User, Resort
from app.database import get_db
from app.orchestra.crew import run_phase_a_scout, run_phase_b_hunter

router = APIRouter(tags=["Search & AI Agents"])

class PhaseBRequest(BaseModel):
    criteria: SearchCriteria
    target_resort: str
    user_id: Optional[int] = None

@router.get("/resorts", response_model=List[ResortResponse])
async def get_all_resorts(db: Session = Depends(get_db)):
    return db.query(Resort).all()

@router.get("/resorts/search")
async def autocomplete_resorts(q: str = Query(""), db: Session = Depends(get_db)):
    query_lower = f"%{q.lower()}%"
    resorts = db.query(Resort).filter(Resort.name.ilike(query_lower)).all()
    return {"results": [resort.name for resort in resorts]}

@router.post("/search/resorts", response_model=Phase1Result)
async def scout_resorts(criteria: SearchCriteria):
    try:
        result_data = run_phase_a_scout(criteria.model_dump())
        return Phase1Result(**result_data)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search/chalets", response_model=Phase2Result)
@router.post("/hunt_direct", response_model=Phase2Result) # Point both endpoints to the same logic
async def hunt_chalets(request: PhaseBRequest, db: Session = Depends(get_db)):
    try:
        user_personality = ""
        if request.user_id:
            user = db.query(User).filter(User.id == request.user_id).first()
            if user and user.personality_summary:
                user_personality = user.personality_summary
                
        result_data = run_phase_b_hunter(request.criteria.model_dump(), request.target_resort, user_personality)
        return Phase2Result(**result_data)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))