import requests
import json

API_BASE = "http://localhost:8000"

query = "lesbian"
page = 1

print(f"Calling API: {API_BASE}/api/search?q={query}&page={page}")
r = requests.get(f"{API_BASE}/api/search?q={query}&page={page}")

print(f"Status: {r.status_code}")
data = r.json()
print(f"Response keys: {list(data.keys())}")

if data.get('status') == 'success':
    print(f"Used domain: {data.get('used_domain')}")
    print(f"Number of results: {len(data.get('results', []))}")
    print(f"First 3 results:")
    for i, video in enumerate(data['results'][:3]):
        print(f"\n  Video {i+1}:")
        print(f"  Title: {video.get('title')}")
        print(f"  Link: {video.get('link')}")
        print(f"  Image: {video.get('image')}")
else:
    print("Error")
    print(json.dumps(data, indent=2))
