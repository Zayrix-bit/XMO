from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Application settings
    app_name: str = "XHamster Scraper API"
    debug: bool = True
    
    # Server settings
    host: str = "0.0.0.0"
    port: int = 7860
    
    # CORS settings
    backend_cors_origins: List[str] = ["*"]
    
    # XHamster settings
    xhamster_domains: List[str] = [
        "xhamster.com",
        "xhamster.desi",
        "xhamster2.com",
        "xhamster3.com",
        "xhamster4.com",
        "xhamster5.com",
        "xhamster6.com",
        "xhamster7.com",
        "xhamster8.com",
        "xhamster9.com",
        "xhamster10.com",
    ]
    
    # Cache settings
    cache_ttl_seconds: int = 3600
    cache_dir: str = ".cache"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
