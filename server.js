const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const cluster = require('cluster');
const os = require('os');
const http = require('http');
const https = require('https');

dotenv.config();

const app = express();
app.use(cors());

// Cache setup
const cache = new Map();

const _USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0",
];

const XHAMSTER_DOMAINS = [
    'xhamster.com',
    'xhamster.desi',
    'xhamster2.com',
    'xhamster3.com',
    'xhamster46.com',
    'xhamster5.com',
    'xhamster18.com'
];

let globalCookies = {};

function setBypassCookies(domain) {
    globalCookies['age_gate'] = '1';
    globalCookies['age_gate2'] = '1';
    globalCookies['isAgeVerified'] = 'true';
    globalCookies['is_sfw'] = 'false';
    globalCookies['isSFW'] = 'false';
    globalCookies['parental_control'] = 'false';
    globalCookies['disableSFW'] = '1';
    globalCookies['isFirstVisit'] = 'false';
    globalCookies['hasSeenAgeGate'] = 'true';
}

// Initialize bypass cookies immediately
setBypassCookies();

// Periodic cache cleanup to prevent memory leaks (runs every 10 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
        // Remove entries older than 24 hours to free memory
        if (now - value.timestamp > 86400 * 1000) {
            cache.delete(key);
        }
    }
}, 10 * 60 * 1000);

function getCookiesString() {
    return Object.entries(globalCookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

function updateCookies(setCookieHeader) {
    if (!setCookieHeader) return;
    const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    headers.forEach(header => {
        const parts = header.split(';')[0].split('=');
        if (parts.length >= 2) {
            const key = parts[0];
            const val = parts.slice(1).join('=');
            globalCookies[key] = val;
        }
    });
}

function getHeaders(domain = 'xhamster.desi') {
    const ua = _USER_AGENTS[Math.floor(Math.random() * _USER_AGENTS.length)];
    const headers = {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Referer": `https://${domain}/`,
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
        "Cookie": getCookiesString()
    };

    if (ua.includes("Chrome") || ua.includes("Edg")) {
        Object.assign(headers, {
            "Sec-Ch-Ua": '"Chromium";v="133", "Not_A Brand";v="24", "Google Chrome";v="133"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
        });
    }
    return headers;
}

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

function getClient() {
    return axios.create({
        timeout: 30000,
        maxRedirects: 5,
        validateStatus: () => true,
        httpAgent,
        httpsAgent
    });
}

function extractPageData(html) {
    let largestData = null;
    let largestSize = 0;

    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = scriptRegex.exec(html)) !== null) {
        const content = match[1];
        if (!content) continue;

        let startIdx = 0;
        while (true) {
            const startBrace = content.indexOf('{', startIdx);
            if (startBrace === -1) break;

            let braceCount = 1;
            let endBrace = startBrace + 1;

            while (endBrace < content.length && braceCount > 0) {
                if (content[endBrace] === '{') braceCount++;
                else if (content[endBrace] === '}') braceCount--;
                endBrace++;
            }

            if (braceCount === 0) {
                const jsonStr = content.slice(startBrace, endBrace);
                try {
                    const data = JSON.parse(jsonStr);
                    const size = jsonStr.length;
                    if (data && typeof data === 'object' && size > largestSize) {
                        largestSize = size;
                        largestData = data;
                    }
                } catch (e) { }
            }
            startIdx = endBrace;
        }
    }
    return largestData;
}

function formatDuration(seconds) {
    if (!seconds) return '00:00';
    if (typeof seconds === 'string' && seconds.includes(':')) return seconds;
    seconds = parseInt(seconds) || 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatViews(views) {
    views = parseInt(views) || 0;
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
    return views.toString();
}

function findVideoThumbProps(obj) {
    if (!obj || typeof obj !== 'object') return null;
    if (Array.isArray(obj)) {
        for (let item of obj) {
            const res = findVideoThumbProps(item);
            if (res) return res;
        }
        return null;
    }
    for (let key in obj) {
        if (key === 'videoThumbProps' && Array.isArray(obj[key])) return obj[key];
        const res = findVideoThumbProps(obj[key]);
        if (res) return res;
    }
    return null;
}

function parseVideoList(pageData) {
    const videos = [];
    if (!pageData) return videos;

    const vtp = findVideoThumbProps(pageData);
    if (vtp) {
        vtp.forEach(item => {
            try {
                const title = item.title || '';
                const link = item.pageURL || '';
                const image = item.imageURL || item.thumbURL || '';
                const duration = formatDuration(item.duration);
                const videoId = String(item.id || '');
                const views = formatViews(item.views);
                const previewVideo = item.trailerFallbackUrl || item.trailerURL || '';

                if (link && title) {
                    videos.push({ id: videoId, title, link, image, duration, views, previewVideo });
                }
            } catch (e) { }
        });
    }
    return videos;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchHtmlAxios(url) {
    const client = getClient();
    try {
        const domain = new URL(url).hostname;
        const headers = getHeaders(domain);
        const res = await client.get(url, { headers });
        
        // Capture and update cookies from response to maintain session state
        if (res.headers['set-cookie']) {
            updateCookies(res.headers['set-cookie']);
        }
        
        if (res.status !== 200 && res.status !== 404) {
            console.log(`[AXIOS] Non-200 status ${res.status} on ${url}`);
        }
        return res.data;
    } catch (e) {
        throw e;
    }
}

async function fetchWithFallback(path, useHttps = true) {
    const protocol = useHttps ? 'https' : 'http';
    const allDomains = [...XHAMSTER_DOMAINS].sort(() => 0.5 - Math.random());

    // Race the first 3 domains concurrently for maximum speed
    const domainsToRace = allDomains.slice(0, 3);
    console.log(`[AXIOS] Racing domains: ${domainsToRace.join(', ')} for ${path}`);

    const promises = domainsToRace.map(async (domain) => {
        const url = `${protocol}://${domain}${path}`;
        const html = await fetchHtmlAxios(url);
        const pageData = extractPageData(html);
        const isCategories = path === '/categories' && pageData && Object.keys(pageData).length > 0;
        const vtp = findVideoThumbProps(pageData);

        if (isCategories || (vtp && vtp.length > 0) || (pageData && pageData.infoComponent)) {
            console.log(`[AXIOS] Fast-Response won by: ${domain}${path}`);
            return { html, domain, pageData };
        }
        throw new Error(`Invalid data on ${domain}`);
    });

    try {
        return await Promise.any(promises);
    } catch (e) {
        console.log(`[AXIOS] Fast race failed for ${path}. Falling back to sequential...`);
        // Fallback sequentially to the rest if the initial race failed
        for (let domain of allDomains.slice(3)) {
            try {
                const url = `${protocol}://${domain}${path}`;
                const html = await fetchHtmlAxios(url);
                const pageData = extractPageData(html);
                const isCategories = path === '/categories';
                const vtp = findVideoThumbProps(pageData);

                if (isCategories || (vtp && vtp.length > 0) || (pageData && pageData.infoComponent)) {
                    console.log(`[AXIOS] Fallback Success on ${domain}${path}`);
                    return { html, domain, pageData };
                }
            } catch (err) { }
        }
    }
    return { html: null, domain: null, pageData: null };
}

function cacheResponse(ttlSeconds) {
    return (req, res, next) => {
        const key = req.originalUrl || req.url;
        const cachedResponse = cache.get(key);

        if (cachedResponse) {
            const isFresh = (Date.now() - cachedResponse.timestamp) < ttlSeconds * 1000;
            if (isFresh) {
                return res.json(cachedResponse.data);
            } else {
                res.json(cachedResponse.data);
                const noop = () => { };
                res.setHeader = noop;
                res.header = noop;
                res.status = function () { return this; };
                res.send = noop;
                res.end = noop;
                res.json = (body) => {
                    if (body && body.status === 'success') {
                        cache.set(key, { timestamp: Date.now(), data: body });
                    }
                };
                return next();
            }
        }

        const originalJson = res.json;
        res.json = (body) => {
            if (body && body.status === 'success') {
                cache.set(key, { timestamp: Date.now(), data: body });
            }
            if (!res.headersSent) {
                originalJson.call(res, body);
            }
        };
        next();
    };
}

// Routes
app.get('/', (req, res) => {
    res.json({ status: "success", message: "xHamster Scraper API (Node.js) is running!" });
});

app.get('/api/clear-cache', (req, res) => {
    cache.clear();
    res.json({ status: "success", message: "Cache cleared successfully!" });
});

app.get('/api/search', cacheResponse(3600), async (req, res) => {
    const q = req.query.q;
    const page = parseInt(req.query.page) || 1;
    if (!q) return res.status(400).json({ status: "error", message: "Missing query parameter 'q'" });

    const queryEncoded = encodeURIComponent(q).replace(/%20/g, "+");
    let pathStr = `/search/${queryEncoded}`;
    if (page > 1) pathStr += `?page=${page}`;

    const { html, domain, pageData } = await fetchWithFallback(pathStr);
    if (!html) return res.status(500).json({ status: "error", message: "No working domain found" });

    const videos = parseVideoList(pageData);
    res.json({ status: "success", query: q, page, results: videos, used_domain: domain });
});

app.get('/api/trending', cacheResponse(600), async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pathStr = page === 1 ? "/" : `/best/monthly/${page}`;

    const { html, domain, pageData } = await fetchWithFallback(pathStr);
    if (!html) return res.status(500).json({ status: "error", message: "No working domain found" });

    const videos = parseVideoList(pageData);
    res.json({ status: "success", page, results: videos, used_domain: domain });
});

app.get('/api/newest', cacheResponse(600), async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const { html, domain, pageData } = await fetchWithFallback(`/newest/${page}`);
    if (!html) return res.status(500).json({ status: "error", message: "No working domain found" });

    const videos = parseVideoList(pageData);
    res.json({ status: "success", page, results: videos, used_domain: domain });
});

app.get('/api/creator/:slug', cacheResponse(3600), async (req, res) => {
    const slug = req.params.slug;
    const page = parseInt(req.query.page) || 1;

    let pathStr = `/creators/${slug}`;
    if (page > 1) pathStr += `/${page}`;

    let result = await fetchWithFallback(pathStr);
    if (!result.html) {
        pathStr = `/users/${slug}`;
        if (page > 1) pathStr += `/${page}`;
        result = await fetchWithFallback(pathStr);
    }

    if (!result.html) return res.status(500).json({ status: "error", message: "Could not fetch creator profile" });

    let creator = null;
    const pageData = result.pageData;
    if (pageData && pageData.infoComponent && pageData.infoComponent.pornstarTop) {
        const top = pageData.infoComponent.pornstarTop;
        creator = {
            name: top.name,
            avatar: top.thumbUrl,
            country: top.country,
            translatedCountryName: top.translatedCountryName,
            viewsCount: formatViews(top.viewsCount),
            videoCount: top.videoCount,
            rating: top.rating,
            subscribers: pageData.infoComponent.subscribeButtonsProps?.subscribeButtonProps?.subscribers || null
        };
    }

    const videos = parseVideoList(pageData);
    res.json({ status: "success", creator, videos, page, used_domain: result.domain });
});

app.get('/api/categories', cacheResponse(86400), async (req, res) => {
    try {
        const { html, domain, pageData } = await fetchWithFallback('/categories');
        if (!html) throw new Error("No HTML found");
        
        const cats = [];
        const langs = [];
        const seen = new Set();

        function processCat(name, href, image) {
            if (!href.includes('/categories/') || href.includes('/photos/') || !name) return;
            const slug = href.replace(/\/$/, '').split('/').pop();
            const catData = { name, slug, url: href, image };
            
            if (!seen.has(href)) {
                seen.add(href);
                if (name.toLowerCase().startsWith('porn in ')) langs.push(catData);
                else cats.push(catData);
            } else if (image) {
                const existingCat = cats.find(c => c.url === href) || langs.find(c => c.url === href);
                if (existingCat && !existingCat.image) existingCat.image = image;
            }
        }

        // 1. Try to extract from inline JSON first (highly robust)
        function extractCatsFromJson(obj) {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) {
                obj.forEach(item => extractCatsFromJson(item));
                return;
            }
            if (obj.url && obj.url.includes('/categories/') && obj.name) {
                processCat(obj.name, obj.url, obj.thumb || obj.icon || '');
            } else {
                for (let key in obj) extractCatsFromJson(obj[key]);
            }
        }
        
        if (pageData) extractCatsFromJson(pageData);

        // 2. Fallback to Cheerio HTML extraction if JSON missed some
        const $ = cheerio.load(html);
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const name = $(el).text().trim() || $(el).attr('title') || '';
            const imgTag = $(el).find('img');
            const image = imgTag.attr('src') || imgTag.attr('data-src') || '';
            processCat(name, href, image);
        });

        const COUNTRY_SLUGS = new Set([
            'indian', 'desi', 'russian', 'american', 'british', 'japanese', 'korean', 'chinese', 'german', 'french',
            'italian', 'spanish', 'brazilian', 'mexican', 'colombian', 'canadian', 'australian', 'asian', 'latina'
        ]);
        const BLOCKED_SLUGS = new Set(['granny']);

        const normal_cats = cats.filter(c => !COUNTRY_SLUGS.has(c.slug) && !BLOCKED_SLUGS.has(c.slug));
        const country_cats = cats.filter(c => COUNTRY_SLUGS.has(c.slug) && !BLOCKED_SLUGS.has(c.slug));

        if (normal_cats.length === 0) {
            throw new Error("No categories found in DOM or JSON on " + domain);
        }

        res.json({ status: "success", categories: normal_cats, countries: country_cats, languages: langs, used_domain: domain });
    } catch (e) {
        // Ultimate Fallback to prevent UI crash if xhamster scraping fails
        const fallbackCats = [
            { name: 'Amateur', slug: 'amateur' },
            { name: 'Lesbian', slug: 'lesbian' },
            { name: 'Homemade', slug: 'homemade' },
            { name: '18 Year Old', slug: '18-year-old' },
            { name: 'Anal', slug: 'anal' },
            { name: 'Mom', slug: 'mom' },
            { name: 'Creampie', slug: 'creampie' },
            { name: '3D', slug: '3d' },
            { name: 'Behind the Scenes', slug: 'behind-the-scenes' },
            { name: 'Cartoon', slug: 'cartoon' },
            { name: 'Compilation', slug: 'compilation' },
            { name: 'Cosplay', slug: 'cosplay' },
            { name: 'MILF', slug: 'milf' },
            { name: 'Teens', slug: 'teens' },
            { name: 'Bisexual', slug: 'bisexual' },
            { name: 'VR', slug: 'vr' }
        ];
        res.json({ status: "success", categories: fallbackCats, countries: [], languages: [], used_domain: 'fallback' });
    }
});

app.get('/api/category/:slug', cacheResponse(3600), async (req, res) => {
    const slug = req.params.slug;
    const page = parseInt(req.query.page) || 1;
    const { html, domain, pageData } = await fetchWithFallback(`/categories/${slug}/${page}`);
    if (!html) return res.status(500).json({ status: "error", message: "No working domain found" });

    const videos = parseVideoList(pageData);
    res.json({ status: "success", category: slug, page, results: videos, used_domain: domain });
});

app.get('/api/video', cacheResponse(600), async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ status: "error", message: "Missing url parameter" });

    try {
        const parsedUrl = new URL(videoUrl);
        const domain = parsedUrl.hostname;
        const html = await fetchHtmlAxios(videoUrl);
        const $ = cheerio.load(html);
        const pageData = extractPageData(html);

        let videoTitle = $('h1.with-player-container').text().trim() || $('h1').text().trim() || 'Untitled Video';

        let views = null;
        let uploader = null;

        if (pageData) {
            for (let viewKey of ['videoModel', 'videoEntity', 'videoHeadingComponent', 'videoTitle']) {
                if (pageData[viewKey] && pageData[viewKey].views) {
                    views = formatViews(pageData[viewKey].views);
                    break;
                }
            }
            if (pageData.videoModel && pageData.videoModel.author) {
                const author = pageData.videoModel.author;
                const landing = pageData.videoModel.landing || {};
                uploader = {
                    name: landing.name || author.name,
                    username: author.name,
                    avatar: landing.logo || '',
                    profile_url: landing.link || author.pageURL
                };
            }
        }

        const related = parseVideoList(pageData);

        const cleanHtml = html.replace(/\\\//g, '/');
        const m3u8Links = [...new Set(cleanHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g) || [])];
        const allMp4Links = [...new Set(cleanHtml.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/g) || [])];
        const mp4Links = allMp4Links.filter(u => !u.includes('.m3u8') && !u.includes('thumb'));

        let directUrl = null;
        const qualityMp4s = mp4Links.filter(u => ['1080p', '720p', '480p', '240p'].some(q => u.includes(q)));

        if (qualityMp4s.length > 0) {
            for (let q of ['1080p', '720p', '480p', '240p']) {
                let match = qualityMp4s.find(u => u.includes(q));
                if (match) { directUrl = match; break; }
            }
        } else if (mp4Links.length > 0) {
            directUrl = mp4Links[0];
        }

        const proxyUrl = directUrl ? `/api/proxy?url=${encodeURIComponent(directUrl)}` : null;
        const hlsProxyUrl = m3u8Links.length > 0 ? `/api/hls-proxy?url=${encodeURIComponent(m3u8Links[0])}` : null;

        res.json({
            status: "success",
            title: videoTitle,
            views,
            uploader,
            direct_url: directUrl,
            proxy_url: proxyUrl,
            hls_proxy_url: hlsProxyUrl,
            related,
            streams: { m3u8: m3u8Links, mp4: mp4Links },
            original_url: videoUrl,
            original_domain: domain
        });

    } catch (e) {
        res.status(500).json({ status: "error", message: e.message });
    }
});

// Proxy logic
app.get('/api/proxy', async (req, res) => {
    const url = req.query.url;
    const isDownload = req.query.download === 'true';
    if (!url) return res.status(400).send("Missing URL");

    try {
        let refererDomain = 'xhamster.desi';
        for (let d of XHAMSTER_DOMAINS) {
            if (url.includes(d)) { refererDomain = d; break; }
        }

        const proxyHeaders = getHeaders(refererDomain);
        proxyHeaders['Origin'] = `https://${refererDomain}`;
        if (req.headers.range) {
            proxyHeaders['Range'] = req.headers.range;
        }

        const client = getClient();
        const response = await client.get(url, {
            headers: proxyHeaders,
            responseType: 'stream'
        });

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');

        ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'].forEach(h => {
            if (response.headers[h]) res.setHeader(h, response.headers[h]);
        });

        if (isDownload) {
            let title = req.query.title ? req.query.title.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 80).trim() : 'video';
            if (!title) title = 'video';
            res.setHeader('Content-Disposition', `attachment; filename="${title}.mp4"`);
        }

        res.status(response.status);
        response.data.pipe(res);

    } catch (e) {
        res.status(500).json({ status: "error", message: e.message });
    }
});

app.get('/api/hls-proxy', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send("Missing URL");

    try {
        let refererDomain = 'xhamster.desi';
        for (let d of XHAMSTER_DOMAINS) {
            if (url.includes(d)) { refererDomain = d; break; }
        }

        const proxyHeaders = getHeaders(refererDomain);
        proxyHeaders['Origin'] = `https://${refererDomain}`;

        const client = getClient();
        const response = await client.get(url, { headers: proxyHeaders, responseType: 'text' });

        let content = response.data;
        const contentType = response.headers['content-type'] || 'application/vnd.apple.mpegurl';

        if (url.includes('.m3u8') || contentType.toLowerCase().includes('mpegurl') || content.trim().startsWith('#EXTM3U')) {
            let rewritten = [];

            content.split('\n').forEach(line => {
                line = line.trim();
                if (!line) return;

                if (line.startsWith('#')) {
                    if (line.includes('URI="')) {
                        const match = line.match(/URI="([^"]+)"/);
                        if (match) {
                            let origUri = match[1];
                            if (!origUri.startsWith('http')) {
                                origUri = new URL(origUri, url).href;
                            }
                            const proxied = `/api/hls-proxy?url=${encodeURIComponent(origUri)}`;
                            const scheme = req.headers['x-forwarded-proto'] || req.protocol;
                            const host = req.headers['x-forwarded-host'] || req.get('host');
                            line = line.replace(match[0], `URI="${scheme}://${host}${proxied}"`);
                        }
                    }
                    rewritten.push(line);
                } else {
                    let segmentUrl = line;
                    if (!segmentUrl.startsWith('http')) {
                        segmentUrl = new URL(segmentUrl, url).href;
                    }

                    const scheme = req.headers['x-forwarded-proto'] || req.protocol;
                    const host = req.headers['x-forwarded-host'] || req.get('host');
                    let proxied = "";
                    if (segmentUrl.includes('.m3u8')) {
                        proxied = `${scheme}://${host}/api/hls-proxy?url=${encodeURIComponent(segmentUrl)}`;
                    } else {
                        // Bypass backend proxy for video chunks (.ts files) to save massive bandwidth.
                        // The client browser will download them directly from the CDN.
                        proxied = segmentUrl;
                    }
                    rewritten.push(proxied);
                }
            });

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.send(rewritten.join('\n'));
        } else {
            const streamRes = await client.get(url, { headers: proxyHeaders, responseType: 'stream' });
            res.setHeader('Access-Control-Allow-Origin', '*');
            ['content-type', 'content-length'].forEach(h => {
                if (streamRes.headers[h]) res.setHeader(h, streamRes.headers[h]);
            });
            streamRes.data.pipe(res);
        }
    } catch (e) {
        res.status(500).json({ status: "error", message: e.message });
    }
});

const PORT = process.env.PORT || 7860;
const numCPUs = process.env.WORKERS ? parseInt(process.env.WORKERS) : 1; // Default to 1 for lightweight memory footprint

async function prewarmCache() {
    console.log(`[Worker ${process.pid}] Pre-warming cache (Trending, Newest, Categories)...`);
    try {
        // Hitting our own endpoints to trigger the route handlers and populate cache automatically
        await axios.get(`http://localhost:${PORT}/api/categories`);
        await axios.get(`http://localhost:${PORT}/api/trending`);
        await axios.get(`http://localhost:${PORT}/api/newest`);
        console.log(`[Worker ${process.pid}] Pre-warm complete! Cache is super ready.`);
    } catch (e) {
        console.log(`[Worker ${process.pid}] Pre-warm failed:`, e.message);
    }
}

if (cluster.isPrimary && numCPUs > 1) {
    console.log(`Master Server is running. Starting ${numCPUs} workers...`);
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died. Starting a new one...`);
        cluster.fork();
    });
} else {
    app.listen(PORT, () => {
        console.log(`Worker ${process.pid} is running on port ${PORT}`);
        prewarmCache(); // Pre-fetch data on start
    });
}
