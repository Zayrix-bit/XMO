import requests

def test_endpoint(name, url):
    print(f"Testing {name} ({url})...")
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'success':
                results = data.get('results', data.get('categories', []))
                print(f"[SUCCESS] {len(results)} items found.")
                if name == "Search Videos" and results:
                    return results[0]['link']
            else:
                print(f"[FAILED] API returned error - {data.get('message')}")
        else:
            print(f"[FAILED] HTTP {response.status_code}")
    except Exception as e:
        print(f"[FAILED] Exception - {e}")
    print("-" * 40)
    return None

if __name__ == "__main__":
    base_url = "http://localhost:8000"
    
    # 1. Home
    test_endpoint("Home", f"{base_url}/")
    
    # 2. Categories
    test_endpoint("Categories", f"{base_url}/api/categories")
    
    # 3. Trending
    test_endpoint("Trending", f"{base_url}/api/trending?page=1")
    
    # 4. Search
    first_video_link = test_endpoint("Search Videos", f"{base_url}/api/search?q=milf&page=1")
    
    # 5. Video Stream
    if first_video_link:
        print(f"Testing Video Stream using link: {first_video_link}")
        test_endpoint("Video Stream Details", f"{base_url}/api/video?url={first_video_link}")
