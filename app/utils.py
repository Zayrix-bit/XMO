import re
import logging
from typing import Tuple, Optional, Dict, Any
from bs4 import BeautifulSoup
import httpx

logger = logging.getLogger(__name__)


def extract_page_data(html: str) -> Optional[Dict[str, Any]]:
    """Extract page data from HTML by finding the largest JSON object in script tags"""
    soup = BeautifulSoup(html, 'html.parser')
    largest_data = None
    largest_size = 0
    
    for script in soup.find_all('script'):
        if script.string:
            try:
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
                            import json
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


def format_duration(seconds: int) -> str:
    """Convert seconds to MM:SS or HH:MM:SS"""
    seconds = int(seconds)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes:02d}:{secs:02d}"


def format_views(views: int) -> str:
    """Format view count (e.g., 1234 → 1.2K, 1234567 → 1.2M)"""
    if views >= 1000000:
        return f"{views / 1000000:.1f}M"
    elif views >= 1000:
        return f"{views / 1000:.1f}K"
    else:
        return str(views)


async def fetch_with_fallback(
    path: str,
    http_client: httpx.AsyncClient,
    headers: Dict[str, str],
    domains: list,
    use_https: bool = True
) -> Tuple[Optional[str], Optional[str]]:
    """Try fetching from all xHamster domains until one works."""
    protocol = 'https' if use_https else 'http'
    for domain in domains:
        try:
            url = f"{protocol}://{domain}{path}"
            logger.info(f"Trying domain: {url}")
            response = await http_client.get(url, headers=headers, follow_redirects=True)
            logger.info(f"Initial response status code: {response.status_code}")
            
            # Check for anti-bot page
            if response.status_code == 200 and 'REDIRECT_URL' in response.text:
                logger.info("Found anti-bot page, following redirect...")
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
                    response = await http_client.get(final_url, headers=headers, follow_redirects=True)
                    logger.info(f"Final response status code: {response.status_code}")
            
            # Raise for status and check if we have valid content
            response.raise_for_status()
            logger.info(f"Success with domain: {domain}")
            logger.info(f"Final URL (after redirects): {response.url}")
            return response.text, domain
        except Exception as e:
            logger.error(f"Failed with domain {domain}: {str(e)}")
            continue
    return None, None


def parse_video_list(html_or_soup: Any) -> list:
    """Helper: extract video list from page HTML using embedded JSON data."""
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
        
        video_thumb_props = None
        if page_data:
            if ('layoutPage' in page_data and 
                'videoListProps' in page_data['layoutPage'] and 
                'videoThumbProps' in page_data['layoutPage']['videoListProps']):
                video_thumb_props = page_data['layoutPage']['videoListProps']['videoThumbProps']
            elif ('searchResult' in page_data and 
                  'videoThumbProps' in page_data['searchResult']):
                video_thumb_props = page_data['searchResult']['videoThumbProps']
            elif ('relatedVideosComponent' in page_data and 
                  'videoTabInitialData' in page_data['relatedVideosComponent'] and
                  'videoListProps' in page_data['relatedVideosComponent']['videoTabInitialData'] and
                  'videoThumbProps' in page_data['relatedVideosComponent']['videoTabInitialData']['videoListProps']):
                video_thumb_props = page_data['relatedVideosComponent']['videoTabInitialData']['videoListProps']['videoThumbProps']
            elif ('pagesCategoryComponent' in page_data and 
                  'trendingVideoListProps' in page_data['pagesCategoryComponent'] and
                  'videoThumbProps' in page_data['pagesCategoryComponent']['trendingVideoListProps']):
                video_thumb_props = page_data['pagesCategoryComponent']['trendingVideoListProps']['videoThumbProps']
            else:
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
                except Exception:
                    continue
    except Exception:
        pass
    return videos
