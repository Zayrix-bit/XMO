import logging
from typing import Optional
from fastapi import APIRouter, Query
from bs4 import BeautifulSoup

from ..config import settings
from ..utils import fetch_with_fallback
from ..dependencies import get_http_client, get_cache

router = APIRouter(prefix="/api", tags=["categories"])
logger = logging.getLogger(__name__)

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

COUNTRY_SLUGS = {
    'indian', 'desi', 'russian', 'american', 'british', 'japanese', 'korean', 'chinese', 'german', 'french',
    'italian', 'spanish', 'brazilian', 'mexican', 'colombian', 'canadian', 'australian', 'filipino', 'thai',
    'vietnamese', 'indonesian', 'malaysian', 'arab', 'egyptian', 'moroccan', 'turkish', 'iranian', 'pakistani',
    'bangladeshi', 'sri-lankan', 'nepali', 'south-african', 'nigerian', 'kenyan', 'ukrainian', 'polish', 'czech',
    'hungarian', 'romanian', 'bulgarian', 'swedish', 'norwegian', 'danish', 'finnish', 'dutch', 'belgian', 'swiss',
    'austrian', 'greek', 'portuguese', 'argentinian', 'chilean', 'peruvian', 'venezuelan', 'cuban', 'puerto-rican',
    'dominican', 'jamaican', 'israeli', 'lebanese', 'syrian', 'iraqi', 'afghan', 'uzbek', 'kazakh', 'somali',
    'ethiopian', 'sudanese', 'ugandan', 'zimbabwean', 'zambian', 'tanzanian', 'ghanaian', 'cameroonian', 'senegalese',
    'ivorian', 'malian', 'guinean', 'angolan', 'mozambican', 'madagascan', 'rwandan', 'burundian', 'malawian',
    'botswanan', 'namibian', 'swazi', 'lesotho', 'mauritian', 'seychellois', 'comoran', 'djiboutian', 'eritrean',
    'south-sudanese', 'central-african', 'chadian', 'nigerien', 'burkinabe', 'togolese', 'beninese', 'liberian',
    'sierra-leonean', 'gambian', 'bissau-guinean', 'equatorial-guinean', 'gabonese', 'congolese', 'sao-tomean',
    'cape-verdean', 'saudi', 'emirati', 'qatari', 'kuwaiti', 'bahraini', 'omani', 'yemeni', 'jordanian', 'palestinian',
    'cypriot', 'maltese', 'georgian', 'armenian', 'azerbaijani', 'turkmen', 'tajik', 'kyrgyz', 'mongolian', 'taiwanese',
    'singaporean', 'bruneian', 'timorese', 'papuan', 'fijian', 'samoan', 'tongan', 'vanuatuan', 'solomon-islander',
    'micronesian', 'marshallese', 'palauan', 'nauruan', 'tuvaluan', 'kiribati', 'latvian', 'lithuanian', 'estonian',
    'belarusian', 'moldovan', 'slovak', 'slovenian', 'croatian', 'bosnian', 'serbian', 'montenegrin', 'macedonian',
    'albanian', 'kosovar', 'icelandic', 'irish', 'scottish', 'welsh', 'english', 'greenlandic', 'faroese', 'andorran',
    'monacan', 'sammarinese', 'vatican', 'liechtenstein', 'luxembourgish', 'bahamian', 'belizean', 'costa-rican',
    'salvadoran', 'guatemalan', 'honduran', 'nicaraguan', 'panamanian', 'antiguan', 'barbadian', 'grenadian', 'haitian',
    'kittitian', 'lucian', 'vincentian', 'trinidadian', 'surinamese', 'guyanese', 'ecuadorian', 'bolivian', 'paraguayan',
    'uruguayan', 'asian', 'latina', 'latino', 'euro', 'european', 'arabian', 'african', 'black', 'ebony', 'white'
}


@router.get("/categories")
async def get_categories():
    """Get all categories, countries, and languages."""
    try:
        cache = get_cache()
        cache_key = "categories:all"
        cached_value = cache.get(cache_key)
        if cached_value is not None:
            return cached_value

        http_client = get_http_client()
        response_text, domain = await fetch_with_fallback(
            "/categories",
            http_client,
            HEADERS,
            settings.xhamster_domains
        )
        
        if not response_text:
            return {"status": "error", "message": "No working xHamster domain found!"}
        
        soup = BeautifulSoup(response_text, 'html.parser')
        
        cats = []
        langs = []
        seen = set()
        
        for a in soup.select('a'):
            href = a.get('href', '')
            name = a.text.strip() or a.get('title', '').strip()
            if not name:
                name = a.get_text(strip=True)
                
            if '/categories/' in href and '/photos/' not in href and name:
                slug = href.rstrip('/').split('/')[-1]
                
                image_url = ""
                img_tag = a.select_one('img')
                if img_tag:
                    image_url = img_tag.get('src') or img_tag.get('data-src', '')
                
                cat_data = {"name": name, "slug": slug, "url": href, "image": image_url}
                
                if href not in seen:
                    seen.add(href)
                    if name.lower().startswith('porn in '):
                        langs.append(cat_data)
                    else:
                        cats.append(cat_data)
                else:
                    if image_url:
                        for cat in cats:
                            if cat['url'] == href and not cat['image']:
                                cat['image'] = image_url
                                break
                        for cat in langs:
                            if cat['url'] == href and not cat['image']:
                                cat['image'] = image_url
                                break
        
        normal_cats = []
        country_cats = []
        for cat in cats:
            if cat['slug'] in COUNTRY_SLUGS:
                country_cats.append(cat)
            else:
                normal_cats.append(cat)
        
        result = {
            "status": "success", 
            "categories": normal_cats, 
            "countries": country_cats,
            "languages": langs,
            "used_domain": domain
        }
        
        cache.set(cache_key, result, expire=86400)
        
        return result
    except Exception as e:
        logger.error(f"Error getting categories: {e}")
        return {"status": "error", "message": str(e)}


@router.get("/category/{slug}")
async def category_videos(slug: str, page: int = Query(1, description="Page number")):
    """Get videos for a specific category."""
    try:
        cache = get_cache()
        cache_key = f"category:{slug}:{page}"
        cached_value = cache.get(cache_key)
        if cached_value is not None:
            return cached_value

        http_client = get_http_client()
        response_text, domain = await fetch_with_fallback(
            f"/categories/{slug}/{page}",
            http_client,
            HEADERS,
            settings.xhamster_domains
        )
        
        if not response_text:
            return {"status": "error", "message": "No working xHamster domain found!"}
        
        from ..utils import parse_video_list
        videos = parse_video_list(response_text)
        
        result = {"status": "success", "category": slug, "page": page, "results": videos, "used_domain": domain}
        
        cache.set(cache_key, result, expire=settings.cache_ttl_seconds)
        
        return result
    except Exception as e:
        logger.error(f"Error getting category videos: {e}")
        return {"status": "error", "message": str(e)}
