import os
import sys
import csv
import re

# Add the parent directory to the path so we can import 'app' modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine, Base
from app.models.domain import Resort

# Ensure tables are created
Base.metadata.create_all(bind=engine)

def clean_string(text):
    """Removes corrupted characters like '?' and trims whitespace."""
    if not text: return None
    # Replace standalone ? or weird encodings
    cleaned = re.sub(r'\?', '', text).strip()
    return cleaned if cleaned else None

def safe_float(val):
    try: return float(val)
    except (ValueError, TypeError): return None

def safe_int(val):
    try: return int(float(val)) # float() first handles cases like "43.0"
    except (ValueError, TypeError): return None

def safe_bool(val):
    if not val: return False
    return str(val).strip().lower() == "yes"

def seed_database_from_csv(csv_filepath="resorts.csv"):
    db = SessionLocal()
    try:
        if not os.path.exists(csv_filepath):
            print(f"❌ ERROR: Could not find {csv_filepath}")
            return

        added_count = 0
        skipped_count = 0

        with open(csv_filepath, mode='r', encoding='cp1252') as file:
            # DictReader automatically uses the first row as dictionary keys
            reader = csv.DictReader(file)
            
            for row in reader:
                # Clean the resort name
                raw_name = row.get("Resort", "")
                clean_name = clean_string(raw_name)
                if not clean_name:
                    continue
                
                # Check for duplicates
                existing = db.query(Resort).filter(Resort.name == clean_name).first()
                if existing:
                    skipped_count += 1
                    continue

                # Create the new record mapping the CSV headers to DB columns
                new_resort = Resort(
                    name=clean_name,
                    latitude=safe_float(row.get("Latitude")),
                    longitude=safe_float(row.get("Longitude")),
                    country=clean_string(row.get("Country")),
                    continent=clean_string(row.get("Continent")),
                    price=safe_float(row.get("Price")),
                    season=clean_string(row.get("Season")),
                    highest_point=safe_int(row.get("Highest point")),
                    lowest_point=safe_int(row.get("Lowest point")),
                    beginner_slopes=safe_int(row.get("Beginner slopes")),
                    intermediate_slopes=safe_int(row.get("Intermediate slopes")),
                    difficult_slopes=safe_int(row.get("Difficult slopes")),
                    total_slopes=safe_int(row.get("Total slopes")),
                    longest_run=safe_int(row.get("Longest run")),
                    snow_cannons=safe_int(row.get("Snow cannons")),
                    surface_lifts=safe_int(row.get("Surface lifts")),
                    chair_lifts=safe_int(row.get("Chair lifts")),
                    gondola_lifts=safe_int(row.get("Gondola lifts")),
                    total_lifts=safe_int(row.get("Total lifts")),
                    lift_capacity=safe_int(row.get("Lift capacity")),
                    child_friendly=safe_bool(row.get("Child friendly")),
                    snowparks=safe_bool(row.get("Snowparks")),
                    nightskiing=safe_bool(row.get("Nightskiing")),
                    summer_skiing=safe_bool(row.get("Summer skiing"))
                )
                db.add(new_resort)
                added_count += 1
                
        db.commit()
        print(f"✅ Seeding complete! Added {added_count} new resorts. Skipped {skipped_count} existing.")
        
    except Exception as e:
        print(f"❌ Error during CSV seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🏔️ Initializing CSV Resort Database Seeding...")
    seed_database_from_csv("resorts.csv")