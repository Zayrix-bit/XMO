from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import requests
from bs4 import BeautifulSoup
import re
import uvicorn
import json

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

@app.get("/api/search")
def search_videos(q: str = Query(..., description="Search query"), page: int = Query(1, description="Page number")):
    target_url = f"https://xhamster.com/search/video?q={q}&page={page}"
    
    try:
        response = requests.get(target_url, headers=HEADERS)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        videos = []
        
        for video in soup.select('.video-thumb'):
            try:
                title_tag = video.select_one('.video-thumb-info__name')
                title = title_tag.text.strip() if title_tag else 'No Title'
                
                link_tag = video.select_one('.video-thumb__image-container')
                link = link_tag['href'] if link_tag else ''
                
                img_tag = video.select_one('img.thumb-image-container__image')
                image = img_tag['src'] if img_tag and 'src' in img_tag.attrs else ''
                
                duration_tag = video.select_one('.thumb-image-container__duration')
                duration = duration_tag.text.strip() if duration_tag else ''
                
                if link and title:
                    videos.append({
                        'title': title,
                        'link': link,
                        'image': image,
                        'duration': duration
                    })
            except Exception as e:
                continue
                
        return {
            "status": "success",
            "query": q,
            "page": page,
            "results": videos
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/video")
def get_video_stream(url: str = Query(..., description="Full xHamster video URL")):
    try:
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        
        html = response.text
        
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
        
        return {
            "status": "success",
            "direct_url": direct_url,
            "proxy_url": proxy_url,
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

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
