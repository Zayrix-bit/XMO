# Nighthub Video Platform

## Overview
This is a modern, professional-looking video streaming platform that scrapes and proxies content from xHamster domains. It includes a clean frontend built with React + Vite and a backend API built with FastAPI.

## What It Scrapes
The platform scrapes the following from xHamster:
- **Trending videos**
- **Search results**
- **Single video details** (including title, thumbnail, duration, views, etc.)
- **Related videos for each watch page**
- **Video categories** (A-Z)
- **Video streaming URLs** (both direct and HLS streams)

## Tech Stack
### Backend
- **Python 3.12+**
- **FastAPI**: Web framework
- **httpx**: Async HTTP client
- **BeautifulSoup4**: HTML parsing
- **diskcache**: Persistent caching (stores scraped data locally for faster loads)
- **uvicorn[standard]**: ASGI server
- **pydantic-settings**: Configuration management

### Frontend
- **React 19.2.6**: UI library
- **Vite 8.0.12**: Build tool
- **Tailwind CSS 3.4.1**: Styling
- **React Router DOM 7.18.0**: Navigation
- **hls.js 1.6.16**: HLS video playback support
- **Lucide React 1.20.0**: Icons
- **Axios 1.18.0**: HTTP client

## Setup Instructions

### 1. Prerequisites
Install the following tools on your machine:
- Python 3.12 or higher
- Node.js 18 or higher
- npm or yarn

### 2. Clone the Project
```bash
cd c:\Users\Ritesh\Downloads\hm  # or your project directory
```

### 3. Set Up Backend
1. Navigate to the root directory:
```bash
cd c:\Users\Ritesh\Downloads\hm
```
2. (Optional) Create a virtual environment:
```bash
python -m venv venv
# On Windows
venv\Scripts\activate
# On Linux/Mac
source venv/bin/activate
```
3. Install Python dependencies:
```bash
pip install -r requirements.txt
```
4. (Optional) Copy the example environment file and customize:
```bash
copy .env.example .env
# Or on Linux/Mac
cp .env.example .env
```

### 4. Set Up Frontend
1. Navigate to frontend folder:
```bash
cd frontend
```
2. Install npm dependencies:
```bash
npm install
```

## Running the Project

### Quick Start (Windows Only)
The easiest way to start both servers is to **double-click `start.bat`** in the project root directory!
This will open two terminals and start both backend and frontend automatically.

Alternatively, you can use these batch files:
- `start-backend.bat`: Only start the backend server
- `start-frontend.bat`: Only start the frontend server

### Manual Start

#### Start Backend Server
In one terminal, from the root directory:
```bash
# For development (with auto-reload)
uvicorn app.main:app --reload

# For production
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
This will start the API server on `http://localhost:8000`

You can also view the automatic API documentation at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

#### Start Frontend Dev Server
In another terminal, from the frontend directory:
```bash
cd frontend
npm run dev
```
This will start the frontend on `http://localhost:5173` (check terminal for exact port)

## API Endpoints
All endpoints are accessible at `http://localhost:8000`

### `/api/trending`
Get trending videos, supports pagination with `page` parameter

### `/api/search`
Search for videos, with query and page params

### `/api/video`
Get single video data and proxy streaming URL

### `/api/categories`
Get all categories A-Z for the footer

### `/api/clear-cache`
Clear locally stored cached responses

## Project Structure
```
hm/
├── app/                    # FastAPI backend package
│   ├── __init__.py
│   ├── main.py             # FastAPI application entry point
│   ├── config.py           # Configuration settings
│   ├── dependencies.py     # Shared dependencies (HTTP client, cache, etc.)
│   ├── utils.py            # Helper functions (scraping, formatting, etc.)
│   └── routers/            # API route modules
│       ├── __init__.py
│       ├── proxy.py        # Video proxy and HLS endpoints
│       ├── videos.py       # Video-related endpoints
│       ├── categories.py   # Category endpoints
│       └── creators.py     # Creator endpoints
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   └── Footer.jsx
│   │   └── pages/
│   │       ├── Home.jsx
│   │       ├── Watch.jsx
│   │       └── Creator.jsx
│   └── package.json
├── .cache/                 # Persistent cache directory
├── .env.example            # Example environment variables
├── .gitignore
├── requirements.txt        # Python dependencies
└── README.md               # This file
```

## Features
- Clean, dark theme design
- Search functionality
- Video scrubbing with preview
- Watch page with related videos
- Categories section in footer
- Views counter on video cards
- Video playback with HLS support
- Persistent caching for faster performance
