from pydantic import BaseModel, Field
from typing import List, Optional

# --- INPUT MODEL ---
class SearchCriteria(BaseModel):
    country: str = Field(..., description="The country to search in (e.g., 'Austria', 'France', 'Japan')")
    min_slope_length_km: int = Field(0, description="Minimum total length of ski slopes in km")
    max_budget_per_night: float = Field(..., description="Maximum budget per night in EUR")
    lift_proximity_m: int = Field(1000, description="Maximum walking distance to the ski lift in meters")
    additional_requirements: Optional[str] = Field(None, description="E.g., 'sauna', 'pet-friendly', 'fireplace'")

# --- OUTPUT MODELS ---
class Chalet(BaseModel):
    name: str = Field(..., description="Name of the chalet")
    url: str = Field(..., description="Direct link to book or view the chalet")
    price_per_night: float = Field(..., description="Estimated price per night")
    distance_to_lift_m: int = Field(..., description="Distance to the nearest ski lift in meters")
    hidden_gem_score: int = Field(..., ge=1, le=10, description="1-10 score of how much of a 'hidden gem' this is")
    reasoning: str = Field(..., description="Why the AI chose this specific chalet")

class SearchResult(BaseModel):
    resort_name: str = Field(..., description="Name of the chosen ski resort")
    resort_slope_km: int = Field(..., description="Total ski slope length of the resort")
    chalets: List[Chalet] = Field(..., description="List of matching chalets found")