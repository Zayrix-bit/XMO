import requests
from bs4 import BeautifulSoup
import re
import json

# Let's test search endpoint
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

def extract_page_data(html):
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

# Test search
query = "lesbian"
page = 1

url = f"https://xhamster.com/search/video?q={query}&page={page}"
print(f"Testing URL: {url}")
r = requests.get(url, headers=HEADERS, timeout=10, allow_redirects=True)
print(f"Status: {r.status_code}")
print(f"Final URL (after redirects): {r.url}")

if r.status_code == 200:
    page_data = extract_page_data(r.text)
    if page_data:
        print("Found page data! Keys are:")
        for k in sorted(page_data.keys()):
            print(f"- {k}")
            # Print first level keys of nested dicts
            if isinstance(page_data[k], dict):
                nested_keys = list(page_data[k].keys())
                print(f"  Child keys: {nested_keys}")
        print("\nLooking for video data in common places...")
        print(f"entity.queryOrig: {page_data.get('entity', {}).get('queryOrig')}")
        print(f"entity.queryUncorrected: {page_data.get('entity', {}).get('queryUncorrected')}")
        print(f"correction: {page_data.get('correction')}")
        
        if 'searchResult' in page_data:
            print(f"searchResult keys: {list(page_data['searchResult'].keys())}")
            if 'videoThumbProps' in page_data['searchResult']:
                thumb_props = page_data['searchResult']['videoThumbProps']
                print(f"\nNumber of videos found: {len(thumb_props)}")
                if thumb_props:
                    print("First 5 video titles:")
                    for i, vid in enumerate(thumb_props[:5]):
                        print(f"  {i+1}. {vid.get('title')}")
        if 'layoutPage' in page_data:
            print(f"layoutPage keys: {list(page_data['layoutPage'].keys())}")
        
        print("\n--- Saving HTML to check ---")
        with open('search_page.html', 'w', encoding='utf-8') as f:
            f.write(r.text)
        print("Saved to search_page.html")
    else:
        print("No page data found")
