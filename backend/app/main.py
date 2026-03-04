from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import router as api_router
from app.database import engine
from app.models.domain import Base

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SkiGem Orchestra API",
    description="Multi-agent AI backend for finding hidden winter sports gems.",
    version="1.0.0",
)

# Configure CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include our API routes
app.include_router(api_router, prefix="/api")

@app.get("/")
def health_check():
    return {"status": "orchestra is tuning up 🎻"}