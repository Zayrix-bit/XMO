import logging
import re
from typing import Optional
from urllib.parse import quote, urlparse
from fastapi import APIRouter, Query, Request
from bs4 import BeautifulSoup

from ..config import settings
from ..utils import fetch_with_fallback, extract_page_data, format_views, parse_video_list
from ..dependencies import get_http_client, get_cache

router = APIRouter(prefix="/api", tags=["videos"])
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


@router.get("/video")
async def get_video_stream(url: str = Query(..., description="Full xHamster video URL")):
    """Get video details and stream URLs."""
    try:
        cache = get_cache()
        cache_key = f"video:{url}"
        cached_value = cache.get(cache_key)
        if cached_value is not None:
            return cached_value

        http_client = get_http_client()
        response = await http_client.get(url, headers=HEADERS)
        response.raise_for_status()
        
        html = response.text
        soup = BeautifulSoup(html, 'html.parser')
        
        page_data = extract_page_data(html)
        
        title_tag = soup.select_one('h1.with-player-container')
        if not title_tag:
            title_tag = soup.select_one('h1')
        video_title = title_tag.text.strip() if title_tag else 'Untitled Video'
        
        views = None
        uploader = None
        if page_data:
            for view_key in ['videoModel', 'videoEntity', 'videoHeadingComponent', 'videoTitle']:
                if view_key in page_data and 'views' in page_data[view_key]:
                    views_raw = page_data[view_key]['views']
                    views = format_views(views_raw)
                    break
            
            if 'videoModel' in page_data and 'author' in page_data['videoModel']:
                author = page_data['videoModel']['author']
                landing = page_data['videoModel'].get('landing', {}) if 'landing' in page_data['videoModel'] else {}
                uploader = {
                    'name': landing.get('name') or author.get('name'),
                    'username': author.get('name'),
                    'avatar': landing.get('logo') or '',
                    'profile_url': landing.get('link') or author.get('pageURL')
                }
        
        related = parse_video_list(html)
        
        m3u8_pattern = r'https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*'
        mp4_pattern = r'https?://[^\s"\'<>]+\.mp4[^\s"\'<>]*'
        
        m3u8_links = list(set(re.findall(m3u8_pattern, html)))
        all_mp4_links = list(set(re.findall(mp4_pattern, html)))
        
        mp4_links = [u for u in all_mp4_links if '.m3u8' not in u and 'thumb' not in u]
        
        quality_mp4s = [u for u in mp4_links if any(q in u for q in ['1080p', '720p', '480p', '240p'])]
        
        direct_url = None
        if quality_mp4s:
            for q in ['1080p', '720p', '480p', '240p']:
                match = [u for u in quality_mp4s if q in u]
                if match:
                    direct_url = match[0]
                    break
        elif mp4_links:
            direct_url = mp4_links[0]
        
        proxy_url = None
        if direct_url:
            proxy_url = f"/api/proxy?url={quote(direct_url, safe='')}"
        
        hls_proxy_url = None
        if m3u8_links:
            hls_proxy_url = f"/api/hls-proxy?url={quote(m3u8_links[0], safe='')}"
        
        parsed_original = urlparse(url)
        original_domain = parsed_original.netloc
        
        result = {
            "status": "success",
            "title": video_title,
            "views": views,
            "uploader": uploader,
            "direct_url": direct_url,
            "proxy_url": proxy_url,
            "hls_proxy_url": hls_proxy_url,
            "related": related,
            "streams": {
                "m3u8": m3u8_links,
                "mp4": mp4_links
            },
            "original_url": url,
            "original_domain": original_domain
        }
        
        cache.set(cache_key, result, expire=600)
        
        return result
    except Exception as e:
        logger.error(f"Error getting video: {e}")
        return {"status": "error", "message": str(e)}


@router.get("/search")
async def search_videos(q: str = Query(..., description="Search query"), page: int = Query(1, description="Page number")):
    """Search for videos."""
    try:
        cache = get_cache()
        cache_key = f"search:{q}:{page}"
        cached_value = cache.get(cache_key)
        if cached_value is not None:
            return cached_value

        http_client = get_http_client()
        query_encoded = q.replace(" ", "+")
        path = f"/search/{query_encoded}"
        if page > 1:
            path += f"?page={page}"
        response_text, domain = await fetch_with_fallback(
            path,
            http_client,
            HEADERS,
            settings.xhamster_domains
        )
        
        if not response_text:
            return {"status": "error", "message": "No working xHamster domain found!"}
        
        videos = parse_video_list(response_text)
        
        result = {"status": "success", "query": q, "page": page, "results": videos, "used_domain": domain}
        
        cache.set(cache_key, result, expire=settings.cache_ttl_seconds)
        
        return result
    except Exception as e:
        logger.error(f"Error searching videos: {e}")
        return {"status": "error", "message": str(e)}


@router.get("/trending")
async def trending_videos(page: int = Query(1, description="Page number")):
    """Get trending videos."""
    try:
        cache = get_cache()
        cache_key = f"trending:{page}"
        cached_value = cache.get(cache_key)
        if cached_value is not None:
            return cached_value

        http_client = get_http_client()
        if page == 1:
            path = "/"
        else:
            path = f"/best/monthly/{page}"
        response_text, domain = await fetch_with_fallback(
            path,
            http_client,
            HEADERS,
            settings.xhamster_domains
        )
        
        if not response_text:
            return {"status": "error", "message": "No working xHamster domain found!"}
        
        videos = parse_video_list(response_text)
        
        result = {"status": "success", "page": page, "results": videos, "used_domain": domain}
        
        cache.set(cache_key, result, expire=10)
        
        return result
    except Exception as e:
        logger.error(f"Error getting trending videos: {e}")
        return {"status": "error", "message": str(e)}


@router.get("/newest")
async def newest_videos(page: int = Query(1, description="Page number")):
    """Get newest videos."""
    try:
        cache = get_cache()
        cache_key = f"newest:{page}"
        cached_value = cache.get(cache_key)
        if cached_value is not None:
            return cached_value

        http_client = get_http_client()
        response_text, domain = await fetch_with_fallback(
            f"/newest/{page}",
            http_client,
            HEADERS,
            settings.xhamster_domains
        )
        
        if not response_text:
            return {"status": "error", "message": "No working xHamster domain found!"}
        
        videos = parse_video_list(response_text)
        
        result = {"status": "success", "page": page, "results": videos, "used_domain": domain}
        
        cache.set(cache_key, result, expire=10)
        
        return result
    except Exception as e:
        logger.error(f"Error getting newest videos: {e}")
        return {"status": "error", "message": str(e)}
