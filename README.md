<div align="center">

# ⚡ XMO Engine & Streaming Platform

A high-performance, resilient video streaming platform and content scraper engine built with **Node.js (Express + Undici)** backend and a modern **React 19 + Vite** frontend. Features an intelligent multi-proxy rotation pool, domain racing, and adaptive HLS video streaming.

[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg?logo=node.js)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg?logo=docker)](https://www.docker.com/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB.svg?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF.svg?logo=vite)](https://vitejs.dev/)
[![Hugging Face](https://img.shields.io/badge/Hugging%20Face-Spaces-FFD21E.svg?logo=huggingface)](https://huggingface.co/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages-F38020.svg?logo=cloudflare)](https://pages.cloudflare.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 🌟 Key Highlights

- **🛡️ Smart Multi-Proxy Pool**: Supports multiple outbound proxies with automatic round-robin rotation and real-time failover to ensure 100% uptime and zero rate limits.
- **⚡ Concurrent Domain Racing**: Concurrently races mirror domains (`xhamster5.com`, `xhamster18.com`, `xhamster46.desi`) to respond with the lowest latency.
- **🎬 Adaptive HLS & Direct MP4 Streaming**: Native HLS proxy rewriting with multi-resolution bitrate switching (`1080p`, `720p`, `480p`, `240p`, `144p`).
- **📱 Fully Responsive UI**: Sleek dark-mode interface optimized for mobile viewports, tablets, and desktop navigation.
- **📊 Real-Time Diagnostic Endpoints**: Built-in `/api/ip` and `/api/health` endpoints for monitoring outbound proxy IPs and pool health.
- **📢 Advertising & Monetization**: Integrated VAST/IMA video preroll advertising with graceful AdBlocker fallbacks and recommendation banner slots.

---

## 🏗️ Architecture

```mermaid
graph TD
    Client[User Browser / nporno.online] -->|Cloudflare Pages| Frontend[React 19 + Vite]
    Frontend -->|REST API & HLS Streams| HFBackend[Hugging Face Docker Space / Express]
    
    subgraph Backend Core
        HFBackend --> Cache[In-Memory Cache Map]
        HFBackend --> ProxyPool[Undici Multi-Proxy Pool]
        ProxyPool -->|Round Robin Rotation| Proxy1[Proxy 1: Spain ES]
        ProxyPool -->|Auto-Failover| Proxy2[Proxy 2: US]
        ProxyPool -->|Auto-Failover| Proxy3[Proxy 3: NL]
    end

    ProxyPool -->|Scrapes Mirrors| CDN[xHamster CDNs & Mirrors]
    CDN -->|Encrypted Streams| HFBackend
    HFBackend -->|Proxied HLS Stream| Frontend
```

---

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 22 LTS
- **Framework**: Express 5
- **Networking**: `undici` with custom `ProxyAgent` dispatcher
- **Streaming**: Node.js native WebStreams & Pipeline
- **Deployment**: Docker container on Hugging Face Spaces (`PORT 7860`)

### Frontend
- **Framework**: React 19 + Vite
- **Styling**: Vanilla CSS + Tailwind CSS (Custom Dark Theme)
- **Player**: `hls.js` for adaptive bitrate streaming
- **Icons**: Lucide React
- **Deployment**: Cloudflare Pages / Static Edge Hosting

---

## 📡 API Reference

Base URL (Production): `https://backend-core-backend-core.hf.space`  
Base URL (Localhost): `http://localhost:7860`

| Method | Endpoint | Description | Query Parameters |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/trending` | Fetch trending video feed | `page` (default: 1) |
| `GET` | `/api/search` | Search video database | `q` (required), `page` |
| `GET` | `/api/video` | Video details, streams & related | `url` (encoded video URL) |
| `GET` | `/api/categories` | Complete list of all categories | none |
| `GET` | `/api/category/:slug` | Videos under a specific category | `page` (default: 1) |
| `GET` | `/api/ip` | Proxy pool status & outbound IP | none |
| `GET` | `/api/health` | Service uptime and server status | none |
| `GET` | `/api/clear-cache` | Flush server-side memory cache | none |
| `GET` | `/api/hls-proxy` | Rewrites & proxies `.m3u8` playlists | `url` |
| `GET` | `/api/proxy` | Media chunk proxy with range support | `url`, `download`, `title` |

### Sample Diagnostic Response (`GET /api/ip`)

```json
{
  "status": "success",
  "outbound_ip": "64.137.96.74",
  "proxy_active": true,
  "proxy_configured": true,
  "pool_size": 7,
  "proxies_configured": [
    "http://kbwsxnai:***@64.137.96.74:6641/",
    "http://kbwsxnai:***@198.23.243.226:6361/",
    "http://kbwsxnai:***@38.154.185.97:6370/"
  ],
  "proxy_error": null
}
```

---

## ⚙️ Environment Variables

### Backend (`.env` or Hugging Face Space Secrets)

| Variable | Description | Example |
| :--- | :--- | :--- |
| `PORT` | Listening port (Hugging Face requires `7860`) | `7860` |
| `HTTP_PROXY` | Single proxy OR comma-separated proxy pool | `http://user:pass@ip1:port,http://user:pass@ip2:port` |
| `WORKERS` | Cluster worker process count | `1` |

> [!TIP]
> **Recommended Proxy Locations:** Use proxies located in **Spain (ES)**, **United States (US)**, or **Netherlands (NL)** to bypass regional age-verification gates. Avoid UK proxies as UK legislation restricts unauthenticated video stream delivery.

### Frontend (`frontend/.env` or Cloudflare Pages)

| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Live backend API URL (no trailing slash) | `https://backend-core-backend-core.hf.space` |

---

## 🚀 Local Development Setup

### 1. Prerequisites
- **Node.js** >= 20.x
- **npm** >= 10.x

### 2. Clone Repository
```bash
git clone https://github.com/Zayrix-bit/XMO.git
cd XMO
```

### 3. Backend Setup
```bash
# Install backend dependencies
npm install

# Configure environment
copy .env.example .env

# Start backend server
npm start
```
*Backend will be running on `http://localhost:7860`.*

### 4. Frontend Setup
```bash
cd frontend

# Install frontend dependencies
npm install

# Start Vite dev server
npm run dev
```
*Frontend will be running on `http://localhost:5173`.*

---

## 🚢 Deployment

### Deploying Backend to Hugging Face Spaces (Docker)
1. Create a new Space on [Hugging Face](https://huggingface.co/new-space) with **SDK: Docker**.
2. Push or upload `Dockerfile`, `package.json`, `package-lock.json`, and `server.js`.
3. In **Settings -> Variables and secrets**, add your `HTTP_PROXY` secret with your proxy list.
4. Hugging Face will automatically build and start the container on port `7860`.

#### Hugging Face Space Settings
| Configuration | Value |
| :--- | :--- |
| **Space SDK** | `Docker` |
| **App Port** | `7860` |
| **Base Theme** | Indigo to Purple |
| **License** | MIT |

### Deploying Frontend to Cloudflare Pages
1. Connect your repository (`Zayrix-bit/XMO`) to Cloudflare Pages.
2. Configure build settings:
   - **Framework preset**: `Vite`
   - **Root directory**: `frontend`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
3. In **Settings -> Environment variables**, add:
   - `VITE_API_BASE_URL` = `https://<your-hf-space-subdomain>.hf.space`
4. Trigger deployment.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
