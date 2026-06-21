import requests
from bs4 import BeautifulSoup
import re
import json

# Let's test search endpoint
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
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

url = f"https://xhamster.desi/search/video?q={query}&page={page}"
print(f"Testing URL: {url}")
r = requests.get(url, headers=HEADERS, timeout=10)
print(f"Status: {r.status_code}")

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
        if 'searchResult' in page_data:
            print(f"searchResult keys: {list(page_data['searchResult'].keys())}")
        if 'layoutPage' in page_data:
            print(f"layoutPage keys: {list(page_data['layoutPage'].keys())}")
        
        print("\n--- Saving HTML to check ---")
        with open('search_page.html', 'w', encoding='utf-8') as f:
            f.write(r.text)
        print("Saved to search_page.html")
    else:
        print("No page data found")
