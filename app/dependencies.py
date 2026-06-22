import httpx
import diskcache
from typing import AsyncGenerator
from contextlib import asynccontextmanager
from fastapi import FastAPI
from .config import settings

# Global cache instance
cache = diskcache.Cache(settings.cache_dir)

# Global HTTP client
http_client: httpx.AsyncClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application lifespan: initialize and clean up resources."""
    global http_client
    # Initialize HTTP client
    http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(15.0),
        follow_redirects=True,
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=100)
    )
    yield
    # Cleanup
    if http_client:
        await http_client.aclose()


def get_http_client() -> httpx.AsyncClient:
    """Get the global HTTP client instance."""
    if http_client is None:
        raise RuntimeError("HTTP client not initialized")
    return http_client


def get_cache() -> diskcache.Cache:
    """Get the global cache instance."""
    return cache
