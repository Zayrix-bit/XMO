
import requests

# Clear cache first!
print("Clearing cache...")
cache_clear_url = "http://localhost:8000/api/clear-cache"
response = requests.get(cache_clear_url)
print(f"Cache clear: {response.status_code} - {response.json()}")

# Now call search
url = "http://localhost:8000/api/search?q=lesbian&page=1"
print(f"\nCalling API: {url}")
response = requests.get(url)

print(f"Status: {response.status_code}")

data = response.json()

print(f"Response keys: {list(data.keys())}")

if data.get("status") == "success":
    print(f"Used domain: {data.get('used_domain')}")
    print(f"Number of results: {len(data.get('results', []))}")
    print("\nAll results (index + title):")
    for i, video in enumerate(data.get('results', [])):
        print(f"{i+1}. {video.get('title')}")
