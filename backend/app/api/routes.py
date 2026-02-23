from fastapi import APIRouter, HTTPException
import traceback
from app.models.schemas import SearchCriteria, SearchResult
from app.orchestra.crew import run_skigem_orchestra

router = APIRouter()

@router.post("/search", response_model=SearchResult)
async def hunt_for_chalets(criteria: SearchCriteria):
    try:
        # Convert the Pydantic model to a dictionary for CrewAI
        criteria_dict = criteria.model_dump()
        # 🎻 Cue the Orchestra! (This will take 1-3 minutes as the agents search)
        result_data = run_skigem_orchestra(criteria_dict)
        # Return the strictly formatted Pydantic model to the frontend
        return SearchResult(**result_data)
        
    except Exception as e:
        print("\n" + "="*50)
        print("🔥 FASTAPI CRASH REPORT:")
        traceback.print_exc()
        print("="*50 + "\n")
        
        raise HTTPException(status_code=500, detail=str(e))