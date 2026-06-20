import requests
from bs4 import BeautifulSoup
import json

r = requests.get('https://xhamster.com/categories', headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
soup = BeautifulSoup(r.text, 'html.parser')

images = []
for a in soup.select('a[href*="/categories/"]'):
    img = a.select_one('img')
    if img:
        images.append({
            'name': a.text.strip(),
            'src': img.get('src'),
            'data-src': img.get('data-src')
        })

print(json.dumps(images[:20], indent=2))
