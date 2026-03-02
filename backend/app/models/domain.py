from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text, JSON, DateTime, Date
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class Resort(Base):
    __tablename__ = "resorts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    country = Column(String, index=True, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    # Relationships
    trip_legs = relationship("TripLeg", back_populates="resort")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    personality_summary = Column(Text, nullable=True)
    
    # Relationships
    saved_chalets = relationship("Chalet", back_populates="owner")
    interactions = relationship("InteractionLog", back_populates="user")
    trips = relationship("Trip", back_populates="owner") # NEW

# Renamed from SavedChalet to Chalet for broader use
class Chalet(Base):
    __tablename__ = "chalets" # Changed table name

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
    trip_legs = relationship("TripLeg", back_populates="chalet") # NEW

# ==========================================
# NEW: TRIP PLANNER MODELS
# ==========================================

class Trip(Base):
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Assuming guest mode initially
    name = Column(String, nullable=False) # e.g., "Alps Mega Tour 2026"
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    status = Column(String, default="DRAFT") # DRAFT, BOOKED, COMPLETED
    
    # Automatically tracks when the record was created/updated
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    owner = relationship("User", back_populates="trips")
    legs = relationship("TripLeg", back_populates="trip", cascade="all, delete-orphan") # If trip deleted, delete legs

class TripLeg(Base):
    """
    Junction table. A trip can have multiple stops (legs). 
    Each leg connects the Trip to a Resort, and optionally, a Chalet.
    """
    __tablename__ = "trip_legs"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    resort_id = Column(Integer, ForeignKey("resorts.id"), nullable=False)
    chalet_id = Column(Integer, ForeignKey("chalets.id"), nullable=True) # They might plan a resort without a booked chalet yet
    
    arrival_date = Column(Date, nullable=True)
    departure_date = Column(Date, nullable=True)
    order_index = Column(Integer, default=0) # e.g., 1st stop, 2nd stop

    # Relationships
    trip = relationship("Trip", back_populates="legs")
    resort = relationship("Resort", back_populates="trip_legs")
    chalet = relationship("Chalet", back_populates="trip_legs")

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