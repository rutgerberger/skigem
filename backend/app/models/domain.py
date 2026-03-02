from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text, JSON, DateTime
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

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    personality_summary = Column(Text, nullable=True)
    
    # Relationships
    saved_chalets = relationship("SavedChalet", back_populates="owner")
    interactions = relationship("InteractionLog", back_populates="user")

class SavedChalet(Base):
    __tablename__ = "saved_chalets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    resort_name = Column(String, index=True)
    chalet_name = Column(String)
    village = Column(String, nullable=True)
    url = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    price_per_night = Column(Float, nullable=True)
    distance_to_lift_m = Column(Integer, nullable=True)
    
    # Relationships
    owner = relationship("User", back_populates="saved_chalets")

class InteractionLog(Base):
    __tablename__ = "interaction_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    chalet_id = Column(Integer, nullable=True) # Can link to SavedChalet ID or an external ID
    action = Column(String, index=True) # "saved", "thumbs_up", "thumbs_down"
    reason = Column(Text, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="interactions")

# ==========================================
# SYSTEM CACHE: TELEMETRY
# ==========================================
class ResortTelemetryCache(Base):
    __tablename__ = "resort_telemetry_cache"

    id = Column(Integer, primary_key=True, index=True)
    resort_name = Column(String, unique=True, index=True)  # Strictly using ALLOWED_SKI_AREAS
    telemetry_data = Column(JSON, nullable=False)          # Stores the parsed LLM dictionary
    source_urls = Column(JSON, nullable=False)             # Stores the list of URLs from Tavily
    
    # Automatically tracks when the record was created, and updates the timestamp whenever the row is modified
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())