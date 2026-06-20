import requests
from bs4 import BeautifulSoup

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
}

def check_categories():
    response = requests.get("https://xhamster.com/categories", headers=HEADERS)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    links = soup.select('a')
    cats = []
    langs = []
    
    seen_slugs = set()
    for a in links:
        href = a.get('href', '')
        name = a.text.strip()
        
        # Only want main video categories, not photos/creators/etc.
        if '/categories/' in href and '/photos/' not in href and name:
            slug = href.rstrip('/').split('/')[-1]
            if slug in seen_slugs:
                continue
            seen_slugs.add(slug)
            
            if name.lower().startswith('porn in '):
                langs.append({"name": name, "slug": slug, "url": href})
            else:
                cats.append({"name": name, "slug": slug, "url": href})
                
    print(f"Categories: {len(cats)}, Languages: {len(langs)}")
    print("Some Languages:", langs[:5])
    print("Some Categories:", cats[:5])

if __name__ == "__main__":
    check_categories()
