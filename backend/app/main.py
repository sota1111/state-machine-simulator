from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
import sys

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

APP_ENV = os.getenv("APP_ENV", "local")

# Conditional imports based on environment
if APP_ENV == "production":
    from .routers import models_firestore as models_router
    # In production, we don't use SQLite/SQLAlchemy Base/engine here
    Base = None
    SessionLocal = None
else:
    from .database import engine, Base, SessionLocal
    from .routers import models as models_router
    from .seed import seed_sample_data
    # Create database tables for local development
    Base.metadata.create_all(bind=engine)

from .routers import simulate, parse

app = FastAPI(title="State Machine Simulator API", version="1.0.0")

CORS_ORIGINS_STR = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
CORS_ORIGINS = CORS_ORIGINS_STR.split(",") if APP_ENV != "production" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=APP_ENV != "production",
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(models_router.router, prefix="/api")
app.include_router(simulate.router, prefix="/api")
app.include_router(parse.router, prefix="/api")

@app.on_event("startup")
async def startup_event():
    if APP_ENV != "production":
        db = SessionLocal()
        try:
            seed_sample_data(db)
            logger.info("Sample data seeded successfully")
        except Exception as e:
            logger.error(f"Failed to seed sample data: {e}")
        finally:
            db.close()
    else:
        logger.info(f"Running in production mode (APP_ENV=production). Skipping SQLite seed.")
        # Verify Firestore connection
        try:
            sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            from firestore_client import get_firestore_client
            get_firestore_client()
            logger.info("Firestore connection verified")
        except Exception as e:
            logger.error(f"Firestore connection failed: {e}")

@app.get("/health")
def health_check():
    return {"status": "ok"}
