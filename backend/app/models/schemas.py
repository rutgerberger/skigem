from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import date

class ResortBase(BaseModel):
    name: str
    country: Optional[str] = None
    latitude: float
    longitude: float

class ResortResponse(ResortBase):
    id: int
    # This tells Pydantic it's reading from a SQLAlchemy ORM model, not a standard dict
    model_config = ConfigDict(from_attributes=True) 

# --- INPUT MODELS ---
class SearchCriteria(BaseModel):
    country: str
    max_budget_per_night: float
    lift_proximity_m: int = Field(default=500)
    number_of_guests: int
    additional_requirements: Optional[str] = None
    # --- RADAR CHART PREFERENCES (1-5 Scale) ---
    pref_pisteKms: int = Field(default=3, description="Importance of extensive piste kilometers")
    pref_apres: int = Field(default=3, description="Importance of après-ski and nightlife")
    pref_offPiste: int = Field(default=3, description="Importance of freeride and off-piste")
    pref_snow: int = Field(default=3, description="Importance of snow reliability/altitude")
    pref_family: int = Field(default=3, description="Importance of family-friendly facilities")
    pref_quiet: int = Field(default=3, description="Importance of uncrowded/quiet slopes")

# --- PHASE A OUTPUT (Resort Briefing) ---
class RichResort(BaseModel):
    name: str = Field(..., description="Name of the resort")
    slope_length_km: int = Field(..., description="Total ski slope length in km")
    altitude_info: str = Field(..., description="Base and peak altitude (e.g., '1200m - 2800m')")
    vibe: str = Field(..., description="The vibe of the resort (e.g., 'Sleepy authentic village', 'Party town')")
    logistics: str = Field(..., description="Nearest major airport and transfer time")
    avg_pass_price_eur: Optional[float] = Field(None, description="Average daily ski pass price")

class Phase1Result(BaseModel):
    resorts: List[RichResort]

# --- PHASE B OUTPUT (The Chalets) ---
class Chalet(BaseModel):
    name: str
    village: Optional[str] = Field("Unknown", description="The specific village or sector name. Use 'Unknown' if not found.")
    url: str = Field(None, description="Direct URL to the chalet. Use null if unknown.")
    image_url: Optional[str] = Field(None, description="Direct URL to the main image of the chalet.")
    price_per_night: Optional[float] = Field(None, description="Price per night. MUST be a number or null.")
    total_price_high_season: Optional[float] = Field(None, description="Total price. MUST be a number or null.")
    distance_to_lift_m: Optional[int] = Field(None, description="Distance in meters. MUST be an integer or null.")
    capacity: Optional[int] = Field(None, description="Maximum guest capacity.")
    hidden_gem_score: int = Field(5, description="Score from 1 to 10.")
    reasoning: str

class Phase2Result(BaseModel):
    resort_name: str
    chalets: List[Chalet]

# --- USER & FEEDBACK MODELS ---
class UserProfile(BaseModel):
    user_id: int
    personality_summary: Optional[str] = Field(None, description="AI-generated summary of user preferences")

class UserFeedback(BaseModel):
    user_id: int
    chalet_id: int
    thumb_status: str = Field(..., description="'up' or 'down'")
    reason: str = Field(..., description="Why the user liked or disliked it")


# --- TELEMETRY MODELS (THE RESORT CENTER) ---

class DailySnowfall(BaseModel):
    date: str = Field(..., description="Date of the snowfall (e.g., '16 feb')")
    amount_cm: int = Field(..., description="Amount of snow fallen in cm. Use 0 if none.")

class WeatherIntel(BaseModel):
    condition: str = Field(..., description="Current weather (e.g., 'Heavy Snow', 'Clear')")
    temp_base_c: float = Field(..., description="Temperature at the base village in Celsius")
    temp_peak_c: float = Field(..., description="Temperature at the mountain peak in Celsius")
    wind_speed_kmh: float = Field(..., description="Wind speed in km/h")

class SnowIntel(BaseModel):
    base_depth_cm: int = Field(..., description="Current snow depth at the base in cm")
    peak_depth_cm: int = Field(..., description="Current snow depth at the peak in cm")
    forecast_next_48h_cm: int = Field(..., description="Expected snowfall in the next 48 hours in cm")
    historical_4_weeks: List[DailySnowfall] = Field(
        ..., 
        description="Array of recent significant snowfall days to build a 4-week chart."
    )

class ResortTelemetry(BaseModel):
    resort_name: str = Field(..., description="The verified name of the resort")
    weather: WeatherIntel
    snow: SnowIntel
    open_lifts: int = Field(..., description="Number of lifts currently open")
    total_lifts: int = Field(..., description="Total number of lifts in the resort")
    crowd_expectation: str = Field(..., description="Expected crowd level (e.g., 'Ghost Town', 'Moderate', 'Gridlock')")
    
    source_urls: List[str] = Field(default_factory=list, description="List of source URLs scraped for this data")
    last_updated: Optional[str] = Field(None, description="Timestamp of when the data was gathered/cached")

# Chalet Response (Needed for nested queries)
class ChaletResponse(Chalet):
    id: int
    model_config = ConfigDict(from_attributes=True)

# Schema for creating/adding a single leg to a trip
class TripLegCreate(BaseModel):
    resort_id: int
    chalet_id: Optional[int] = None
    arrival_date: Optional[date] = None
    departure_date: Optional[date] = None
    order_index: int = 0

# Schema for returning a trip leg (includes full Resort and Chalet objects)
class TripLegResponse(BaseModel):
    id: int
    trip_id: int
    resort_id: int
    chalet_id: Optional[int] = None
    arrival_date: Optional[date] = None
    departure_date: Optional[date] = None
    order_index: int
    
    # Nested Objects
    resort: ResortResponse
    chalet: Optional[ChaletResponse] = None

    model_config = ConfigDict(from_attributes=True)

# Schema for creating a brand new Trip
class TripCreate(BaseModel):
    name: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    user_id: Optional[int] = None # For guest mode

# Schema for returning a full Trip (includes all nested legs)
class TripResponse(BaseModel):
    id: int
    name: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: str
    user_id: Optional[int] = None
    
    # List of all stops on the trip
    legs: List[TripLegResponse] = []

    model_config = ConfigDict(from_attributes=True)