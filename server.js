const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');

dotenv.config();

const app = express();
app.use(cors());

// Cache setup
const cache = new Map();

// Proxy configuration
let _proxyList = [];
function loadProxies() {
    const proxyStr = process.env.PROXY_LIST || "";
    if (proxyStr) {
        _proxyList = proxyStr.replace(/,/g, " ").split(/\s+/).filter(p => p.trim() !== "");
    }
    const singleHttp = process.env.HTTP_PROXY || process.env.http_proxy;
    const singleHttps = process.env.HTTPS_PROXY || process.env.https_proxy;
    
    if (singleHttp && !_proxyList.includes(singleHttp)) _proxyList.push(singleHttp);
    else if (singleHttps && !_proxyList.includes(singleHttps)) _proxyList.push(singleHttps);
    
    console.log(`Loaded ${_proxyList.length} proxies from env`);
}
loadProxies();

const _USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0",
];

const XHAMSTER_DOMAINS = [
    'xhamster.desi', 'xhamster.com', 'xhamster2.com', 'xhamster3.com', 'xhamster4.com',
    'xhamster5.com', 'xhamster6.com', 'xhamster7.com', 'xhamster8.com', 'xhamster9.com',
    'xhamster10.com', 'xhamster11.com', 'xhamster12.com', 'xhamster13.com', 'xhamster14.com',
    'xhamster15.com', 'xhamster16.com', 'xhamster17.com', 'xhamster18.com', 'xhamster19.com',
    'xhamster20.com',
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
        "Referer": "https://www.google.com/",
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

function getClient(proxyUrl = null) {
    const config = {
        timeout: 60000,
        maxRedirects: 5,
        validateStatus: () => true,
    };
    if (proxyUrl) {
        config.httpsAgent = new HttpsProxyAgent(proxyUrl);
    }
    return axios.create(config);
}

function extractPageData(html) {
    const $ = cheerio.load(html);
    let largestData = null;
    let largestSize = 0;

    $('script').each((i, el) => {
        const content = $(el).html();
        if (!content) return;
        
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
                } catch (e) {}
            }
            startIdx = endBrace;
        }
    });
    return largestData;
}

function formatDuration(seconds) {
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

                if (link && title) {
                    videos.push({ id: videoId, title, link, image, duration, views });
                }
            } catch (e) {}
        });
    }
    return videos;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchWithFallback(path, useHttps = true) {
    const protocol = useHttps ? 'https' : 'http';
    const allDomains = [...XHAMSTER_DOMAINS].sort(() => 0.5 - Math.random());
    const proxiesToTry = [..._proxyList].sort(() => 0.5 - Math.random());
    proxiesToTry.push(null);

    for (let proxy of proxiesToTry) {
        const client = getClient(proxy);
        for (let domain of allDomains) {
            try {
                const homeUrl = `${protocol}://${domain}/`;
                setBypassCookies(domain);
                let headers = getHeaders(domain);
                
                await sleep(Math.random() * 700 + 300);
                const homeRes = await client.get(homeUrl, { headers });
                updateCookies(homeRes.headers['set-cookie']);

                const url = `${protocol}://${domain}${path}`;
                headers = getHeaders(domain);
                headers["Referer"] = homeUrl;

                await sleep(Math.random() * 1500 + 500);
                let response = await client.get(url, { headers });
                updateCookies(response.headers['set-cookie']);

                if (response.status === 200 && response.data.includes('REDIRECT_URL')) {
                    const match = response.data.match(/const REDIRECT_URL = '([^']+)'/);
                    if (match) {
                        let redirectUrl = match[1];
                        redirectUrl += "fp=-5";
                        await sleep(1000);
                        response = await client.get(redirectUrl, { headers });
                        updateCookies(response.headers['set-cookie']);
                    }
                }

                if (response.status >= 400) throw new Error(`HTTP ${response.status}`);

                const pageData = extractPageData(response.data);
                return { html: response.data, domain, pageData };
            } catch (e) {
                // Ignore and try next
            }
        }
    }
    return { html: null, domain: null, pageData: null };
}

function cacheResponse(ttlSeconds) {
    return (req, res, next) => {
        const key = req.originalUrl || req.url;
        const cachedResponse = cache.get(key);
        if (cachedResponse && (Date.now() - cachedResponse.timestamp) < ttlSeconds * 1000) {
            return res.json(cachedResponse.data);
        }
        
        const originalJson = res.json;
        res.json = (body) => {
            if (body && body.status === 'success') {
                cache.set(key, { timestamp: Date.now(), data: body });
            }
            originalJson.call(res, body);
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

app.get('/api/trending', cacheResponse(10), async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pathStr = page === 1 ? "/" : `/best/monthly/${page}`;
    
    const { html, domain, pageData } = await fetchWithFallback(pathStr);
    if (!html) return res.status(500).json({ status: "error", message: "No working domain found" });

    const videos = parseVideoList(pageData);
    res.json({ status: "success", page, results: videos, used_domain: domain });
});

app.get('/api/newest', cacheResponse(10), async (req, res) => {
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
    const { html, domain } = await fetchWithFallback('/categories');
    if (!html) return res.status(500).json({ status: "error", message: "No working domain found" });

    try {
        const $ = cheerio.load(html);
        const cats = [];
        const langs = [];
        const seen = new Set();
        
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const name = $(el).text().trim() || $(el).attr('title') || '';
            
            if (href.includes('/categories/') && !href.includes('/photos/') && name) {
                const slug = href.replace(/\/$/, '').split('/').pop();
                const imgTag = $(el).find('img');
                const image = imgTag.attr('src') || imgTag.attr('data-src') || '';
                
                const catData = { name, slug, url: href, image };
                
                if (!seen.has(href)) {
                    seen.add(href);
                    if (name.toLowerCase().startsWith('porn in ')) langs.push(catData);
                    else cats.push(catData);
                } else {
                    if (image) {
                        const existingCat = cats.find(c => c.url === href) || langs.find(c => c.url === href);
                        if (existingCat && !existingCat.image) existingCat.image = image;
                    }
                }
            }
        });

        const COUNTRY_SLUGS = new Set([
            'indian', 'desi', 'russian', 'american', 'british', 'japanese', 'korean', 'chinese', 'german', 'french',
            'italian', 'spanish', 'brazilian', 'mexican', 'colombian', 'canadian', 'australian', 'asian', 'latina'
        ]);

        const normal_cats = cats.filter(c => !COUNTRY_SLUGS.has(c.slug));
        const country_cats = cats.filter(c => COUNTRY_SLUGS.has(c.slug));

        res.json({ status: "success", categories: normal_cats, countries: country_cats, languages: langs, used_domain: domain });
    } catch (e) {
        res.status(500).json({ status: "error", message: e.message });
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
        const client = getClient();
        setBypassCookies(domain);
        
        const response = await client.get(videoUrl, { headers: getHeaders(domain) });
        updateCookies(response.headers['set-cookie']);
        const html = response.data;
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

        const m3u8Links = [...new Set(html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g) || [])];
        const allMp4Links = [...new Set(html.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/g) || [])];
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
            const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
            let rewritten = [];
            
            content.split('\n').forEach(line => {
                line = line.trim();
                if (!line) return;
                
                if (line.startsWith('#')) {
                    if (line.includes('URI="')) {
                        const match = line.match(/URI="([^"]+)"/);
                        if (match) {
                            let origUri = match[1];
                            if (!origUri.startsWith('http')) origUri = baseUrl + origUri;
                            const proxied = `/api/hls-proxy?url=${encodeURIComponent(origUri)}`;
                            const scheme = req.protocol;
                            const host = req.get('host');
                            line = line.replace(match[0], `URI="${scheme}://${host}${proxied}"`);
                        }
                    }
                    rewritten.push(line);
                } else {
                    let segmentUrl = line;
                    if (!segmentUrl.startsWith('http')) segmentUrl = baseUrl + segmentUrl;
                    
                    const scheme = req.protocol;
                    const host = req.get('host');
                    let proxied = "";
                    if (segmentUrl.includes('.m3u8')) {
                        proxied = `${scheme}://${host}/api/hls-proxy?url=${encodeURIComponent(segmentUrl)}`;
                    } else {
                        proxied = `${scheme}://${host}/api/proxy?url=${encodeURIComponent(segmentUrl)}`;
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
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
