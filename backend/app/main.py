from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import logging
import os

from .dependencies import get_current_user
from .routers import auth as auth_router
from .routers import models as models_router
from .routers import simulate, parse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

APP_ENV = os.getenv("APP_ENV", "local")

# Setup based on environment
if APP_ENV != "production":
    from .database import engine, Base
    from .seed import seed_sample_data
    # Create database tables for local development
    Base.metadata.create_all(bind=engine)

app = FastAPI(title="State Machine Simulator API", version="1.0.0")

CORS_ORIGINS_STR = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
CORS_ORIGINS = CORS_ORIGINS_STR.split(",") if APP_ENV != "production" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/api")
app.include_router(models_router.router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(simulate.router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(parse.router, prefix="/api", dependencies=[Depends(get_current_user)])

@app.on_event("startup")
async def startup_event():
    if APP_ENV != "production":
        from .database import SessionLocal
        db = SessionLocal()
        try:
            seed_sample_data(db)
            logger.info("Sample data seeded successfully")
        except Exception as e:
            logger.error(f"Failed to seed sample data: {e}")
        finally:
            db.close()
    else:
        logger.info("Running in production mode (APP_ENV=production). Skipping SQLite seed.")

@app.get("/health")
def health_check():
    return {"status": "ok"}
