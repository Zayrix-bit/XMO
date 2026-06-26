from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import httpx
from bs4 import BeautifulSoup
import re
import uvicorn
import json
import diskcache
import functools
from fastapi import Request
import asyncio
import logging
import os
import random

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
def extract_page_data(html):
    """Extract page data from HTML by finding the largest JSON object in script tags"""
    soup = BeautifulSoup(html, 'html.parser')
    largest_data = None
    largest_size = 0
    
    for script in soup.find_all('script'):
        if script.string:
            try:
                # Find all JSON objects in the script
                # Use a pattern that matches balanced braces (handles nested objects)
                content = script.string
                start_idx = 0
                while True:
                    # Find the first opening brace
                    start_brace = content.find('{', start_idx)
                    if start_brace == -1:
                        break
                    
                    # Find matching closing brace
                    brace_count = 1
                    end_brace = start_brace + 1
                    while end_brace < len(content) and brace_count > 0:
                        if content[end_brace] == '{':
                            brace_count += 1
                        elif content[end_brace] == '}':
                            brace_count -= 1
                        end_brace += 1
                    
                    if brace_count == 0:
                        json_str = content[start_brace:end_brace]
                        try:
                            data = json.loads(json_str)
                            size = len(json_str)
                            if isinstance(data, dict) and size > largest_size:
                                largest_size = size
                                largest_data = data
                        except Exception:
                            pass
                    
                    start_idx = end_brace
            except Exception:
                continue
    return largest_data

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


def format_views(views):
    """Format view count (e.g., 1234 → 1.2K, 1234567 → 1.2M)"""
    if views >= 1000000:
        return f"{views / 1000000:.1f}M"
    elif views >= 1000:
        return f"{views / 1000:.1f}K"
    else:
        return str(views)

from contextlib import asynccontextmanager

# Global async HTTP client with connection pooling
http_client = None

async def get_http_client():
    """Lazy initialization of HTTP client — works in both lifespan and serverless contexts."""
    global http_client
    if http_client is None:
        http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0),
            follow_redirects=True,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
        )
        logger.info("HTTP client lazily initialized")
    return http_client

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-initialize the client at startup if possible
    await get_http_client()
    logger.info("HTTP client initialized via lifespan")
    yield
    global http_client
    if http_client:
        await http_client.aclose()
        http_client = None
        logger.info("HTTP client closed")

app = FastAPI(lifespan=lifespan)

# Initialize persistent disk cache — use /tmp on cloud platforms (read-only filesystem)
_cache_dir = '/tmp/.cache' if os.environ.get('SPACE_ID') or os.environ.get('VERCEL') else '.cache'
cache = diskcache.Cache(_cache_dir)

def cache_response(ttl_seconds: int):
    """Decorator to cache FastAPI endpoint responses using diskcache."""
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            key_parts = [func.__name__]
            for k, v in kwargs.items():
                if isinstance(v, Request):
                    continue
                key_parts.append(f"{k}={v}")
            
            cache_key = ":".join(key_parts)
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                return cached_value
                
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
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

# Rotating User-Agents to reduce bot detection
_USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
]

def get_headers(domain: str = 'xhamster.com'):
    """Get request headers with a random User-Agent and matching Client Hints for anti-bot evasion."""
    ua = random.choice(_USER_AGENTS)
    headers = {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': f'https://{domain}/',
        'Upgrade-Insecure-Requests': '1',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'Priority': 'u=0, i',
    }
    
    # Add client hints only for Chrome/Chromium user agents to avoid detection
    if 'Chrome' in ua:
        headers['Sec-Ch-Ua'] = '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"'
        headers['Sec-Ch-Ua-Mobile'] = '?0'
        headers['Sec-Ch-Ua-Arch'] = '"x86"'
        headers['Sec-Ch-Ua-Bitness'] = '"64"'
        headers['Sec-Ch-Ua-Full-Version'] = '"131.0.0.0"'
        headers['Sec-Ch-Ua-Full-Version-List'] = '"Chromium";v="131.0.0.0", "Not_A Brand";v="24.0.0.0", "Google Chrome";v="131.0.0.0"'
        headers['Sec-Ch-Ua-Model'] = '""'
        headers['Sec-Ch-Ua-Platform'] = '"Windows"'
        headers['Sec-Ch-Ua-Platform-Version'] = '"15.0.0"'
        headers['Sec-Ch-Ua-Wow64'] = '?0'
            
    return headers

# Keep a static reference for backward compatibility (but we should prefer get_headers())
HEADERS = get_headers()


async def fetch_with_fallback(path: str, use_https: bool = True):
    """
    Try fetching from all xHamster domains until one works.
    :param path: Path part of URL (e.g., "/newest/2", "/search/video?q=milf")
    :param use_https: Whether to use https
    :return: (response_text, working_domain)
    """
    client = await get_http_client()
    protocol = 'https' if use_https else 'http'
    
    # Shuffle domains to avoid always hitting the same first
    shuffled_domains = XHAMSTER_DOMAINS.copy()
    random.shuffle(shuffled_domains)
    
    for domain in shuffled_domains:
        try:
            url = f"{protocol}://{domain}{path}"
            headers = get_headers(domain)
            
            # Add small random delay to avoid rate limiting
            await asyncio.sleep(random.uniform(0.1, 0.5))
            
            logger.info(f"Trying domain: {url}")
            response = await client.get(url, headers=headers, follow_redirects=True)
            logger.info(f"Initial response status code: {response.status_code}, HTML length: {len(response.text)}")
            
            # Check if this is the anti-bot redirect page
            if response.status_code == 200 and 'REDIRECT_URL' in response.text:
                logger.info("Found anti-bot page, following redirect...")
                soup = BeautifulSoup(response.text, 'html.parser')
                redirect_url_match = re.search(r'const REDIRECT_URL = \'([^\']+)\'', response.text)
                if redirect_url_match:
                    redirect_url = redirect_url_match.group(1)
                    # Let's use the fp parameter from the noscript link
                    noscript_link = soup.find('noscript')
                    fp = '-5'  # default
                    if noscript_link and noscript_link.find('a'):
                        fp_url = noscript_link.find('a')['href']
                        fp_match = re.search(r'fp=([^&]+)', fp_url)
                        if fp_match:
                            fp = fp_match.group(1)
                    # Build the final URL
                    final_url = redirect_url + f"fp={fp}"
                    logger.info(f"Following redirect to: {final_url}")
                    # Add another small delay before following redirect
                    await asyncio.sleep(random.uniform(0.1, 0.3))
                    # Now fetch the actual page
                    response = await client.get(final_url, headers=headers, follow_redirects=True)
                    logger.info(f"Final response status code: {response.status_code}, HTML length: {len(response.text)}")
            
            response.raise_for_status()
            
            # Log whether we got real content or a bot-detection page
            if path == '/categories':
                has_real_data = '/categories/' in response.text
            else:
                has_real_data = 'videoThumbProps' in response.text or 'videoListProps' in response.text
                
            logger.info(f"Success with domain: {domain}, has_real_data: {has_real_data}")
            logger.info(f"Final URL (after redirects): {response.url}")
            
            if has_real_data:
                return response.text, domain
            else:
                logger.warning(f"Domain {domain} returned HTML without expected content (possible bot detection), trying next...")
                continue
                
        except Exception as e:
            logger.error(f"Failed with domain {domain}: {str(e)}")
            continue
    
    # If no domain returned video data, return the last successful response anyway
    logger.warning("No domain returned video data, returning None")
    return None, None


@app.get("/")
def home():
    return {"status": "success", "message": "xHamster Scraper API is running!"}

# Debug endpoint to see raw HTML and page_data
@app.get("/api/debug/html")
async def debug_html(path: str = Query("/", description="Path to fetch")):
    html, domain = await fetch_with_fallback(path)
    page_data = extract_page_data(html) if html else None
    
    return {
        "status": "success", 
        "domain": domain, 
        "html_length": len(html) if html else 0,
        "html": html,
        "page_data": page_data
    }

@app.get("/api/clear-cache")
def clear_cache():
    """Clear all cached responses"""
    cache.clear()
    return {"status": "success", "message": "Cache cleared successfully!"}

@app.get("/api/creator/{creator_slug}")
@cache_response(ttl_seconds=3600)
async def get_creator_videos(creator_slug: str, page: int = 1):
    """Fetch creator's profile and videos."""
    # First, try with /creators/ path
    path = f"/creators/{creator_slug}"
    if page > 1:
        path += f"/{page}"
    response_text, domain = await fetch_with_fallback(path)
    if not response_text:
        # Try /users/ path as fallback
        path = f"/users/{creator_slug}"
        if page > 1:
            path += f"/{page}"
        response_text, domain = await fetch_with_fallback(path)
    
    if not response_text:
        return {"status": "error", "message": "Could not fetch creator profile"}
    
    page_data = extract_page_data(response_text)
    creator = None
    videos = []
    if page_data:
        # Extract creator info from infoComponent.pornstarTop
        if 'infoComponent' in page_data and 'pornstarTop' in page_data['infoComponent']:
            pornstar_top = page_data['infoComponent']['pornstarTop']
            creator = {
                'name': pornstar_top.get('name'),
                'avatar': pornstar_top.get('thumbUrl'),
                'country': pornstar_top.get('country'),
                'translatedCountryName': pornstar_top.get('translatedCountryName'),
                'viewsCount': format_views(pornstar_top.get('viewsCount')),
                'videoCount': pornstar_top.get('videoCount'),
                'rating': pornstar_top.get('rating'),
                'subscribers': None
            }
            # Get subscribers from subscribeButtonsProps
            if ('subscribeButtonsProps' in page_data['infoComponent'] and
                'subscribeButtonProps' in page_data['infoComponent']['subscribeButtonsProps']):
                creator['subscribers'] = page_data['infoComponent']['subscribeButtonsProps']['subscribeButtonProps'].get('subscribers')
        
        # Extract videos using our parse_video_list function
        videos = parse_video_list(page_data)
    
    return {
        "status": "success",
        "creator": creator,
        "videos": videos,
        "page": page,
        "used_domain": domain
    }

def parse_video_list(html_or_soup):
    """Helper: extract video list from page HTML using embedded JSON data."""
    videos = []
    try:
        page_data = None
        if isinstance(html_or_soup, dict):
            # If we already have page_data dict, use it directly
            page_data = html_or_soup
        else:
            # If it's a string or soup object, extract page_data from it
            if isinstance(html_or_soup, str):
                html = html_or_soup
            else:
                html = str(html_or_soup)
            page_data = extract_page_data(html)
        
        # Print search correction info if available
        if page_data:
            logger.info(f"[DEBUG] page_data keys: {sorted(page_data.keys())}")
            import json
            logger.info(f"[DEBUG] page_data: {json.dumps(page_data, default=str)}")
            if 'entity' in page_data:
                logger.info(f"[DEBUG] entity: {page_data['entity']}")
            if 'correction' in page_data:
                logger.info(f"[DEBUG] correction: {page_data['correction']}")
        
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
            # Path 5: for creator pages
            else:
                # Check all possible creator video section keys
                creator_section_keys = [
                    'newestVideoSectionComponent',
                    'trendingVideoSectionComponent',
                    'recommendedVideoSectionComponent'
                ]
                for key in creator_section_keys:
                    if key in page_data:
                        section_data = page_data[key]
                        if 'videoListProps' in section_data and 'videoThumbProps' in section_data['videoListProps']:
                            video_thumb_props = section_data['videoListProps']['videoThumbProps']
                            break
        
        if video_thumb_props:
            for item in video_thumb_props:
                try:
                    title = item.get('title', '')
                    link = item.get('pageURL', '')
                    image = item.get('imageURL', '') or item.get('thumbURL', '')
                    duration_seconds = item.get('duration', 0)
                    duration = format_duration(duration_seconds)
                    video_id = str(item.get('id', ''))
                    views_raw = item.get('views', 0)
                    views = format_views(views_raw)
                    
                    if link and title:
                        videos.append({
                            'id': video_id,
                            'title': title,
                            'link': link,
                            'image': image,
                            'duration': duration,
                            'views': views
                        })
                except Exception as e:
                    continue
    except Exception:
        pass
    return videos

@app.get("/api/search")
@cache_response(ttl_seconds=3600)  # Re-enabled
async def search_videos(q: str = Query(..., description="Search query"), page: int = Query(1, description="Page number")):
    # Encode spaces in query
    query_encoded = q.replace(" ", "+")
    path = f"/search/{query_encoded}"
    if page > 1:
        path += f"?page={page}"
    response_text, domain = await fetch_with_fallback(path)
    
    if not response_text:
        return {"status": "error", "message": "No working xHamster domain found!"}
        
    try:
        videos = parse_video_list(response_text)
                
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
async def trending_videos(page: int = Query(1, description="Page number")):
    # Fetch the dynamic live feed for page 1, and fall back to monthly best for pagination
    if page == 1:
        path = "/"
    else:
        path = f"/best/monthly/{page}"
        
    response_text, domain = await fetch_with_fallback(path)
    
    if not response_text:
        return {"status": "error", "message": "No working xHamster domain found!"}
    
    try:
        videos = parse_video_list(response_text)
        return {"status": "success", "page": page, "results": videos, "used_domain": domain}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/newest")
@cache_response(ttl_seconds=10)  # 10-second cache to prevent multi-fetch flickering
async def newest_videos(page: int = Query(1, description="Page number")):
    path = f"/newest/{page}"
    response_text, domain = await fetch_with_fallback(path)
    
    if not response_text:
        return {"status": "error", "message": "No working xHamster domain found!"}
    
    try:
        videos = parse_video_list(response_text)
        return {"status": "success", "page": page, "results": videos, "used_domain": domain}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/categories")
@cache_response(ttl_seconds=86400)  # 24 hours
async def get_categories():
    path = "/categories"
    response_text, domain = await fetch_with_fallback(path)
    
    if not response_text:
        return {"status": "error", "message": "No working xHamster domain found!"}
    
    try:
        soup = BeautifulSoup(response_text, 'html.parser')
        
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
async def category_videos(slug: str, page: int = Query(1, description="Page number")):
    path = f"/categories/{slug}/{page}"
    response_text, domain = await fetch_with_fallback(path)
    
    if not response_text:
        return {"status": "error", "message": "No working xHamster domain found!"}
    
    try:
        videos = parse_video_list(response_text)
        return {"status": "success", "category": slug, "page": page, "results": videos, "used_domain": domain}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/video")
@cache_response(ttl_seconds=600)  # 10 mins
async def get_video_stream(url: str = Query(..., description="Full xHamster video URL")):
    try:
        client = await get_http_client()
        from urllib.parse import urlparse
        parsed_url = urlparse(url)
        domain = parsed_url.netloc or 'xhamster.com'
        headers = get_headers(domain)
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        
        html = response.text
        soup = BeautifulSoup(html, 'html.parser')
        
        # Extract page data (embedded JSON) for views, author, etc.
        page_data = extract_page_data(html)
        
        # Extract video title
        title_tag = soup.select_one('h1.with-player-container')
        if not title_tag:
            title_tag = soup.select_one('h1')
        video_title = title_tag.text.strip() if title_tag else 'Untitled Video'
        
        # Extract views and author/uploader from page data
        views = None
        uploader = None
        if page_data:
            # Extract views
            for view_key in ['videoModel', 'videoEntity', 'videoHeadingComponent', 'videoTitle']:
                if view_key in page_data and 'views' in page_data[view_key]:
                    views_raw = page_data[view_key]['views']
                    views = format_views(views_raw)
                    break
            
            # Extract author/uploader
            if 'videoModel' in page_data and 'author' in page_data['videoModel']:
                author = page_data['videoModel']['author']
                # Also check 'landing' for better name/avatar
                landing = page_data['videoModel'].get('landing', {}) if 'landing' in page_data['videoModel'] else {}
                uploader = {
                    'name': landing.get('name') or author.get('name'),
                    'username': author.get('name'),
                    'avatar': landing.get('logo') or '',
                    'profile_url': landing.get('link') or author.get('pageURL')
                }
        
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
            from urllib.parse import quote
            proxy_url = f"/api/proxy?url={quote(direct_url, safe='')}"
        
        # HLS proxy URL for multi-quality streaming
        hls_proxy_url = None
        if m3u8_links:
            from urllib.parse import quote
            hls_proxy_url = f"/api/hls-proxy?url={quote(m3u8_links[0], safe='')}"
        
        # Extract referer/origin domain from original url
        from urllib.parse import urlparse
        parsed_original = urlparse(url)
        original_domain = parsed_original.netloc
        
        return {
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
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/proxy")
async def proxy_video(url: str = Query(..., description="Direct MP4/M3U8 URL to proxy"), request: Request = None):
    """Proxy the video stream with correct Referer header to bypass CDN 403 blocks."""
    try:
        # Find the appropriate xHamster domain for referer
        from urllib.parse import urlparse
        referer_domain = 'xhamster.desi'
        for domain in XHAMSTER_DOMAINS:
            if domain in url:
                referer_domain = domain
                break
                
        proxy_headers = get_headers(referer_domain)
        proxy_headers['Origin'] = f'https://{referer_domain}'
        
        # Copy range headers if present
        if request and 'range' in request.headers:
            proxy_headers['Range'] = request.headers['range']
        
        # Get the stream
        client = await get_http_client()
        response_context = client.stream('GET', url, headers=proxy_headers)
        r = await response_context.__aenter__()
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

@app.get("/api/hls-proxy")
async def hls_proxy(url: str = Query(..., description="M3U8 URL to proxy with URL rewriting"), request: Request = None):
    """Proxy M3U8 playlists and rewrite internal URLs to also go through our proxy."""
    try:
        # Find the appropriate xHamster domain for referer
        referer_domain = 'xhamster.desi'
        for domain in XHAMSTER_DOMAINS:
            if domain in url:
                referer_domain = domain
                break
                
        proxy_headers = get_headers(referer_domain)
        proxy_headers['Origin'] = f'https://{referer_domain}'
        
        # First check if it's an M3U8 playlist by reading the content
        client = await get_http_client()
        response = await client.get(url, headers=proxy_headers)
        response.raise_for_status()
        
        content = response.text
        content_type = response.headers.get('Content-Type', 'application/vnd.apple.mpegurl')
        
        # Check if this is an M3U8 playlist
        if '.m3u8' in url or 'mpegurl' in content_type.lower() or content.strip().startswith('#EXTM3U'):
            # Get the base URL for resolving relative paths
            base_url = url.rsplit('/', 1)[0] + '/'
            from urllib.parse import quote
            
            rewritten_lines = []
            for line in content.splitlines():
                line = line.strip()
                if not line or line.startswith('#'):
                    # For EXT-X-MAP or similar tags that contain URIs
                    if 'URI="' in line:
                        uri_match = re.search(r'URI="([^"]+)"', line)
                        if uri_match:
                            orig_uri = uri_match.group(1)
                            if not orig_uri.startswith('http'):
                                orig_uri = base_url + orig_uri
                            proxied = f"/api/hls-proxy?url={quote(orig_uri, safe='')}"
                            # Use the request's host instead of hardcoded localhost:8000
                            if request:
                                scheme = request.url.scheme
                                host = request.headers.get('host', 'localhost:8000')
                                line = line.replace(uri_match.group(0), f'URI="{scheme}://{host}{proxied}"')
                            else:
                                line = line.replace(uri_match.group(0), f'URI="http://localhost:8000{proxied}"')
                    rewritten_lines.append(line)
                else:
                    # This is a URL line (segment or sub-playlist)
                    segment_url = line
                    if not segment_url.startswith('http'):
                        segment_url = base_url + segment_url
                    
                    # Sub-playlists (.m3u8) go through hls-proxy, segments through regular proxy
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
            # Not an M3U8 - stream it
            response_context = client.stream('GET', url, headers=proxy_headers)
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

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=7860, reload=True)
