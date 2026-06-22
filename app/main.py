import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .dependencies import lifespan, get_cache
from .routers import proxy, videos, categories, creators

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Reduce httpx logging noise (only show warnings/errors)
logging.getLogger("httpx").setLevel(logging.WARNING)

app = FastAPI(
    title=settings.app_name,
    description="API for scraping and streaming xHamster content",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(proxy.router)
app.include_router(videos.router)
app.include_router(categories.router)
app.include_router(creators.router)


@app.get("/")
async def home():
    """Home endpoint."""
    return {"status": "success", "message": f"{settings.app_name} is running!"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/api/clear-cache")
async def clear_cache():
    """Clear all cached responses."""
    try:
        cache = get_cache()
        cache.clear()
        return {"status": "success", "message": "Cache cleared successfully!"}
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
        return {"status": "error", "message": str(e)}


@app.options("/api/{path:path}")
async def options_handler(path: str):
    """Explicit OPTIONS handler for CORS preflight."""
    return {
        "status": "ok",
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    }
