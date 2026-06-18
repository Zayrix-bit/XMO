from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import requests
from bs4 import BeautifulSoup
import re
import uvicorn
import json

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
}

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
            # Path 1: for trending/newest/category pages
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
def search_videos(q: str = Query(..., description="Search query"), page: int = Query(1, description="Page number")):
    target_url = f"https://xhamster.com/search/video?q={q}&page={page}"
    
    try:
        response = requests.get(target_url, headers=HEADERS)
        response.raise_for_status()
        videos = parse_video_list(response.text)
                
        return {
            "status": "success",
            "query": q,
            "page": page,
            "results": videos
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/trending")
def trending_videos(page: int = Query(1, description="Page number")):
    target_url = f"https://xhamster.com/best/monthly?page={page}"
    try:
        response = requests.get(target_url, headers=HEADERS)
        response.raise_for_status()
        videos = parse_video_list(response.text)
        return {"status": "success", "page": page, "results": videos}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/newest")
def newest_videos(page: int = Query(1, description="Page number")):
    target_url = f"https://xhamster.com/newest?page={page}"
    try:
        response = requests.get(target_url, headers=HEADERS)
        response.raise_for_status()
        videos = parse_video_list(response.text)
        return {"status": "success", "page": page, "results": videos}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/categories")
def get_categories():
    target_url = "https://xhamster.com/categories"
    try:
        response = requests.get(target_url, headers=HEADERS)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        cats = []
        seen = set()
        # Try both selectors: itemContent-12755 and item-f658a (thumb items)
        for a in soup.select('a[href*="/categories/"]'):
            href = a.get('href', '')
            # Skip photo categories, only video categories
            if '/photos/' in href:
                continue
            name = a.text.strip()
            if name and href and href not in seen:
                seen.add(href)
                slug = href.rstrip('/').split('/')[-1]
                cats.append({"name": name, "slug": slug, "url": href})
        return {"status": "success", "categories": cats}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/category/{slug}")
def category_videos(slug: str, page: int = Query(1, description="Page number")):
    target_url = f"https://xhamster.com/categories/{slug}?page={page}"
    try:
        response = requests.get(target_url, headers=HEADERS)
        response.raise_for_status()
        videos = parse_video_list(response.text)
        return {"status": "success", "category": slug, "page": page, "results": videos}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/video")
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
        
        return {
            "status": "success",
            "title": video_title,
            "direct_url": direct_url,
            "proxy_url": proxy_url,
            "hls_proxy_url": hls_proxy_url,
            "related": related[:12],
            "streams": {
                "m3u8": m3u8_links,
                "mp4": mp4_links
            },
            "original_url": url
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/proxy")
def proxy_video(url: str = Query(..., description="Direct MP4/M3U8 URL to proxy")):
    """Proxy the video stream with correct Referer header to bypass CDN 403 blocks."""
    try:
        proxy_headers = {
            **HEADERS,
            'Referer': 'https://xhamster.com/',
            'Origin': 'https://xhamster.com',
        }
        
        r = requests.get(url, headers=proxy_headers, stream=True)
        r.raise_for_status()
        
        content_type = r.headers.get('Content-Type', 'video/mp4')
        content_length = r.headers.get('Content-Length')
        
        headers = {}
        if content_length:
            headers['Content-Length'] = content_length
        headers['Accept-Ranges'] = 'bytes'
        
        return StreamingResponse(
            r.iter_content(chunk_size=1024 * 256),
            media_type=content_type,
            headers=headers
        )
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/hls-proxy")
def hls_proxy(url: str = Query(..., description="M3U8 URL to proxy with URL rewriting")):
    """Proxy M3U8 playlists and rewrite internal URLs to also go through our proxy."""
    try:
        proxy_headers = {
            **HEADERS,
            'Referer': 'https://xhamster.com/',
            'Origin': 'https://xhamster.com',
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
                headers={'Access-Control-Allow-Origin': '*'}
            )
        else:
            # Not an M3U8, just proxy as-is (could be a segment)
            return StreamingResponse(
                iter([r.content]),
                media_type=content_type,
            )
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
