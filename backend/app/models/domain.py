from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text, JSON, DateTime, Date, Boolean, Table
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

# ==========================================
# NEW: ASSOCIATION TABLE
# ==========================================
# This bridges Users and Resorts for the "Saved Resorts" feature.
# Using a composite primary key ensures a user can only save a resort once.
user_saved_resorts = Table(
    "user_saved_resorts",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("resort_id", Integer, ForeignKey("resorts.id", ondelete="CASCADE"), primary_key=True)
)


# --- ADD TO NEW/EXISTING ASSOCIATION TABLES ---
trip_leg_bucket_items = Table(
    "trip_leg_bucket_items",
    Base.metadata,
    Column("trip_leg_id", Integer, ForeignKey("trip_legs.id", ondelete="CASCADE"), primary_key=True),
    Column("bucket_item_id", Integer, ForeignKey("bucket_list_items.id", ondelete="CASCADE"), primary_key=True)
)

class Resort(Base):
    __tablename__ = "resorts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    country = Column(String, index=True, nullable=True)
    
    # --- SKI MAP TRACKING ---
    official_ski_map_url = Column(String, nullable=True)
    ski_map_updated_at = Column(DateTime(timezone=True), nullable=True)

    # --- CSV DATA COLUMNS ---
    continent = Column(String, nullable=True)
    price = Column(Float, nullable=True)
    season = Column(String, nullable=True)
    highest_point = Column(Integer, nullable=True)
    lowest_point = Column(Integer, nullable=True)
    beginner_slopes = Column(Integer, nullable=True)
    intermediate_slopes = Column(Integer, nullable=True)
    difficult_slopes = Column(Integer, nullable=True)
    total_slopes = Column(Integer, nullable=True)
    longest_run = Column(Integer, nullable=True)
    snow_cannons = Column(Integer, nullable=True)
    surface_lifts = Column(Integer, nullable=True)
    chair_lifts = Column(Integer, nullable=True)
    gondola_lifts = Column(Integer, nullable=True)
    total_lifts = Column(Integer, nullable=True)
    lift_capacity = Column(Integer, nullable=True)
    
    # Booleans for amenities (Mapped from Yes/No)
    child_friendly = Column(Boolean, default=False)
    snowparks = Column(Boolean, default=False)
    nightskiing = Column(Boolean, default=False)
    summer_skiing = Column(Boolean, default=False)
    
    # AI GENERATED PROFILE
    description_overview = Column(Text, nullable=True)
    description_slopes = Column(Text, nullable=True)
    description_atmosphere = Column(Text, nullable=True)
    official_website_url = Column(String, nullable=True)

    # Relationships
    trip_legs = relationship("TripLeg", back_populates="resort")
    saved_by_users = relationship("User", secondary=user_saved_resorts, back_populates="saved_resorts") # NEW

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    personality_summary = Column(Text, nullable=True)
    
    # Relationships
    saved_chalets = relationship("Chalet", back_populates="owner")
    saved_resorts = relationship("Resort", secondary=user_saved_resorts, back_populates="saved_by_users") # NEW
    interactions = relationship("InteractionLog", back_populates="user")
    trips = relationship("Trip", back_populates="owner")
    bucket_items = relationship("BucketListItem", back_populates="owner", cascade="all, delete-orphan")

# Renamed from SavedChalet to Chalet for broader use
class Chalet(Base):
    __tablename__ = "chalets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Nullable if just scraped, not saved
    resort_name = Column(String, index=True)
    chalet_name = Column(String)
    village = Column(String, nullable=True)
    url = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    price_per_night = Column(Float, nullable=True)
    distance_to_lift_m = Column(Integer, nullable=True)
    
    # Relationships
    owner = relationship("User", back_populates="saved_chalets")
    trip_legs = relationship("TripLeg", back_populates="chalet")

# ==========================================
# TRIP PLANNER MODELS
# ==========================================

class Trip(Base):
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String, nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    status = Column(String, default="DRAFT")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    owner = relationship("User", back_populates="trips")
    legs = relationship("TripLeg", back_populates="trip", cascade="all, delete-orphan")

class TripLeg(Base):
    __tablename__ = "trip_legs"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    resort_id = Column(Integer, ForeignKey("resorts.id"), nullable=False)
    chalet_id = Column(Integer, ForeignKey("chalets.id"), nullable=True)
    
    arrival_date = Column(Date, nullable=True)
    departure_date = Column(Date, nullable=True)
    order_index = Column(Integer, default=0)

    trip = relationship("Trip", back_populates="legs")
    resort = relationship("Resort", back_populates="trip_legs")
    chalet = relationship("Chalet", back_populates="trip_legs")
    bucket_items = relationship("BucketListItem", secondary=trip_leg_bucket_items, back_populates="trip_legs", lazy="selectin")

# ==========================================
# LOGS & CACHE
# ==========================================

class InteractionLog(Base):
    __tablename__ = "interaction_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    chalet_id = Column(Integer, nullable=True) 
    action = Column(String, index=True) 
    reason = Column(Text, nullable=True)
    
    user = relationship("User", back_populates="interactions")

class ResortTelemetryCache(Base):
    __tablename__ = "resort_telemetry_cache"

    id = Column(Integer, primary_key=True, index=True)
    resort_name = Column(String, unique=True, index=True)
    telemetry_data = Column(JSON, nullable=False)
    source_urls = Column(JSON, nullable=False)
    
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class TrendingCache(Base):
    __tablename__ = "trending_cache"

    id = Column(Integer, primary_key=True, index=True)
    data = Column(JSON, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# --- NEW: BUCKET LIST ITEM MODEL ---
class BucketListItem(Base):
    __tablename__ = "bucket_list_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    resort_id = Column(Integer, ForeignKey("resorts.id", ondelete="SET NULL"), nullable=True)
    
    name = Column(String, nullable=False)
    logo = Column(String, default="🎯") # Emoji default
    description = Column(Text, nullable=True)
    url = Column(String, nullable=True)
    category = Column(String, nullable=True) # e.g., 'PISTE', 'APRES', 'DINING'
    
    # Relationships
    owner = relationship("User", back_populates="bucket_items")
    resort = relationship("Resort") # Optional direct link
    trip_legs = relationship("TripLeg", secondary=trip_leg_bucket_items, back_populates="bucket_items")

# --- NEW: CACHE MODELS ---
class NewsIntelCache(Base):
    __tablename__ = "news_intel_cache"
    id = Column(Integer, primary_key=True, index=True)
    resort_name = Column(String, unique=True, index=True)
    data = Column(JSON, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class AIBucketListCache(Base):
    __tablename__ = "ai_bucket_list_cache"
    id = Column(Integer, primary_key=True, index=True)
    resort_name = Column(String, unique=True, index=True)
    data = Column(JSON, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())