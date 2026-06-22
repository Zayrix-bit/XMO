import logging
from typing import Optional
from fastapi import APIRouter, Query

from ..config import settings
from ..utils import fetch_with_fallback, extract_page_data, format_views, parse_video_list
from ..dependencies import get_http_client, get_cache

router = APIRouter(prefix="/api", tags=["creators"])
logger = logging.getLogger(__name__)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://xhamster.com/',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Cache-Control': 'max-age=0',
    'Upgrade-Insecure-Requests': '1'
}


@router.get("/creator/{creator_slug}")
async def get_creator_videos(creator_slug: str, page: int = Query(1, description="Page number")):
    """Get creator profile and videos."""
    try:
        cache = get_cache()
        cache_key = f"creator:{creator_slug}:{page}"
        cached_value = cache.get(cache_key)
        if cached_value is not None:
            return cached_value

        http_client = get_http_client()
        path = f"/creators/{creator_slug}"
        if page > 1:
            path += f"/{page}"
        response_text, domain = await fetch_with_fallback(
            path,
            http_client,
            HEADERS,
            settings.xhamster_domains
        )
        
        if not response_text:
            path = f"/users/{creator_slug}"
            if page > 1:
                path += f"/{page}"
            response_text, domain = await fetch_with_fallback(
                path,
                http_client,
                HEADERS,
                settings.xhamster_domains
            )
        
        if not response_text:
            return {"status": "error", "message": "Could not fetch creator profile"}
        
        page_data = extract_page_data(response_text)
        creator = None
        videos = []
        if page_data:
            if 'infoComponent' in page_data and 'pornstarTop' in page_data['infoComponent']:
                pornstar_top = page_data['infoComponent']['pornstarTop']
                creator = {
                    'name': pornstar_top.get('name'),
                    'avatar': pornstar_top.get('thumbURL'),
                    'country': pornstar_top.get('country'),
                    'translatedCountryName': pornstar_top.get('translatedCountryName'),
                    'viewsCount': format_views(pornstar_top.get('viewsCount', 0)),
                    'videoCount': pornstar_top.get('videoCount'),
                    'rating': pornstar_top.get('rating'),
                    'subscribers': None
                }
                if ('subscribeButtonsProps' in page_data['infoComponent'] and
                    'subscribeButtonProps' in page_data['infoComponent']['subscribeButtonsProps']):
                    creator['subscribers'] = page_data['infoComponent']['subscribeButtonsProps']['subscribeButtonProps'].get('subscribers')
            
            videos = parse_video_list(page_data)
        
        result = {
            "status": "success",
            "creator": creator,
            "videos": videos,
            "page": page,
            "used_domain": domain
        }
        
        cache.set(cache_key, result, expire=settings.cache_ttl_seconds)
        
        return result
    except Exception as e:
        logger.error(f"Error getting creator: {e}")
        return {"status": "error", "message": str(e)}
