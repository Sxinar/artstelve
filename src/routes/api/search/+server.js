import { json } from '@sveltejs/kit';
import { BANG_COMMANDS } from '$lib/bangs.js';

const PROXY_SEARCH_BASE_URL = process.env.PROXY_SEARCH_BASE_URL || 'https://artados.vercel.app';

// Bang komutlarını işle
function processBangCommand(query) {
    const bangMatch = query.match(/^(![a-z]+)\s+(.+)$/i);
    if (!bangMatch) return null;

    const [, bangCommand, searchTerm] = bangMatch;
    const bangEntry = BANG_COMMANDS[bangCommand.toLowerCase()];

    if (bangEntry) {
        return bangEntry.url + encodeURIComponent(searchTerm);
    }
    return null;
}

// Get domain from URL
function getDomain(url) {
    if (!url) return '';
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        return '';
    }
}

function mapEngineToProxyEngines(engine) {
    if (!engine) return undefined;
    const normalized = String(engine).trim().toLowerCase();
    if (normalized === 'brave') return 'brave';
    if (normalized === 'duckduckgo' || normalized === 'duck') return 'duckduckgo';
    if (normalized === 'startpage') return 'startpage';
    if (normalized === 'qwant') return 'qwant';
    if (normalized === 'ecosia') return 'ecosia';
    if (normalized === 'mojeek') return 'mojeek';
    if (normalized === 'yahoo') return 'yahoo';
    if (normalized === 'ask') return 'ask';
    if (normalized === 'aol') return 'aol';
    if (normalized === 'yandex') return 'yandex';
    return undefined;
}

// DuckDuckGo Instant Answer API integration
async function fetchDuckDuckGoResults(query, searchType) {
    try {
        // DuckDuckGo Instant Answer API
        const ddgApiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

        const response = await fetch(ddgApiUrl);

        if (!response.ok) {
            console.error(`[API] DuckDuckGo API Error: ${response.status}`);
            return null;
        }

        const data = await response.json();

        // Process DuckDuckGo results
        const results = [];

        // Add abstract if available
        if (data.Abstract) {
            results.push({
                title: data.Heading || query,
                url: data.AbstractURL || '#',
                description: data.Abstract,
                icon: data.Image ? `https://duckduckgo.com${data.Image}` : `https://icons.duckduckgo.com/ip3/${getDomain(data.AbstractURL)}.ico`,
                age: ''
            });
        }

        // Add related topics
        if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
            data.RelatedTopics.forEach(topic => {
                if (topic.FirstURL && topic.Text) {
                    results.push({
                        title: topic.Text.split(' - ')[0] || topic.Text,
                        url: topic.FirstURL,
                        description: topic.Text.split(' - ')[1] || topic.Text,
                        icon: `https://icons.duckduckgo.com/ip3/${getDomain(topic.FirstURL)}.ico`,
                        age: ''
                    });
                }
            });
        }

        return results.slice(0, 20); // Limit to 20 results

    } catch (err) {
        console.error('[API] Error fetching DuckDuckGo search results:', err);
        return null;
    }
}

export async function GET({ url, setHeaders }) {
    console.log("[API LIFECYCLE] GET /api/search endpoint hit!");

    // Cache search results for 5 minutes (browser) and 10 minutes (CDN/Edge)
    setHeaders({
        'Cache-Control': 'public, max-age=300, s-maxage=600'
    });

    const query = url.searchParams.get('i') || url.searchParams.get('q');
    const searchType = url.searchParams.get('t') || 'web'; // Renamed variable from 'type'
    const requestedEngine = url.searchParams.get('engine') || 'Hybrid Proxy'; // Arama motoru parametresi
    const engine = String(requestedEngine).trim().toLowerCase() === 'artado search'
        ? 'Artado'
        : requestedEngine;
    let proxyBaseUrl = url.searchParams.get('proxyBaseUrl') || PROXY_SEARCH_BASE_URL;

    // Force IPv4 for local proxy to avoid IPv6 resolution issues
    if (proxyBaseUrl.includes('localhost')) {
        proxyBaseUrl = proxyBaseUrl.replace('localhost', '127.0.0.1');
    }
    // Remove trailing slash if present
    if (proxyBaseUrl.endsWith('/')) {
        proxyBaseUrl = proxyBaseUrl.slice(0, -1);
    }
    const proxyEngines = url.searchParams.get('proxyEngines');
    const proxyLimitPerEngineRaw = url.searchParams.get('proxyLimitPerEngine');
    const proxyLimitTotalRaw = url.searchParams.get('proxyLimitTotal');
    const proxyTimeoutMsRaw = url.searchParams.get('proxyTimeoutMs');
    const proxyCacheRaw = url.searchParams.get('proxyCache');
    const region = url.searchParams.get('region') || 'all'; // 'all', 'TR', 'US', etc.
    const safe = url.searchParams.get('safe') || 'on'; // 'on' | 'off'
    const size = url.searchParams.get('size') || ''; // images: small|medium|large
    const color = url.searchParams.get('color') || ''; // images: color filter
    const aspect = url.searchParams.get('aspect') || ''; // images: aspect ratio
    const imgType = url.searchParams.get('type') || ''; // images: photo|vector|clipart
    const palette = url.searchParams.get('palette') || ''; // images: color palette keyword

    // News filters
    const newsSource = url.searchParams.get('source') || ''; // domain or publisher
    const startDate = url.searchParams.get('startDate') || '';
    const endDate = url.searchParams.get('endDate') || '';

    // Pagination
    // Interpret p (1-based page) or offset (0-based page index)
    const pParam = url.searchParams.get('p');
    const offsetParamRaw = url.searchParams.get('offset') || '0';
    let offsetParam;

    if (pParam) {
        const p = parseInt(pParam, 10) || 1;
        offsetParam = Math.max(0, p - 1);
    } else {
        offsetParam = parseInt(offsetParamRaw, 10) || 0;
    }

    const count = Math.min(parseInt(url.searchParams.get('count') || '20', 10), 50);
    const internalOffset = offsetParam * count;

    if (!query) {
        return json({ error: 'Arama sorgusu gerekli' }, { status: 400 });
    }

    // Bang komutlarını kontrol et
    const bangRedirectUrl = processBangCommand(query);
    if (bangRedirectUrl) {
        return json({ redirect: bangRedirectUrl });
    }

    // === ARTADO SEARCH SCRAPER ===
    if (engine === 'Artado') {
        try {
            // Type mapping: internal type → Artado type param
            const typeMap = { web: 'web', images: 'image', videos: 'video', news: 'news' };
            const artadoType = typeMap[searchType] || 'web';
            // Artado pagination: p=0 (page1), p=10 (page2), p=20 (page3)...
            const artadoPage = offsetParam * 10;

            // Build URL with raw (non-percent-encoded) chars so Artado's index matches correctly
            const artadoUrl = `https://artadosearch.com/search?i=${query}&type=${artadoType}${artadoPage > 0 ? `&p=${artadoPage}` : ''}`;
            const fetchHeaders = {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
                'Content-Type': 'application/x-www-form-urlencoded'
            };

            // Step 1: GET the page to extract ASP.NET VIEWSTATE fields
            console.log(`[Artado] Step 1 GET: ${artadoUrl}`);
            const controller1 = new AbortController();
            const timeout1 = setTimeout(() => controller1.abort(), 15000);
            const getResponse = await fetch(artadoUrl, { signal: controller1.signal, headers: fetchHeaders });
            clearTimeout(timeout1);

            if (!getResponse.ok) {
                return json({ ok: false, error: `Artado arama hatası: ${getResponse.status}` }, { status: getResponse.status });
            }

            const getHtml = await getResponse.text();

            // Extract ASP.NET hidden fields
            const viewstate = (getHtml.match(/id="__VIEWSTATE"\s+value="([^"]*)"/) || [])[1] || '';
            const viewstateGen = (getHtml.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]*)"/) || [])[1] || '';
            const eventValidation = (getHtml.match(/id="__EVENTVALIDATION"\s+value="([^"]*)"/) || [])[1] || '';

            // Step 2: POST the form to trigger the actual search
            const formData = new URLSearchParams();
            formData.set('__EVENTTARGET', '');
            formData.set('__EVENTARGUMENT', '');
            formData.set('__VIEWSTATE', viewstate);
            formData.set('__VIEWSTATEGENERATOR', viewstateGen);
            formData.set('__EVENTVALIDATION', eventValidation);
            // Use encodeURIComponent only for VIEWSTATE fields, raw chars for query
            formData.set('searchinput', query);
            formData.set('All', 'All');

            // Rebuild form body manually to keep Turkish chars raw in searchinput
            const rawBody = `__EVENTTARGET=&__EVENTARGUMENT=`
                + `&__VIEWSTATE=${encodeURIComponent(viewstate)}`
                + `&__VIEWSTATEGENERATOR=${encodeURIComponent(viewstateGen)}`
                + `&__EVENTVALIDATION=${encodeURIComponent(eventValidation)}`
                + `&searchinput=${query}`
                + `&All=All`;

            console.log(`[Artado] Step 2 POST: ${artadoUrl}`);
            const controller2 = new AbortController();
            const timeout2 = setTimeout(() => controller2.abort(), 15000);
            const postResponse = await fetch(artadoUrl, {
                method: 'POST',
                signal: controller2.signal,
                headers: fetchHeaders,
                body: rawBody
            });
            clearTimeout(timeout2);

            if (!postResponse.ok) {
                return json({ ok: false, error: `Artado POST hatası: ${postResponse.status}` }, { status: postResponse.status });
            }

            const html = await postResponse.text();
            console.log(`[Artado] POST HTML length: ${html.length}`);
            // Debug: print the artado results div content
            const artadoDiv = html.match(/<div[^>]+id="artado"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]+id="web_results"/i);
            const webDiv = html.match(/<div[^>]+id="web_results"[^>]*>([\s\S]{0,500})/i);
            console.log(`[Artado] #artado div found: ${!!artadoDiv}, #web_results div found: ${!!webDiv}`);
            if (artadoDiv) console.log(`[Artado] #artado content (first 300): ${artadoDiv[1].slice(0,300)}`);
            if (webDiv) console.log(`[Artado] #web_results content (first 300): ${webDiv[1].slice(0,300)}`);

            // Decode HTML entities
            function decodeHtml(str) {
                return str
                    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&nbsp;/g, ' ')
                    .trim();
            }

            // Parse result blocks: try both href with single and double quotes
            const artadoBlocks = [
                ...html.matchAll(/<a[^>]+id="artado_r"[^>]+href='([^']+)'[^>]*>([\s\S]*?)<\/a>/gi),
                ...html.matchAll(/<a[^>]+id="artado_r"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)
            ];

            // Also parse #web_results section (results from Google/Bing/etc after POST)
            const webBlocks = [
                ...html.matchAll(/<a[^>]+href='(https?:\/\/[^']+)'[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/a>/gi),
                ...html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)
            ];

            // Yeni Artado HTML'inde sonuç linklerinde id/class bulunmayabiliyor.
            // Eski seçiciler sonuç bulamazsa, harici HTTPS linklerini kontrollü olarak tara.
            if (artadoBlocks.length === 0 && webBlocks.length === 0) {
                webBlocks.push(...[...html.matchAll(
                    /<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
                )].filter((block) => {
                    const target = block[1].toLowerCase();
                    return !target.includes('artadosearch.com') &&
                        !target.includes('cdnjs.cloudflare.com') &&
                        !target.includes('googleapis.com') &&
                        !target.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico)(\?|$)/);
                }));
            }

            // Combine, deduplicate by URL
            const allBlocks = [...artadoBlocks, ...webBlocks];
            const seenUrls = new Set();
            const uniqueBlocks = allBlocks.filter(b => {
                if (seenUrls.has(b[1])) return false;
                seenUrls.add(b[1]);
                return true;
            });

            console.log(`[Artado] artado blocks: ${artadoBlocks.length}, web blocks: ${webBlocks.length}, unique: ${uniqueBlocks.length}`);

            // If no results from HTML scraping, fallback to Google CSE API
            if (uniqueBlocks.length === 0) {
                const googleApiKey = process.env.GOOGLE_CSE_API_KEY || '';
                const ARTADO_CX = '160e826a9c5ebe821';
                if (googleApiKey) {
                    try {
                        const cseParams = new URLSearchParams({
                            key: googleApiKey,
                            cx: ARTADO_CX,
                            q: query,
                            num: String(Math.min(count, 10)),
                            hl: 'tr',
                            start: String(internalOffset + 1)
                        });
                        const cseUrl = `https://www.googleapis.com/customsearch/v1?${cseParams.toString()}`;
                        console.log(`[Artado] Falling back to Google CSE: ${cseUrl}`);
                        const cseRes = await fetch(cseUrl);
                        if (cseRes.ok) {
                            const cseData = await cseRes.json();
                            const cseItems = cseData.items || [];
                            let cseMapped = [];
                            if (searchType === 'images') {
                                cseMapped = cseItems.map(item => ({
                                    title: item.title || '',
                                    thumbnail: item.pagemap?.cse_image?.[0]?.src || item.link,
                                    url: item.link,
                                    source: getDomain(item.link)
                                }));
                            } else {
                                cseMapped = cseItems.map(item => ({
                                    title: item.title || 'Başlık Yok',
                                    url: item.link || '#',
                                    description: item.snippet || '',
                                    icon: `https://icons.duckduckgo.com/ip3/${getDomain(item.link)}.ico`,
                                    age: ''
                                }));
                            }
                            let wikipediaInfo2 = null;
                            if (searchType === 'web') {
                                try {
                                    const wikiRes2 = await fetch(`https://tr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
                                    if (wikiRes2.ok) {
                                        const wikiData2 = await wikiRes2.json();
                                        if (wikiData2.extract) {
                                            wikipediaInfo2 = {
                                                title: wikiData2.title || query,
                                                extract: wikiData2.extract,
                                                thumbnail: wikiData2.thumbnail?.source,
                                                url: wikiData2.content_urls?.desktop?.page || `https://tr.wikipedia.org/wiki/${encodeURIComponent(query)}`
                                            };
                                        }
                                    }
                                } catch (e) { /* ignore */ }
                            }
                            return json({ ok: true, type: searchType, searchResults: cseMapped, infoBoxResult: wikipediaInfo2 ? { wikipediaInfo: wikipediaInfo2 } : null });
                        }
                    } catch (cseErr) {
                        console.error('[Artado] Google CSE fallback failed:', cseErr.message);
                    }
                } else {
                    console.warn('[Artado] No GOOGLE_CSE_API_KEY set — cannot fall back to Google CSE.');
                }
            }

            let searchResults = uniqueBlocks.map(block => {
                const url = block[1];
                const inner = block[2];

                const titleMatch = inner.match(/class="result-title[^"]*"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)
                    || inner.match(/<(?:h[1-6]|strong|b)[^>]*>([\s\S]*?)<\/(?:h[1-6]|strong|b)>/i);
                const descMatch = inner.match(/class="result-desc[^"]*"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)
                    || inner.match(/class="[^"]*desc[^"]*"[^>]*>([\s\S]*?)<\/(?:div|p|span)>/i);

                const rawTitle = titleMatch ? titleMatch[1] : url;
                const title = decodeHtml(rawTitle.replace(/<[^>]+>/g, ''));
                const description = descMatch ? decodeHtml(descMatch[1].replace(/<[^>]+>/g, '')) : '';

                return { url, title, description };
            }).filter(r => r.url && !r.url.includes('artadosearch.com'));

            // Map to expected format
            let mappedResults = [];
            if (searchType === 'images') {
                mappedResults = searchResults.map(item => ({
                    title: item.title,
                    thumbnail: item.url,
                    url: item.url,
                    source: getDomain(item.url)
                }));
            } else if (searchType === 'videos') {
                mappedResults = searchResults.map(item => ({
                    title: item.title,
                    description: item.description,
                    url: item.url,
                    thumbnail: '',
                    duration: '',
                    publisher: getDomain(item.url),
                    age: ''
                }));
            } else if (searchType === 'news') {
                mappedResults = searchResults.map(item => ({
                    title: item.title,
                    url: item.url,
                    source: getDomain(item.url),
                    age: '',
                    thumbnail: '',
                    description: item.description
                }));
            } else {
                mappedResults = searchResults.map(item => ({
                    title: item.title || 'Başlık Yok',
                    url: item.url || '#',
                    description: item.description,
                    icon: `https://icons.duckduckgo.com/ip3/${getDomain(item.url)}.ico`,
                    age: ''
                }));
            }

            return json({
                ok: true,
                type: searchType,
                searchResults: mappedResults,
                infoBoxResult: null
            });

        } catch (err) {
            if (err.name === 'AbortError') {
                return json({ ok: false, error: 'Artado arama zaman aşımına uğradı' }, { status: 504 });
            }
            return json({ ok: false, error: 'Artado sunucu hatası', details: err.message }, { status: 500 });
        }
    }

    // === ARTSTELVE PROXY ===
    if (engine === 'Artado Proxy') {
        // If proxyBaseUrl is the old artadoproxy (different API format), fall back to artados
        const rawBase = (!proxyBaseUrl || proxyBaseUrl.includes('artados.vercel.app'))
            ? 'https://artados.vercel.app'
            : proxyBaseUrl;
        const SECURE_PROXY_BASE = rawBase.replace(/\/$/, '');
        const spNumber = Math.min(Number(proxyLimitTotalRaw ?? count ?? 20), 50);
        const spTimeoutMs = Math.max(3000, Math.min(30000, Number(proxyTimeoutMsRaw ?? 12000)));
        const cacheEnabled = proxyCacheRaw == null ? true : !(String(proxyCacheRaw) === '0' || String(proxyCacheRaw).toLowerCase() === 'false');

        // Map proxyEngines → source param (artados supports: google | bing | all)
        let spSource = 'all';
        if (proxyEngines) {
            const eng = proxyEngines.toLowerCase();
            const hasGoogle = eng.includes('google') || eng.includes('startpage');
            const hasBing = eng.includes('bing') || eng.includes('yahoo') || eng.includes('duckduckgo');
            if (hasGoogle && !hasBing) spSource = 'google';
            else if (hasBing && !hasGoogle) spSource = 'bing';
            else spSource = 'all';
        }

        // Keep Turkish chars raw but encode URL-breaking chars (/, &, ?, #, +, %)
        const spQuery = query.replace(/[&=?#+%/]/g, c => encodeURIComponent(c));

        try {
            let proxyUrl = '';
            if (searchType === 'images') {
                proxyUrl = `${SECURE_PROXY_BASE}/api/images?q=${spQuery}&number=${spNumber}`;
            } else if (searchType === 'news') {
                const newsLang = url.searchParams.get('lang') || 'tr';
                const newsRegion = (url.searchParams.get('region') || region || 'TR').toLowerCase();
                proxyUrl = `${SECURE_PROXY_BASE}/api/news?q=${spQuery}&number=${spNumber}&lang=${newsLang}&region=${newsRegion}`;
            } else if (searchType === 'videos') {
                proxyUrl = `${SECURE_PROXY_BASE}/api/videos?q=${spQuery}&number=${spNumber}`;
            } else {
                proxyUrl = `${SECURE_PROXY_BASE}/api?q=${spQuery}&number=${spNumber}&source=${spSource}${cacheEnabled ? '' : '&cache=0'}`;
            }

            console.log(`[ArtStelveProxy] Fetching: ${proxyUrl}`);

            const spController = new AbortController();
            const spTimeout = setTimeout(() => spController.abort(), spTimeoutMs);

            // Run proxy fetch and Wikipedia in parallel (wiki has its own 5s timeout)
            const wikiCtrl = new AbortController();
            const wikiTimeout = setTimeout(() => wikiCtrl.abort(), 5000);
            const wikiPromise = searchType === 'web'
                ? fetch(`https://tr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`, { signal: wikiCtrl.signal })
                    .catch(() => null)
                    .finally(() => clearTimeout(wikiTimeout))
                : Promise.resolve(null);

            // Çift güvenlik: AbortController + Promise.race timeout
            const proxyFetchWithTimeout = Promise.race([
                fetch(proxyUrl, { signal: spController.signal }),
                new Promise((_, reject) => setTimeout(
                    () => reject(new Error(`Proxy hard-timeout (${spTimeoutMs}ms)`)),
                    spTimeoutMs + 500
                ))
            ]);

            const t0 = Date.now();
            let proxyRes;
            try {
                proxyRes = await proxyFetchWithTimeout;
            } finally {
                clearTimeout(spTimeout);
            }
            console.log(`[ArtadoProxy] proxy fetch tamamlandı (${Date.now() - t0}ms) status=${proxyRes.status} ct=${proxyRes.headers.get('content-type')}`);

            if (!proxyRes.ok) {
                const errBody = await proxyRes.text().catch(() => '');
                console.error(`[ArtadoProxy] Error body (first 300): ${errBody.slice(0, 300)}`);
                return json({ ok: false, error: `Artado Proxy hatası: ${proxyRes.status}` }, { status: proxyRes.status });
            }

            const rawText = await proxyRes.text();
            console.log(`[ArtadoProxy] Raw response (first 300): ${rawText.slice(0, 300)}`);
            let proxyData;
            try { proxyData = JSON.parse(rawText); } catch (e) {
                return json({ ok: false, error: 'Artado Proxy geçersiz JSON döndürdü', details: rawText.slice(0, 200) }, { status: 502 });
            }
            let items = Array.isArray(proxyData) ? proxyData : (proxyData.results || []);
            // URL'ye göre duplicate'leri temizle (Svelte each-key crash önler)
            const seenUrls = new Set();
            items = items.filter(it => {
                const u = it?.url || it?.sourceUrl;
                if (!u || seenUrls.has(u)) return false;
                seenUrls.add(u);
                return true;
            });

            let searchResults = [];
            if (searchType === 'images') {
                searchResults = items.map(item => ({
                    title: item.title || '',
                    thumbnail: item.thumbnailUrl || item.url,
                    url: item.sourceUrl || item.url,
                    source: item.source || getDomain(item.url || '')
                }));
            } else if (searchType === 'videos') {
                searchResults = items.map(item => ({
                    title: item.title || '',
                    url: item.url || '#',
                    thumbnail: item.thumbnailUrl || '',
                    duration: item.duration || '',
                    publisher: item.publisher || getDomain(item.url || ''),
                    description: '',
                    age: ''
                }));
            } else if (searchType === 'news') {
                searchResults = items.map(item => ({
                    title: item.title || '',
                    url: item.url || '#',
                    source: item.newsSource || getDomain(item.url || ''),
                    age: item.publishedAt || '',
                    thumbnail: item.thumbnailUrl || '',
                    description: item.description || ''
                }));
            } else {
                searchResults = items.map(item => ({
                    title: item.title || 'Başlık Yok',
                    url: item.url || '#',
                    description: item.description || '',
                    icon: `https://icons.duckduckgo.com/ip3/${getDomain(item.url || '')}.ico`,
                    age: ''
                }));
            }

            let wikipediaInfo = null;
            // Wikipedia bekleme — kalan süreden fazla bekleme (max 2s buradan sonra)
            try {
                const wikiRes = await Promise.race([
                    wikiPromise,
                    new Promise(resolve => setTimeout(() => resolve(null), 2000))
                ]);
                if (wikiRes?.ok) {
                    const wikiData = await Promise.race([
                        wikiRes.json(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('wiki-json-timeout')), 1500))
                    ]);
                    if (wikiData?.extract) {
                        wikipediaInfo = {
                            title: wikiData.title || query,
                            extract: wikiData.extract,
                            thumbnail: wikiData.thumbnail?.source,
                            url: wikiData.content_urls?.desktop?.page || `https://tr.wikipedia.org/wiki/${encodeURIComponent(query)}`
                        };
                    }
                }
            } catch (e) { /* wiki failed silently */ }

            console.log(`[ArtadoProxy] returning ${searchResults.length} results (total ${Date.now() - t0}ms)`);
            return json({ ok: true, type: searchType, searchResults, infoBoxResult: { wikipediaInfo } });

        } catch (err) {
            if (err.name === 'AbortError') {
                return json({ ok: false, error: 'Artado Proxy zaman aşımına uğradı (12s)' }, { status: 504 });
            }
            return json({ ok: false, error: 'Artado Proxy hatası', details: err.message }, { status: 500 });
        }
    }


    return json({ ok: false, error: `Desteklenmeyen arama motoru: ${engine}` }, { status: 400 });
}
