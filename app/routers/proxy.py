import logging
import re
from typing import Optional
from urllib.parse import quote, urlparse
from fastapi import APIRouter, Request, Query
from fastapi.responses import StreamingResponse, Response
import httpx

from ..config import settings
from ..dependencies import get_http_client

router = APIRouter(prefix="/api", tags=["proxy"])
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


@router.get("/proxy", response_model=None)
async def proxy_video(
    url: str = Query(..., description="Direct MP4/M3U8 URL to proxy"),
    request: Request = None
):
    """Proxy the video stream with correct Referer header to bypass CDN 403 blocks."""
    try:
        referer_domain = 'xhamster.desi'
        for domain in settings.xhamster_domains:
            if domain in url:
                referer_domain = domain
                break
                
        proxy_headers = {
            **HEADERS,
            'Referer': f'https://{referer_domain}/',
            'Origin': f'https://{referer_domain}',
        }
        
        if request and 'range' in request.headers:
            proxy_headers['Range'] = request.headers['range']
        
        http_client = get_http_client()
        response_context = http_client.stream('GET', url, headers=proxy_headers)
        r = await response_context.__aenter__()
        r.raise_for_status()
        
        response_headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        }
        
        for header in ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'Cache-Control']:
            if header in r.headers:
                response_headers[header] = r.headers[header]
        
        async def stream_generator():
            try:
                async for chunk in r.aiter_bytes(chunk_size=1024 * 256):
                    yield chunk
            finally:
                await response_context.__aexit__(None, None, None)
        
        return StreamingResponse(
            stream_generator(),
            status_code=r.status_code,
            media_type=response_headers.get('Content-Type', 'video/mp4'),
            headers=response_headers
        )
    except Exception as e:
        logger.error(f"Proxy error: {e}")
        return {"status": "error", "message": str(e)}


@router.get("/hls-proxy", response_model=None)
async def hls_proxy(
    url: str = Query(..., description="M3U8 URL to proxy with URL rewriting"),
    request: Request = None
):
    """Proxy M3U8 playlists and rewrite internal URLs to also go through our proxy."""
    try:
        referer_domain = 'xhamster.desi'
        for domain in settings.xhamster_domains:
            if domain in url:
                referer_domain = domain
                break
                
        proxy_headers = {
            **HEADERS,
            'Referer': f'https://{referer_domain}/',
            'Origin': f'https://{referer_domain}',
        }
        
        http_client = get_http_client()
        response = await http_client.get(url, headers=proxy_headers)
        response.raise_for_status()
        
        content = response.text
        content_type = response.headers.get('Content-Type', 'application/vnd.apple.mpegurl')
        
        if '.m3u8' in url or 'mpegurl' in content_type.lower() or content.strip().startswith('#EXTM3U'):
            base_url = url.rsplit('/', 1)[0] + '/'
            
            rewritten_lines = []
            for line in content.splitlines():
                line = line.strip()
                if not line or line.startswith('#'):
                    if 'URI="' in line:
                        uri_match = re.search(r'URI="([^"]+)"', line)
                        if uri_match:
                            orig_uri = uri_match.group(1)
                            if not orig_uri.startswith('http'):
                                orig_uri = base_url + orig_uri
                            proxied = f"/api/hls-proxy?url={quote(orig_uri, safe='')}"
                            if request:
                                scheme = request.url.scheme
                                host = request.headers.get('host', 'localhost:8000')
                                line = line.replace(uri_match.group(0), f'URI="{scheme}://{host}{proxied}"')
                            else:
                                line = line.replace(uri_match.group(0), f'URI="http://localhost:8000{proxied}"')
                    rewritten_lines.append(line)
                else:
                    segment_url = line
                    if not segment_url.startswith('http'):
                        segment_url = base_url + segment_url
                    
                    if '.m3u8' in segment_url:
                        if request:
                            scheme = request.url.scheme
                            host = request.headers.get('host', 'localhost:8000')
                            proxied = f"{scheme}://{host}/api/hls-proxy?url={quote(segment_url, safe='')}"
                        else:
                            proxied = f"http://localhost:8000/api/hls-proxy?url={quote(segment_url, safe='')}"
                    else:
                        if request:
                            scheme = request.url.scheme
                            host = request.headers.get('host', 'localhost:8000')
                            proxied = f"{scheme}://{host}/api/proxy?url={quote(segment_url, safe='')}"
                        else:
                            proxied = f"http://localhost:8000/api/proxy?url={quote(segment_url, safe='')}"
                    rewritten_lines.append(proxied)
            
            return Response(
                content='\n'.join(rewritten_lines),
                media_type='application/vnd.apple.mpegurl',
                headers={
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': '*',
                }
            )
        else:
            response_context = http_client.stream('GET', url, headers=proxy_headers)
            r_stream = await response_context.__aenter__()
            r_stream.raise_for_status()
                
            response_headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': '*',
            }
            for header in ['Content-Type', 'Content-Length']:
                if header in r_stream.headers:
                    response_headers[header] = r_stream.headers[header]
                
            async def stream_generator():
                try:
                    async for chunk in r_stream.aiter_bytes():
                        yield chunk
                finally:
                    await response_context.__aexit__(None, None, None)
                
            return StreamingResponse(
                stream_generator(),
                media_type=content_type,
                headers=response_headers
            )
    except Exception as e:
        logger.error(f"HLS proxy error: {e}")
        return {"status": "error", "message": str(e)}
