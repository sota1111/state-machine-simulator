from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base, SessionLocal
from .routers import models, simulate, parse
from .seed import seed_sample_data
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="State Machine Simulator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(models.router, prefix="/api")
app.include_router(simulate.router, prefix="/api")
app.include_router(parse.router, prefix="/api")

@app.on_event("startup")
async def startup_event():
    db = SessionLocal()
    try:
        seed_sample_data(db)
        logger.info("Sample data seeded successfully")
    except Exception as e:
        logger.error(f"Failed to seed sample data: {e}")
    finally:
        db.close()

@app.get("/health")
def health_check():
    return {"status": "ok"}
