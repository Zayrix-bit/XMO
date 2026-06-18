
import json

with open('page_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

def find_videos(obj, path="root"):
    if isinstance(obj, dict):
        for key, value in obj.items():
            new_path = f"{path}.{key}"
            if 'video' in key.lower() or 'thumb' in key.lower() or 'list' in key.lower():
                print(f"Found possible key at {new_path}: {key}")
            find_videos(value, new_path)
    elif isinstance(obj, list):
        for idx, item in enumerate(obj):
            new_path = f"{path}[{idx}]"
            if isinstance(item, dict) and ('title' in item or 'link' in item or 'image' in item or 'url' in item):
                print(f"Possible video item at {new_path}!")
                # Print first 2
                if idx < 5:
                    print(f"  Item {idx}: {json.dumps(item, indent=2, ensure_ascii=False)}")
            find_videos(item, new_path)

find_videos(data)
