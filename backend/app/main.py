from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import logging
import os

from .dependencies import get_current_user
from .routers import auth as auth_router
from .routers import models as models_router
from .routers import simulate, parse, review

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

APP_ENV = os.getenv("APP_ENV", "local")

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
app.include_router(review.router, prefix="/api", dependencies=[Depends(get_current_user)])

def _check_auth_config():
    """Log each missing auth setting distinctly at startup so that
    misconfiguration is visible in Cloud Run logs at boot time."""
    firebase_api_key = os.getenv("FIREBASE_WEB_API_KEY") or os.getenv("FIREBASE_API_KEY")
    auth_secret = os.getenv("AUTH_SECRET")
    allowed_emails = os.getenv("ALLOWED_USER_EMAILS")
    missing = False
    if not firebase_api_key:
        logger.warning("FIREBASE_WEB_API_KEY / FIREBASE_API_KEY not configured")
        missing = True
    if not auth_secret:
        logger.warning("AUTH_SECRET not configured")
        missing = True
    if not allowed_emails:
        logger.warning("ALLOWED_USER_EMAILS not configured")
        missing = True
    if not missing:
        logger.info("auth config OK")


@app.on_event("startup")
async def startup_event():
    _check_auth_config()
    if APP_ENV != "production":
        from .repositories.memory_repository import get_memory_repository
        from .data.sample_state_machines import SAMPLE_STATE_MACHINES
        try:
            added = get_memory_repository().seed_samples(SAMPLE_STATE_MACHINES)
            logger.info(f"Seeded {added} sample state machines into in-memory store")
        except Exception as e:
            logger.error(f"Failed to seed in-memory sample data: {e}")
    else:
        logger.info("Running in production mode (APP_ENV=production). Using Firestore persistence.")
        from .seed import seed_firestore_samples
        try:
            count = seed_firestore_samples()
            if count:
                logger.info(f"Seeded {count} sample state machines into Firestore")
            else:
                logger.info("Firestore samples already present; skipping seed")
        except Exception as e:
            logger.error(f"Failed to seed Firestore samples: {e}")

@app.get("/health")
def health_check():
    return {"status": "ok"}
