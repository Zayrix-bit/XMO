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
- **BeautifulSoup4**: HTML parsing
- **Requests**: HTTP client
- **diskcache**: Persistent caching (stores scraped data locally for faster loads)
- **uvicorn**: ASGI server

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
2. Install Python dependencies:
```bash
pip install fastapi beautifulsoup4 requests uvicorn diskcache
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

### Start Backend Server
In one terminal, from the root directory:
```bash
python main.py
```
This will start the API server on `http://localhost:8000`

### Start Frontend Dev Server
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
├── main.py                 # FastAPI backend
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   └── Footer.jsx
│   │   └── pages/
│   │       ├── Home.jsx
│   │       └── Watch.jsx
│   └── package.json
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
