from fastapi import APIRouter

# Import the modular routers
from app.routers import users, trips, search, telemetry, intel

router = APIRouter()

# Attach all the modular routes to this main router
router.include_router(users.router)
router.include_router(trips.router)
router.include_router(search.router)
router.include_router(telemetry.router)
router.include_router(intel.router)