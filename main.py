from fastapi import FastAPI, Query
from contextlib import asynccontextmanager
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
try:
    from httpx_socks import AsyncProxyTransport  # Add proxy support
    PROXY_TRANSPORT_AVAILABLE = True
except ImportError:
    PROXY_TRANSPORT_AVAILABLE = False

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()  # Loads variables from .env file

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Proxy configuration
_proxy_list = []
def load_proxies():
    """Load proxies from environment variable"""
    proxy_str = os.environ.get("PROXY_LIST", "")
    if proxy_str:
        # Split by comma or space
        _proxy_list.extend([p.strip() for p in proxy_str.replace(",", " ").split() if p.strip()])
    
    # Also add single proxies if they exist
    single_http = os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy")
    single_https = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    
    if single_http and single_http not in _proxy_list:
        _proxy_list.append(single_http)
    elif single_https and single_https not in _proxy_list:
        _proxy_list.append(single_https)
    
    logger.info(f"Loaded {len(_proxy_list)} proxies from env")

load_proxies()

# Advanced Anti-Detection: More realistic User Agents
_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0",
]

# All xHamster domains to try
XHAMSTER_DOMAINS = [
    'xhamster.desi',  # Prioritize desi first
    'xhamster.com',
    'xhamster2.com',
    'xhamster3.com',
    'xhamster4.com',
    'xhamster5.com',
    'xhamster6.com',
    'xhamster7.com',
    'xhamster8.com',
    'xhamster9.com',
    'xhamster10.com',
    'xhamster11.com',
    'xhamster12.com',
    'xhamster13.com',
    'xhamster14.com',
    'xhamster15.com',
    'xhamster16.com',
    'xhamster17.com',
    'xhamster18.com',
    'xhamster19.com',
    'xhamster20.com',
]

# Cookie jar for persistence
_cookie_jar = httpx.Cookies()

# Bypass cookies to disable SFW mode and age verification
def set_bypass_cookies(domain: str):
    """Set cookies that bypass age verification and SFW mode"""
    # Cookies for age verification
    _cookie_jar.set("age_gate", "1", domain=domain, path="/")
    _cookie_jar.set("age_gate2", "1", domain=domain, path="/")
    _cookie_jar.set("isAgeVerified", "true", domain=domain, path="/")
    _cookie_jar.set("is_sfw", "false", domain=domain, path="/")
    _cookie_jar.set("isSFW", "false", domain=domain, path="/")
    _cookie_jar.set("parental_control", "false", domain=domain, path="/")
    _cookie_jar.set("disableSFW", "1", domain=domain, path="/")
    # Some additional random cookies to look real
    _cookie_jar.set("isFirstVisit", "false", domain=domain, path="/")
    _cookie_jar.set("hasSeenAgeGate", "true", domain=domain, path="/")
    logger.info(f"Bypass cookies set for domain: {domain}")

def get_headers(domain: str = 'xhamster.desi'):
    """Get SUPER realistic browser headers!"""
    ua = random.choice(_USER_AGENTS)
    headers = {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Referer": f"https://www.google.com/",  # Sometimes fake Google referer helps
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
        "Priority": "u=0, i",
    }
    
    if "Chrome" in ua or "Edg" in ua:
        headers.update({
            "Sec-Ch-Ua": '"Chromium";v="133", "Not_A Brand";v="24", "Google Chrome";v="133"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Arch": '"x86"',
            "Sec-Ch-Ua-Bitness": '"64"',
            "Sec-Ch-Ua-Full-Version": '"133.0.0.0"',
            "Sec-Ch-Ua-Full-Version-List": '"Chromium";v="133.0.0.0", "Not_A Brand";v="24.0.0.0", "Google Chrome";v="133.0.0.0"',
            "Sec-Ch-Ua-Model": '""',
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Ch-Ua-Platform-Version": '"15.0.0"',
            "Sec-Ch-Ua-Wow64": "?0",
        })
    return headers

async def get_client(proxy: str = None):
    """Create an HTTP client with proper settings, optionally with proxy"""
    # Configure httpx for maximum realism
    limits = httpx.Limits(max_keepalive_connections=10, max_connections=20)
    timeout = httpx.Timeout(60.0, connect=10.0)
        
    client_kwargs = {
        "timeout": timeout,
        "follow_redirects": True,
        "limits": limits,
        "cookies": _cookie_jar,
        "http2": True,  # HTTP/2 is crucial for anti-detection
        "verify": True,  # Verify SSL certificates like real browser
    }
    if proxy:
        client_kwargs["proxy"] = proxy  # httpx uses 'proxy' (singular), not 'proxies'
        logger.info(f"Using proxy: {proxy[:50]}..." if len(proxy) > 50 else f"Using proxy: {proxy}")
    return httpx.AsyncClient(**client_kwargs)

def extract_page_data(html):
    """Extract page data from HTML by finding the largest JSON object in script tags"""
    soup = BeautifulSoup(html, 'html.parser')
    largest_data = None
    largest_size = 0
    
    logger.debug(f"Extracting page data from HTML of length: {len(html)}")
    
    for script in soup.find_all('script'):
        if script.string:
            try:
                # Find all JSON objects in the script
                content = script.string
                start_idx = 0
                while True:
                    start_brace = content.find('{', start_idx)
                    if start_brace == -1:
                        break
                    
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
                                logger.debug(f"Found large JSON object: {size} bytes, keys: {sorted(data.keys())[:10]}")
                        except json.JSONDecodeError:
                            pass
                        except Exception as e:
                            logger.debug(f"Error parsing JSON: {e}")
                    
                    start_idx = end_brace
            except Exception:
                continue
    
    if largest_data:
        logger.info(f"Successfully extracted page data with keys: {sorted(largest_data.keys())}")
    else:
        logger.warning("Failed to extract any page data from HTML")
    return largest_data

def format_duration(seconds):
    seconds = int(seconds)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes:02d}:{secs:02d}"

def format_views(views):
    if views >= 1000000:
        return f"{views / 1000000:.1f}M"
    elif views >= 1000:
        return f"{views / 1000:.1f}K"
    else:
        return str(views)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize disk cache
_cache_dir = '/tmp/.cache' if os.environ.get('SPACE_ID') or os.environ.get('VERCEL') else '.cache'
cache = diskcache.Cache(_cache_dir)

def cache_response(ttl_seconds: int):
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

async def fetch_with_fallback(path: str, use_https: bool = True):
    """Advanced fetch with proxy rotation and anti-bot measures"""
    protocol = 'https' if use_https else 'http'
    
    # Prepare domain list
    all_domains = XHAMSTER_DOMAINS.copy()
    random.shuffle(all_domains)
    
    # Prepare proxy list (copy and shuffle)
    proxies_to_try = _proxy_list.copy()
    random.shuffle(proxies_to_try)
    # Add "None" as final option to try without proxy
    proxies_to_try.append(None)
    
    for proxy in proxies_to_try:
        client = await get_client(proxy)
        try:
            for domain in all_domains:
                try:
                    # First load the homepage to get real cookies and session
                    home_url = f"{protocol}://{domain}/"
                    logger.info(f"[{proxy or 'DIRECT'}] Loading homepage for {domain}")
                    
                    # Set bypass cookies for this domain
                    set_bypass_cookies(domain)
                    
                    home_headers = get_headers(domain)
                    # For homepage, referer is google
                    home_headers["Referer"] = "https://www.google.com/"
                    
                    await asyncio.sleep(random.uniform(0.3, 1.0))
                    home_response = await client.get(home_url, headers=home_headers)
                    logger.info(f"[{proxy or 'DIRECT'}] Homepage status: {home_response.status_code}")
                    # Save cookies from homepage
                    _cookie_jar.update(home_response.cookies)
                    
                    # Now make the actual request
                    url = f"{protocol}://{domain}{path}"
                    headers = get_headers(domain)
                    # Now referer is the homepage itself
                    headers["Referer"] = home_url
                    
                    await asyncio.sleep(random.uniform(0.5, 2.0))

                    logger.info(f"[{proxy or 'DIRECT'}] Trying actual URL: {url}")

                    response = await client.get(url, headers=headers)
                    logger.info(f"[{proxy or 'DIRECT'}] Response status: {response.status_code}, HTML length: {len(response.text)}")
                    
                    # Save cookies
                    _cookie_jar.update(response.cookies)
                    
                    # Check for anti-bot redirect
                    if response.status_code == 200 and 'REDIRECT_URL' in response.text:
                        logger.info("Found anti-bot page, handling...")
                        soup = BeautifulSoup(response.text, 'html.parser')
                        redirect_url_match = re.search(r'const REDIRECT_URL = \'([^\']+)\'', response.text)
                        if redirect_url_match:
                            redirect_url = redirect_url_match.group(1)
                            noscript_link = soup.find('noscript')
                            fp = '-5'
                            if noscript_link and noscript_link.find('a'):
                                fp_url = noscript_link.find('a')['href']
                                fp_match = re.search(r'fp=([^&]+)', fp_url)
                                if fp_match:
                                    fp = fp_match.group(1)
                            final_url = redirect_url + f"fp={fp}"
                            logger.info(f"Following redirect to: {final_url}")
                            await asyncio.sleep(random.uniform(0.5, 1.5))
                            response = await client.get(final_url, headers=headers)
                            logger.info(f"Final response status: {response.status_code}, HTML length: {len(response.text)}")
                            _cookie_jar.update(response.cookies)
                    
                    response.raise_for_status()
                    
                    # Check for real content
                    page_data = extract_page_data(response.text)
                    has_real_data = False
                    if page_data:
                        video_thumb_props = None
                        
                        # Check all known paths
                        paths_to_check = [
                            ('layoutPage', 'videoListProps', 'videoThumbProps'),
                            ('searchResult', 'videoThumbProps'),
                            ('pagesCategoryComponent', 'trendingVideoListProps', 'videoThumbProps'),
                            ('relatedVideosComponent', 'videoTabInitialData', 'videoListProps', 'videoThumbProps'),
                        ]
                        
                        for path_keys in paths_to_check:
                            current = page_data
                            valid = True
                            for key in path_keys:
                                if isinstance(current, dict) and key in current:
                                    current = current[key]
                                else:
                                    valid = False
                                    break
                            if valid and isinstance(current, list):
                                video_thumb_props = current
                                logger.info(f"Found videos at path: {path_keys}")
                                break
                        
                        # If not found, try recursive search
                        if not video_thumb_props:
                            def find_vtp(obj):
                                if isinstance(obj, dict):
                                    for key, value in obj.items():
                                        if key == 'videoThumbProps' and isinstance(value, list):
                                            return value
                                        result = find_vtp(value)
                                        if result:
                                            return result
                                elif isinstance(obj, list):
                                    for item in obj:
                                        result = find_vtp(item)
                                        if result:
                                            return result
                                return None
                            video_thumb_props = find_vtp(page_data)
                        
                        if video_thumb_props:
                            logger.info(f"[{proxy or 'DIRECT'}] Found {len(video_thumb_props)} videos on {domain}!")
                            has_real_data = True
                        else:
                            logger.warning(f"[{proxy or 'DIRECT'}] No videoThumbProps found on {domain}")
                            if 'is_sfw' in page_data:
                                logger.warning(f"[{proxy or 'DIRECT'}] Site is in SFW mode: {page_data['is_sfw']}")
                    
                    logger.info(f"[{proxy or 'DIRECT'}] Success with domain: {domain}, has_real_data: {has_real_data}")
                    
                    if has_real_data:
                        await client.aclose()
                        return response.text, domain
                    else:
                        logger.warning(f"[{proxy or 'DIRECT'}] Domain {domain} didn't give videos, trying next...")
                        continue
                        
                except Exception as e:
                    logger.error(f"[{proxy or 'DIRECT'}] Failed with domain {domain}: {str(e)}", exc_info=True)
                    continue
        
        except Exception as e:
            logger.error(f"[{proxy or 'DIRECT'}] Proxy failed completely: {str(e)}")
        finally:
            await client.aclose()
    
    logger.warning("No working domains or proxies found!")
    return None, None

def parse_video_list(html_or_soup):
    videos = []
    try:
        page_data = None
        if isinstance(html_or_soup, dict):
            page_data = html_or_soup
        else:
            if isinstance(html_or_soup, str):
                html = html_or_soup
            else:
                html = str(html_or_soup)
            page_data = extract_page_data(html)
        
        if page_data:
            video_thumb_props = None
            
            # Check all known paths
            paths_to_check = [
                ('layoutPage', 'videoListProps', 'videoThumbProps'),
                ('searchResult', 'videoThumbProps'),
                ('pagesCategoryComponent', 'trendingVideoListProps', 'videoThumbProps'),
                ('relatedVideosComponent', 'videoTabInitialData', 'videoListProps', 'videoThumbProps'),
            ]
            
            for path_keys in paths_to_check:
                current = page_data
                valid = True
                for key in path_keys:
                    if isinstance(current, dict) and key in current:
                        current = current[key]
                    else:
                        valid = False
                        break
                if valid and isinstance(current, list):
                    video_thumb_props = current
                    break
            
            # Recursive search
            if not video_thumb_props:
                def find_vtp(obj):
                    if isinstance(obj, dict):
                        for key, value in obj.items():
                            if key == 'videoThumbProps' and isinstance(value, list):
                                return value
                            result = find_vtp(value)
                            if result:
                                return result
                    elif isinstance(obj, list):
                        for item in obj:
                            result = find_vtp(item)
                            if result:
                                return result
                    return None
                video_thumb_props = find_vtp(page_data)
            
            if video_thumb_props:
                logger.info(f"Found {len(video_thumb_props)} video items to parse")
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
                        logger.debug(f"Error parsing video item: {e}")
                        continue
    except Exception as e:
        logger.error(f"Error in parse_video_list: {e}", exc_info=True)
    return videos

@app.get("/")
def home():
    return {"status": "success", "message": "xHamster Scraper API (Hacker Mode) is running!"}

# Debug endpoints
@app.get("/api/debug/html")
async def debug_html(path: str = Query("/", description="Path to fetch")):
    html, domain = await fetch_with_fallback(path)
    page_data = extract_page_data(html) if html else None
    
    return {
        "status": "success", 
        "domain": domain, 
        "html_length": len(html) if html else 0,
        "html": html[:15000] if html else None,
        "page_data_keys": sorted(page_data.keys()) if page_data else None,
        "page_data": page_data
    }

@app.get("/api/debug/domain")
async def debug_domain(domain: str = Query(..., description="Domain to test"), path: str = Query("/", description="Path to fetch")):
    client = await get_client()
    url = f"https://{domain}{path}"
    headers = get_headers(domain)
    
    try:
        response = await client.get(url, headers=headers, follow_redirects=True)
        page_data = extract_page_data(response.text)
        videos = parse_video_list(page_data)
        return {
            "status": "success",
            "domain": domain,
            "url": url,
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "cookies": dict(response.cookies),
            "html_length": len(response.text),
            "html": response.text[:10000],
            "page_data_keys": sorted(page_data.keys()) if page_data else None,
            "page_data": page_data,
            "videos_found": len(videos)
        }
    except Exception as e:
        return {
            "status": "error",
            "domain": domain,
            "url": url,
            "error": str(e),
            "traceback": str(e.__traceback__)
        }

@app.get("/api/clear-cache")
def clear_cache():
    cache.clear()
    return {"status": "success", "message": "Cache cleared successfully!"}

# Main API endpoints
@app.get("/api/creator/{creator_slug}")
@cache_response(ttl_seconds=3600)
async def get_creator_videos(creator_slug: str, page: int = 1):
    path = f"/creators/{creator_slug}"
    if page > 1:
        path += f"/{page}"
    response_text, domain = await fetch_with_fallback(path)
    if not response_text:
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
            if ('subscribeButtonsProps' in page_data['infoComponent'] and
                'subscribeButtonProps' in page_data['infoComponent']['subscribeButtonsProps']):
                creator['subscribers'] = page_data['infoComponent']['subscribeButtonsProps']['subscribeButtonProps'].get('subscribers')
        
        videos = parse_video_list(page_data)
    
    return {
        "status": "success",
        "creator": creator,
        "videos": videos,
        "page": page,
        "used_domain": domain
    }

@app.get("/api/search")
@cache_response(ttl_seconds=3600)
async def search_videos(q: str = Query(..., description="Search query"), page: int = Query(1, description="Page number")):
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
@cache_response(ttl_seconds=10)
async def trending_videos(page: int = Query(1, description="Page number")):
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
@cache_response(ttl_seconds=10)
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
@cache_response(ttl_seconds=86400)
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
                    if image_url:
                        for cat in cats:
                            if cat['url'] == href and not cat['image']:
                                cat['image'] = image_url
                                break
                        for cat in langs:
                            if cat['url'] == href and not cat['image']:
                                cat['image'] = image_url
                                break

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
@cache_response(ttl_seconds=3600)
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
@cache_response(ttl_seconds=600)
async def get_video_stream(url: str = Query(..., description="Full xHamster video URL")):
    try:
        client = await get_client()
        from urllib.parse import urlparse
        parsed_url = urlparse(url)
        domain = parsed_url.netloc or 'xhamster.desi'
        headers = get_headers(domain)
        response = await client.get(url, headers=headers)
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
        
        if quality_mp4s:
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
        
        hls_proxy_url = None
        if m3u8_links:
            from urllib.parse import quote
            hls_proxy_url = f"/api/hls-proxy?url={quote(m3u8_links[0], safe='')}"
        
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
    try:
        from urllib.parse import urlparse
        referer_domain = 'xhamster.desi'
        for domain in XHAMSTER_DOMAINS:
            if domain in url:
                referer_domain = domain
                break
                
        proxy_headers = get_headers(referer_domain)
        proxy_headers['Origin'] = f'https://{referer_domain}'
        
        if request and 'range' in request.headers:
            proxy_headers['Range'] = request.headers['range']
        
        client = await get_client()
        response_context = client.stream('GET', url, headers=proxy_headers)
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

@app.get("/api/hls-proxy")
async def hls_proxy(url: str = Query(..., description="M3U8 URL to proxy with URL rewriting"), request: Request = None):
    try:
        from urllib.parse import urlparse
        referer_domain = 'xhamster.desi'
        for domain in XHAMSTER_DOMAINS:
            if domain in url:
                referer_domain = domain
                break
                
        proxy_headers = get_headers(referer_domain)
        proxy_headers['Origin'] = f'https://{referer_domain}'
        
        client = await get_client()
        response = await client.get(url, headers=proxy_headers)
        response.raise_for_status()
        
        content = response.text
        content_type = response.headers.get('Content-Type', 'application/vnd.apple.mpegurl')
        
        if '.m3u8' in url or 'mpegurl' in content_type.lower() or content.strip().startswith('#EXTM3U'):
            base_url = url.rsplit('/', 1)[0] + '/'
            from urllib.parse import quote
            
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
    import os
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
