
import sys
sys.path.insert(0, '')
from main import extract_page_data, fetch_with_fallback
import json

print("Fetching video page...")
response, domain = fetch_with_fallback("/videos/homemade-sex-with-a-mature-big-tits-xht0rfG")

if response:
    page_data = extract_page_data(response.text)
    if page_data:
        # Check for subscriptionComponent
        print("Checking subscriptionComponent...")
        if 'subscriptionComponent' in page_data:
            print(json.dumps(page_data['subscriptionComponent'], indent=2, default=str))
        
        # Check videoTagsComponent
        print("\nChecking videoTagsComponent...")
        if 'videoTagsComponent' in page_data:
            print(json.dumps(page_data['videoTagsComponent'], indent=2, default=str))
        
        # Save full page data
        with open('page_data_full.json', 'w', encoding='utf-8') as f:
            json.dump(page_data, f, indent=2, default=str)
        print("\nSaved full page data to page_data_full.json!")
    else:
        print("Could not extract page data")
else:
    print("Failed to fetch page")
