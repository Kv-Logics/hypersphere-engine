import os
import logging
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app.config import settings
from app.db.database import database, init_db
from app.api.endpoints import router as api_router

# Resolve path to frontend directory (works both in development and inside Docker)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(BASE_DIR))
frontend_dir = os.path.join(PROJECT_ROOT, "frontend")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    logger.info("Starting up database and vector index...")
    await init_db()
    await database.connect()
    
    # Run dynamic calibration of EMBEDDING_QUALITY_THRESHOLD (Fix 6)
    try:
        rows = await database.fetch_all("SELECT raw_norm FROM face_embeddings WHERE raw_norm IS NOT NULL")
        if len(rows) >= 10:
            norms = [float(r["raw_norm"]) for r in rows]
            mean_norm = sum(norms) / len(norms)
            import math
            variance = sum((x - mean_norm) ** 2 for x in norms) / len(norms)
            std_norm = math.sqrt(variance)
            calibrated_threshold = mean_norm - 2.0 * std_norm
            # Clamp the threshold between 5.0 and 15.0 to keep checks in safe bounds
            calibrated_threshold = max(5.0, min(15.0, calibrated_threshold))
            settings.EMBEDDING_QUALITY_THRESHOLD = calibrated_threshold
            logger.info(f"Calibrated EMBEDDING_QUALITY_THRESHOLD: {settings.EMBEDDING_QUALITY_THRESHOLD:.3f} (based on {len(norms)} norms, mean: {mean_norm:.3f}, std: {std_norm:.3f})")
        else:
            logger.info(f"Not enough registered embeddings for calibration (found {len(rows)}, need at least 10). Using default threshold: {settings.EMBEDDING_QUALITY_THRESHOLD}")
    except Exception as e:
        logger.error(f"Failed to calibrate embedding quality threshold during startup: {e}")
    
    # Run CSV User Seeding
    try:
        from app.core.csv_loader import seed_users_from_csv
        await seed_users_from_csv(PROJECT_ROOT)
        
        # Promote testing users (1, 2, kv, nila) to admin role
        from app.db.database import faculty
        query = faculty.update().where(faculty.c.id.in_(["1", "2", "kv", "nila"])).values(role="admin")
        await database.execute(query)
        logger.info("Promoted testing users (1, 2, kv, nila) to admin role.")
    except Exception as e:
        logger.error(f"Failed to seed users or promote testing users during startup: {e}", exc_info=True)
        
    yield
    # Shutdown actions
    logger.info("Shutting down database...")
    await database.disconnect()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# CORS middleware config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Embed a gorgeous UI dashboard for direct testing and visualization
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
