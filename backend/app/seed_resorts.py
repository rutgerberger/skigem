import os
import sys

# Add the parent directory to the path so we can import 'app' modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine, Base
from app.models.domain import Resort

# We ensure the tables are created before seeding
Base.metadata.create_all(bind=engine)

# This is the master list we are porting into the database.
# You can add the rest of your frontend list here.
SKI_AREAS_TO_SEED = [
  { "name": "Les Trois Vallées, France", "lat": 45.3214, "lon": 6.5785 },
  { "name": "Paradiski, France", "lat": 45.5539, "lon": 6.7773 },
  { "name": "Tignes-Val d'Isère, France", "lat": 45.4678, "lon": 6.9749 },
  { "name": "Les Portes du Soleil, France", "lat": 46.1833, "lon": 6.7833 },
  { "name": "Grand Massif, France", "lat": 46.0076, "lon": 6.6669 },
  { "name": "Chamonix Valley, France", "lat": 45.9237, "lon": 6.8694 },
  { "name": "Alpe d'Huez Grand Domaine, France", "lat": 45.0905, "lon": 6.0645 },
  { "name": "Les Deux Alpes, France", "lat": 45.0094, "lon": 6.1228 },
  { "name": "Serre Chevalier, France", "lat": 44.9333, "lon": 6.5667 },
  { "name": "Évasion Mont-Blanc, France", "lat": 45.8500, "lon": 6.6167 },
  { "name": "Massif des Aravis, France", "lat": 45.9069, "lon": 6.4258 },
  { "name": "Les Sybelles, France", "lat": 45.2422, "lon": 6.2575 },
  { "name": "Galibier-Thabor, France", "lat": 45.1667, "lon": 6.4333 },
  { "name": "Espace San Bernardo, France/Italy", "lat": 45.6267, "lon": 6.8483 },
  { "name": "Espace Diamant, France", "lat": 45.7592, "lon": 6.5369 },
  { "name": "Le Grand Domaine, France", "lat": 45.4619, "lon": 6.4422 },
  { "name": "La Forêt Blanche, France", "lat": 44.5958, "lon": 6.6869 },
  { "name": "Val Cenis Vanoise, France", "lat": 45.2753, "lon": 6.9011 },
  { "name": "Espace Lumière, France", "lat": 44.3333, "lon": 6.6000 },
  { "name": "Les Sept Laux, France", "lat": 45.2833, "lon": 6.0500 },
  { "name": "Dévoluy, France", "lat": 44.6853, "lon": 5.9286 },
  { "name": "Isola 2000, France", "lat": 44.1856, "lon": 7.1594 },
  { "name": "Auron, France", "lat": 44.2269, "lon": 6.9286 },
  { "name": "Les Orres, France", "lat": 44.4931, "lon": 6.5528 },
  { "name": "Sainte-Foy-Tarentaise, France", "lat": 45.5892, "lon": 6.8839 },
  { "name": "Ski Arlberg, Austria", "lat": 47.1296, "lon": 10.2681 },
  { "name": "Skicircus Saalbach-Hinterglemm, Austria", "lat": 47.3914, "lon": 12.6397 },
  { "name": "Zillertal Arena, Austria", "lat": 47.2300, "lon": 11.8800 },
  { "name": "Mayrhofen (Mountopolis), Austria", "lat": 47.1667, "lon": 11.8667 },
  { "name": "SkiWelt Wilder Kaiser-Brixental, Austria", "lat": 47.4500, "lon": 12.2167 },
  { "name": "KitzSki, Austria", "lat": 47.4464, "lon": 12.3923 },
  { "name": "Zell am See-Kaprun, Austria", "lat": 47.3233, "lon": 12.7961 },
  { "name": "Ötztal Valley (Sölden & Obergurgl), Austria", "lat": 46.9667, "lon": 11.0000 },
  { "name": "Silvretta Arena, Austria", "lat": 47.0094, "lon": 10.2925 },
  { "name": "Serfaus-Fiss-Ladis, Austria", "lat": 47.0375, "lon": 10.6075 },
  { "name": "Schladming-Dachstein, Austria", "lat": 47.3933, "lon": 13.6875 },
  { "name": "Gastein Valley, Austria", "lat": 47.1167, "lon": 13.1000 },
  { "name": "Obertauern, Austria", "lat": 47.2483, "lon": 13.5594 },
  { "name": "Montafon-Brandnertal, Austria", "lat": 47.0781, "lon": 9.9233 },
  { "name": "Ski Juwel Alpbachtal Wildschönau, Austria", "lat": 47.3986, "lon": 11.9442 },
  { "name": "Hochzillertal-Hochfügen, Austria", "lat": 47.2917, "lon": 11.8711 },
  { "name": "Stubai Glacier, Austria", "lat": 46.9806, "lon": 11.1158 },
  { "name": "Grossglockner Resort Kals-Matrei, Austria", "lat": 47.0019, "lon": 12.5408 },
  { "name": "Nassfeld, Austria", "lat": 46.5647, "lon": 13.2750 },
  { "name": "Bad Kleinkirchheim, Austria", "lat": 46.8144, "lon": 13.7917 },
  { "name": "Snow Space Salzburg, Austria", "lat": 47.3467, "lon": 13.3917 },
  { "name": "Wildkogel-Arena, Austria", "lat": 47.2558, "lon": 12.3242 },
  { "name": "Dachstein West, Austria", "lat": 47.5819, "lon": 13.5283 },
  { "name": "Pitztal Glacier & Rifflsee, Austria", "lat": 46.9208, "lon": 10.8667 },
  { "name": "Kaunertal Glacier, Austria", "lat": 46.8647, "lon": 10.7144 },
  { "name": "Turracher Höhe, Austria", "lat": 46.9189, "lon": 13.8744 },
  { "name": "Tauplitz, Austria", "lat": 47.5619, "lon": 13.9961 },
  { "name": "Les 4 Vallées, Switzerland", "lat": 46.1000, "lon": 7.2833 },
  { "name": "Matterhorn Ski Paradise, Switzerland/Italy", "lat": 46.0207, "lon": 7.7491 },
  { "name": "Jungfrau Region, Switzerland", "lat": 46.6025, "lon": 7.9575 },
  { "name": "St. Moritz (Engadin), Switzerland", "lat": 46.4908, "lon": 9.8355 },
  { "name": "Davos Klosters, Switzerland", "lat": 46.8000, "lon": 9.8333 },
  { "name": "Arosa Lenzerheide, Switzerland", "lat": 46.7500, "lon": 9.6000 },
  { "name": "Flims Laax Falera, Switzerland", "lat": 46.8333, "lon": 9.2833 },
  { "name": "Andermatt-Sedrun-Disentis, Switzerland", "lat": 46.6333, "lon": 8.5833 },
  { "name": "Gstaad Mountain Rides, Switzerland", "lat": 46.4736, "lon": 7.2861 },
  { "name": "Crans-Montana, Switzerland", "lat": 46.3114, "lon": 7.4789 },
  { "name": "Saas-Fee (Saastal), Switzerland", "lat": 46.1097, "lon": 7.9292 },
  { "name": "Val d'Anniviers, Switzerland", "lat": 46.1706, "lon": 7.5817 },
  { "name": "Aletsch Arena, Switzerland", "lat": 46.3833, "lon": 8.0333 },
  { "name": "Engelberg-Titlis, Switzerland", "lat": 46.8200, "lon": 8.4028 },
  { "name": "Toggenburg, Switzerland", "lat": 47.2000, "lon": 9.2667 },
  { "name": "Flumserberg, Switzerland", "lat": 47.0931, "lon": 9.2842 },
  { "name": "Villars-Gryon-Diablerets, Switzerland", "lat": 46.3000, "lon": 7.0500 },
  { "name": "Leysin-Les Mosses-La Lécherette, Switzerland", "lat": 46.3431, "lon": 7.0125 },
  { "name": "Meiringen-Hasliberg, Switzerland", "lat": 46.7381, "lon": 8.2047 },
  { "name": "Scuol (Motta Naluns), Switzerland", "lat": 46.7958, "lon": 10.2978 },
  { "name": "Savognin, Switzerland", "lat": 46.5969, "lon": 9.6000 },
  { "name": "Splügen-Tambo, Switzerland", "lat": 46.5536, "lon": 9.3242 },
  { "name": "Melchsee-Frutt, Switzerland", "lat": 46.7728, "lon": 8.2711 },
  { "name": "Grächen, Switzerland", "lat": 46.1953, "lon": 7.8394 },
  { "name": "Val Gardena-Alpe di Siusi, Italy", "lat": 46.5560, "lon": 11.7248 },
  { "name": "Alta Badia, Italy", "lat": 46.5500, "lon": 11.9000 },
  { "name": "3 Zinnen Dolomites, Italy", "lat": 46.7111, "lon": 12.3553 },
  { "name": "Cortina d'Ampezzo, Italy", "lat": 46.5405, "lon": 12.1357 },
  { "name": "Val di Fassa-Carezza, Italy", "lat": 46.4278, "lon": 11.6853 },
  { "name": "Kronplatz (Plan de Corones), Italy", "lat": 46.7383, "lon": 11.9583 },
  { "name": "Via Lattea (Milky Way), Italy", "lat": 44.9500, "lon": 6.8333 },
  { "name": "Skirama Dolomiti, Italy", "lat": 46.2294, "lon": 10.8267 },
  { "name": "Monterosa Ski, Italy", "lat": 45.8333, "lon": 7.8000 },
  { "name": "Livigno, Italy", "lat": 46.5386, "lon": 10.1356 },
  { "name": "Bormio, Italy", "lat": 46.4667, "lon": 10.3667 },
  { "name": "Courmayeur Mont Blanc, Italy", "lat": 45.7969, "lon": 6.9689 },
  { "name": "Passo Tonale-Ponte di Legno, Italy", "lat": 46.2589, "lon": 10.5847 },
  { "name": "Alpe Cimbra, Italy", "lat": 45.9167, "lon": 11.1667 },
  { "name": "Val di Fiemme-Obereggen, Italy", "lat": 46.2833, "lon": 11.4667 },
  { "name": "Valle Isarco (Eisacktal), Italy", "lat": 46.7167, "lon": 11.6500 },
  { "name": "Civetta, Italy", "lat": 46.3833, "lon": 12.0167 },
  { "name": "San Martino di Castrozza, Italy", "lat": 46.2625, "lon": 11.8011 },
  { "name": "Bardonecchia, Italy", "lat": 45.0833, "lon": 6.7000 },
  { "name": "Pila, Italy", "lat": 45.6922, "lon": 7.3111 },
  { "name": "Madesimo (Valchiavenna), Italy", "lat": 46.4278, "lon": 9.3458 },
  { "name": "Tarvisio, Italy", "lat": 46.5056, "lon": 13.5786 },
  { "name": "Piancavallo, Italy", "lat": 46.1089, "lon": 12.5186 }
]

def seed_database():
    db = SessionLocal()
    try:
        added_count = 0
        for area in SKI_AREAS_TO_SEED:
            # Check if it already exists to avoid duplicate errors
            existing_resort = db.query(Resort).filter(Resort.name == area["name"]).first()
            
            if not existing_resort:
                # Extract country from the name (e.g., "Chamonix, France" -> "France")
                country = None
                if "," in area["name"]:
                    country = area["name"].split(",")[-1].strip()

                new_resort = Resort(
                    name=area["name"],
                    country=country,
                    latitude=area["lat"],
                    longitude=area["lon"]
                )
                db.add(new_resort)
                added_count += 1
                
        db.commit()
        print(f"✅ Seeding complete! Added {added_count} new resorts to the database.")
        
    except Exception as e:
        print(f"❌ Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🏔️ Initializing Resort Database Seeding...")
    seed_database()