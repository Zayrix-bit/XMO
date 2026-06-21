from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import requests
from bs4 import BeautifulSoup
import re
import uvicorn
import json
import diskcache
import functools
from fastapi import Request
def extract_page_data(html):
    """Extract page data from HTML by finding the initial state JSON in script tag"""
    soup = BeautifulSoup(html, 'html.parser')
    for script in soup.find_all('script'):
        if script.string and 'videoThumbProps' in script.string:
            try:
                json_match = re.search(r'\{.*\}', script.string, re.DOTALL)
                if json_match:
                    return json.loads(json_match.group())
            except Exception:
                continue
    return None

def format_duration(seconds):
    """Convert seconds to MM:SS or HH:MM:SS"""
    seconds = int(seconds)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes:02d}:{secs:02d}"

app = FastAPI()

# Initialize persistent disk cache
cache = diskcache.Cache('.cache')

def cache_response(ttl_seconds: int):
    """Decorator to cache FastAPI endpoint responses using diskcache."""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            key_parts = [func.__name__]
            for k, v in kwargs.items():
                if isinstance(v, Request):
                    continue
                key_parts.append(f"{k}={v}")
            
            cache_key = ":".join(key_parts)
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                return cached_value
                
            result = func(*args, **kwargs)
            
            if isinstance(result, dict) and result.get("status") == "success":
                cache.set(cache_key, result, expire=ttl_seconds)
                
            return result
        return wrapper
    return decorator
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Explicit OPTIONS handler for CORS preflight
@app.options("/api/{path:path}")
async def options_handler():
    return {
        "status": "ok",
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    }

XHAMSTER_DOMAINS = [
    'xhamster.com',
    'xhamster.desi',
    'xhamster2.com',
    'xhamster3.com',
    'xhamster4.com',
    'xhamster5.com',
    'xhamster6.com',
    'xhamster7.com',
    'xhamster8.com',
    'xhamster9.com',
    'xhamster10.com',
]

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
}


def fetch_with_fallback(path: str, use_https: bool = True):
    """
    Try fetching from all xHamster domains until one works.
    :param path: Path part of URL (e.g., "/newest/2", "/search/video?q=milf")
    :param use_https: Whether to use https
    :return: (response, working_domain)
    """
    protocol = 'https' if use_https else 'http'
    for domain in XHAMSTER_DOMAINS:
        try:
            url = f"{protocol}://{domain}{path}"
            print(f"Trying domain: {url}")
            response = requests.get(url, headers=HEADERS, timeout=10)
            response.raise_for_status()
            print(f"Success with domain: {domain}")
            return response, domain
        except Exception as e:
            print(f"Failed with domain {domain}: {str(e)}")
            continue
    return None, None

@app.get("/")
def home():
    return {"status": "success", "message": "xHamster Scraper API is running!"}

def parse_video_list(html_or_soup):
    """Helper: extract video list from page HTML using embedded JSON data."""
    videos = []
    try:
        if isinstance(html_or_soup, str):
            html = html_or_soup
        else:
            html = str(html_or_soup)
        
        page_data = extract_page_data(html)
        
        # Check multiple possible paths for videoThumbProps
        video_thumb_props = None
        if page_data:
            # Path 1: for trending/newest pages
            if ('layoutPage' in page_data and 
                'videoListProps' in page_data['layoutPage'] and 
                'videoThumbProps' in page_data['layoutPage']['videoListProps']):
                video_thumb_props = page_data['layoutPage']['videoListProps']['videoThumbProps']
            # Path 2: for search pages
            elif ('searchResult' in page_data and 
                  'videoThumbProps' in page_data['searchResult']):
                video_thumb_props = page_data['searchResult']['videoThumbProps']
            # Path 3: for individual video pages (related videos)
            elif ('relatedVideosComponent' in page_data and 
                  'videoTabInitialData' in page_data['relatedVideosComponent'] and
                  'videoListProps' in page_data['relatedVideosComponent']['videoTabInitialData'] and
                  'videoThumbProps' in page_data['relatedVideosComponent']['videoTabInitialData']['videoListProps']):
                video_thumb_props = page_data['relatedVideosComponent']['videoTabInitialData']['videoListProps']['videoThumbProps']
            # Path 4: for category pages
            elif ('pagesCategoryComponent' in page_data and 
                  'trendingVideoListProps' in page_data['pagesCategoryComponent'] and
                  'videoThumbProps' in page_data['pagesCategoryComponent']['trendingVideoListProps']):
                video_thumb_props = page_data['pagesCategoryComponent']['trendingVideoListProps']['videoThumbProps']
        
        if video_thumb_props:
            for item in video_thumb_props:
                try:
                    title = item.get('title', '')
                    link = item.get('pageURL', '')
                    image = item.get('imageURL', '') or item.get('thumbURL', '')
                    duration_seconds = item.get('duration', 0)
                    duration = format_duration(duration_seconds)
                    video_id = str(item.get('id', ''))
                    
                    if link and title:
                        videos.append({
                            'id': video_id,
                            'title': title,
                            'link': link,
                            'image': image,
                            'duration': duration
                        })
                except Exception:
                    continue
    except Exception:
        pass
    return videos

@app.get("/api/search")
# @cache_response(ttl_seconds=3600)  # Temporarily disabled for debugging
def search_videos(q: str = Query(..., description="Search query"), page: int = Query(1, description="Page number")):
    path = f"/search/video?q={q}&page={page}"
    response, domain = fetch_with_fallback(path)
    
    if not response:
        return {"status": "error", "message": "No working xHamster domain found!"}
        
    try:
        videos = parse_video_list(response.text)
                
        return {
            "status": "success",
            "query": q,
            "page": page,
            "results": videos,
            "used_domain": domain
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/trending")
@cache_response(ttl_seconds=10)  # 10-second cache to prevent multi-fetch flickering
def trending_videos(page: int = Query(1, description="Page number")):
    # Fetch the dynamic live feed for page 1, and fall back to monthly best for pagination
    if page == 1:
        path = "/"
    else:
        path = f"/best/monthly/{page}"
        
    response, domain = fetch_with_fallback(path)
    
    if not response:
        return {"status": "error", "message": "No working xHamster domain found!"}
    
    try:
        videos = parse_video_list(response.text)
        return {"status": "success", "page": page, "results": videos, "used_domain": domain}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/newest")
@cache_response(ttl_seconds=10)  # 10-second cache to prevent multi-fetch flickering
def newest_videos(page: int = Query(1, description="Page number")):
    path = f"/newest/{page}"
    response, domain = fetch_with_fallback(path)
    
    if not response:
        return {"status": "error", "message": "No working xHamster domain found!"}
    
    try:
        videos = parse_video_list(response.text)
        return {"status": "success", "page": page, "results": videos, "used_domain": domain}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/categories")
@cache_response(ttl_seconds=86400)  # 24 hours
def get_categories():
    path = "/categories"
    response, domain = fetch_with_fallback(path)
    
    if not response:
        return {"status": "error", "message": "No working xHamster domain found!"}
    
    try:
        soup = BeautifulSoup(response.text, 'html.parser')
        
        cats = []
        langs = []
        seen = set()
        
        for a in soup.select('a'):
            href = a.get('href', '')
            name = a.text.strip() or a.get('title', '').strip()
            if not name:
                name = a.get_text(strip=True)
                
            if '/categories/' in href and '/photos/' not in href and name:
                slug = href.rstrip('/').split('/')[-1]
                
                image_url = ""
                img_tag = a.select_one('img')
                if img_tag:
                    image_url = img_tag.get('src') or img_tag.get('data-src', '')
                
                cat_data = {"name": name, "slug": slug, "url": href, "image": image_url}
                
                if href not in seen:
                    seen.add(href)
                    if name.lower().startswith('porn in '):
                        langs.append(cat_data)
                    else:
                        cats.append(cat_data)
                else:
                    # Update image if we found a better one later in the page
                    if image_url:
                        for cat in cats:
                            if cat['url'] == href and not cat['image']:
                                cat['image'] = image_url
                                break
                        for cat in langs:
                            if cat['url'] == href and not cat['image']:
                                cat['image'] = image_url
                                break

        # Separate countries and normal categories
        COUNTRY_SLUGS = {
            'indian', 'desi', 'russian', 'american', 'british', 'japanese', 'korean', 'chinese', 'german', 'french',
            'italian', 'spanish', 'brazilian', 'mexican', 'colombian', 'canadian', 'australian', 'filipino', 'thai',
            'vietnamese', 'indonesian', 'malaysian', 'arab', 'egyptian', 'moroccan', 'turkish', 'iranian', 'pakistani',
            'bangladeshi', 'sri-lankan', 'nepali', 'south-african', 'nigerian', 'kenyan', 'ukrainian', 'polish', 'czech',
            'hungarian', 'romanian', 'bulgarian', 'swedish', 'norwegian', 'danish', 'finnish', 'dutch', 'belgian', 'swiss',
            'austrian', 'greek', 'portuguese', 'argentinian', 'chilean', 'peruvian', 'venezuelan', 'cuban', 'puerto-rican',
            'dominican', 'jamaican', 'israeli', 'lebanese', 'syrian', 'iraqi', 'afghan', 'uzbek', 'kazakh', 'somali',
            'ethiopian', 'sudanese', 'ugandan', 'zimbabwean', 'zambian', 'tanzanian', 'ghanaian', 'cameroonian', 'senegalese',
            'ivorian', 'malian', 'guinean', 'angolan', 'mozambican', 'madagascan', 'rwandan', 'burundian', 'malawian',
            'botswanan', 'namibian', 'swazi', 'lesotho', 'mauritian', 'seychellois', 'comoran', 'djiboutian', 'eritrean',
            'south-sudanese', 'central-african', 'chadian', 'nigerien', 'burkinabe', 'togolese', 'beninese', 'liberian',
            'sierra-leonean', 'gambian', 'bissau-guinean', 'equatorial-guinean', 'gabonese', 'congolese', 'sao-tomean',
            'cape-verdean', 'saudi', 'emirati', 'qatari', 'kuwaiti', 'bahraini', 'omani', 'yemeni', 'jordanian', 'palestinian',
            'cypriot', 'maltese', 'georgian', 'armenian', 'azerbaijani', 'turkmen', 'tajik', 'kyrgyz', 'mongolian', 'taiwanese',
            'singaporean', 'bruneian', 'timorese', 'papuan', 'fijian', 'samoan', 'tongan', 'vanuatuan', 'solomon-islander',
            'micronesian', 'marshallese', 'palauan', 'nauruan', 'tuvaluan', 'kiribati', 'latvian', 'lithuanian', 'estonian',
            'belarusian', 'moldovan', 'slovak', 'slovenian', 'croatian', 'bosnian', 'serbian', 'montenegrin', 'macedonian',
            'albanian', 'kosovar', 'icelandic', 'irish', 'scottish', 'welsh', 'english', 'greenlandic', 'faroese', 'andorran',
            'monacan', 'sammarinese', 'vatican', 'liechtenstein', 'luxembourgish', 'bahamian', 'belizean', 'costa-rican',
            'salvadoran', 'guatemalan', 'honduran', 'nicaraguan', 'panamanian', 'antiguan', 'barbadian', 'grenadian', 'haitian',
            'kittitian', 'lucian', 'vincentian', 'trinidadian', 'surinamese', 'guyanese', 'ecuadorian', 'bolivian', 'paraguayan',
            'uruguayan', 'asian', 'latina', 'latino', 'euro', 'european', 'arabian', 'african', 'black', 'ebony', 'white'
        }
        
        normal_cats = []
        country_cats = []
        for cat in cats:
            if cat['slug'] in COUNTRY_SLUGS:
                country_cats.append(cat)
            else:
                normal_cats.append(cat)

        return {
            "status": "success", 
            "categories": normal_cats, 
            "countries": country_cats,
            "languages": langs,
            "used_domain": domain
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/category/{slug}")
@cache_response(ttl_seconds=3600)  # 1 hour
def category_videos(slug: str, page: int = Query(1, description="Page number")):
    path = f"/categories/{slug}/{page}"
    response, domain = fetch_with_fallback(path)
    
    if not response:
        return {"status": "error", "message": "No working xHamster domain found!"}
    
    try:
        videos = parse_video_list(response.text)
        return {"status": "success", "category": slug, "page": page, "results": videos, "used_domain": domain}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/video")
@cache_response(ttl_seconds=600)  # 10 mins
def get_video_stream(url: str = Query(..., description="Full xHamster video URL")):
    try:
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        
        html = response.text
        soup = BeautifulSoup(html, 'html.parser')
        
        # Extract video title
        title_tag = soup.select_one('h1.with-player-container')
        if not title_tag:
            title_tag = soup.select_one('h1')
        video_title = title_tag.text.strip() if title_tag else 'Untitled Video'
        
        # Extract related videos (pass html)
        related = parse_video_list(html)
        
        # Use regex to find direct MP4 and M3U8 streaming links in the HTML
        m3u8_pattern = r'https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*'
        mp4_pattern = r'https?://[^\s"\'<>]+\.mp4[^\s"\'<>]*'
        
        m3u8_links = list(set(re.findall(m3u8_pattern, html)))
        all_mp4_links = list(set(re.findall(mp4_pattern, html)))
        
        # Filter out fake mp4s: exclude m3u8 disguised as mp4, and thumbnail previews
        mp4_links = [u for u in all_mp4_links if '.m3u8' not in u and 'thumb' not in u]
        
        # Pick the best quality direct URL (prefer ones with resolution like 480p, 720p)
        quality_mp4s = [u for u in mp4_links if any(q in u for q in ['1080p', '720p', '480p', '240p'])]
        
        if quality_mp4s:
            # Prefer highest quality
            for q in ['1080p', '720p', '480p', '240p']:
                match = [u for u in quality_mp4s if q in u]
                if match:
                    direct_url = match[0]
                    break
        elif mp4_links:
            direct_url = mp4_links[0]
        else:
            direct_url = None
        
        proxy_url = None
        if direct_url:
            proxy_url = f"/api/proxy?url={requests.utils.quote(direct_url, safe='')}"
        
        # HLS proxy URL for multi-quality streaming
        hls_proxy_url = None
        if m3u8_links:
            hls_proxy_url = f"/api/hls-proxy?url={requests.utils.quote(m3u8_links[0], safe='')}"
        
        # Extract referer/origin domain from original url
        from urllib.parse import urlparse
        parsed_original = urlparse(url)
        original_domain = parsed_original.netloc
        
        return {
            "status": "success",
            "title": video_title,
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
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/proxy")
def proxy_video(url: str = Query(..., description="Direct MP4/M3U8 URL to proxy"), request: Request = None):
    """Proxy the video stream with correct Referer header to bypass CDN 403 blocks."""
    try:
        # Find the appropriate xHamster domain for referer
        from urllib.parse import urlparse
        referer_domain = 'xhamster.desi'
        for domain in XHAMSTER_DOMAINS:
            if domain in url:
                referer_domain = domain
                break
                
        proxy_headers = {
            **HEADERS,
            'Referer': f'https://{referer_domain}/',
            'Origin': f'https://{referer_domain}',
        }
        
        # Copy range headers if present
        if request and 'range' in request.headers:
            proxy_headers['Range'] = request.headers['range']
        
        r = requests.get(url, headers=proxy_headers, stream=True)
        r.raise_for_status()
        
        # Build response headers
        response_headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        }
        
        # Copy important headers
        for header in ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'Cache-Control']:
            if header in r.headers:
                response_headers[header] = r.headers[header]
        
        return StreamingResponse(
            r.iter_content(chunk_size=1024 * 256),
            status_code=r.status_code,
            media_type=response_headers.get('Content-Type', 'video/mp4'),
            headers=response_headers
        )
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/hls-proxy")
def hls_proxy(url: str = Query(..., description="M3U8 URL to proxy with URL rewriting"), request: Request = None):
    """Proxy M3U8 playlists and rewrite internal URLs to also go through our proxy."""
    try:
        # Find the appropriate xHamster domain for referer
        referer_domain = 'xhamster.desi'
        for domain in XHAMSTER_DOMAINS:
            if domain in url:
                referer_domain = domain
                break
                
        proxy_headers = {
            **HEADERS,
            'Referer': f'https://{referer_domain}/',
            'Origin': f'https://{referer_domain}',
        }
        
        r = requests.get(url, headers=proxy_headers)
        r.raise_for_status()
        
        content = r.text
        content_type = r.headers.get('Content-Type', 'application/vnd.apple.mpegurl')
        
        # Check if this is an M3U8 playlist
        if '.m3u8' in url or 'mpegurl' in content_type.lower() or content.strip().startswith('#EXTM3U'):
            # Get the base URL for resolving relative paths
            base_url = url.rsplit('/', 1)[0] + '/'
            
            rewritten_lines = []
            for line in content.splitlines():
                line = line.strip()
                if not line or line.startswith('#'):
                    # For EXT-X-MAP or similar tags that contain URIs
                    if 'URI="' in line:
                        import urllib.parse
                        uri_match = re.search(r'URI="([^"]+)"', line)
                        if uri_match:
                            orig_uri = uri_match.group(1)
                            if not orig_uri.startswith('http'):
                                orig_uri = base_url + orig_uri
                            proxied = f"/api/hls-proxy?url={requests.utils.quote(orig_uri, safe='')}"
                            line = line.replace(uri_match.group(0), f'URI="http://localhost:8000{proxied}"')
                    rewritten_lines.append(line)
                else:
                    # This is a URL line (segment or sub-playlist)
                    segment_url = line
                    if not segment_url.startswith('http'):
                        segment_url = base_url + segment_url
                    
                    # Sub-playlists (.m3u8) go through hls-proxy, segments through regular proxy
                    if '.m3u8' in segment_url:
                        proxied = f"http://localhost:8000/api/hls-proxy?url={requests.utils.quote(segment_url, safe='')}"
                    else:
                        proxied = f"http://localhost:8000/api/proxy?url={requests.utils.quote(segment_url, safe='')}"
                    rewritten_lines.append(proxied)
            
            from fastapi.responses import Response
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
            # Not an M3U8, just proxy as-is (could be a segment)
            response_headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': '*',
            }
            for header in ['Content-Type', 'Content-Length']:
                if header in r.headers:
                    response_headers[header] = r.headers[header]
            
            return StreamingResponse(
                iter([r.content]),
                media_type=content_type,
                headers=response_headers
            )
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
