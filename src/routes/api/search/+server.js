import { json } from '@sveltejs/kit';


const PROXY_SEARCH_BASE_URL = process.env.PROXY_SEARCH_BASE_URL || 'https://artadoproxy.vercel.app';

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

// Bang komutları için yönlendirme URL'leri
const BANG_COMMANDS = {
    '!g': 'https://www.google.com/search?q=',
    '!ddg': 'https://duckduckgo.com/?q=',
    '!yt': 'https://www.youtube.com/results?search_query=',
    '!w': 'https://tr.wikipedia.org/w/index.php?title=Özel:Ara&search=',
    '!e': 'https://www.ekşisözlük.com/search/?q=',
    '!gh': 'https://github.com/search?q=',
    '!a': 'https://artadosearch.com/search?i=', // Artado için bang komutu
    '!tw': 'https://twitter.com/search?q=',
    '!fb': 'https://www.facebook.com/search/top?q=',
    '!li': 'https://www.linkedin.com/search/results/all/?keywords=',
    '!in': 'https://www.instagram.com/explore/tags/',
    '!rd': 'https://www.reddit.com/search/?q=',
    '!so': 'https://stackoverflow.com/search?q=',
    '!wp': 'https://wordpress.org/search/',
    '!mdn': 'https://developer.mozilla.org/en-US/search?q=',
    '!w3': 'https://www.w3schools.com/search/default.asp?q=',
    '!cs': 'https://css-tricks.com/search/',
    '!py': 'https://docs.python.org/3/search.html?q=',
    '!node': 'https://nodejs.org/api/',
    '!react': 'https://react.dev/search?q=',
    '!vue': 'https://vuejs.org/guide/search.html?q=',
    '!svelte': 'https://svelte.dev/search?q=',
    '!npm': 'https://www.npmjs.com/search?q=',
    '!pypi': 'https://pypi.org/search/?q=',
    '!docker': 'https://hub.docker.com/search?q=',
    '!aws': 'https://aws.amazon.com/search?q=',
    '!azure': 'https://azure.microsoft.com/en-us/search/',
    '!gcp': 'https://cloud.google.com/search?q=',
    '!news': 'https://news.google.com/search?q=',
    '!maps': 'https://www.google.com/maps/search/',
    '!translate': 'https://translate.google.com/?sl=tr&tl=en&text=',
    '!dict': 'https://www.google.com/search?q=define+',
    '!weather': 'https://www.google.com/search?q=weather+',
    '!time': 'https://www.google.com/search?q=time+',
};

// Bang komutlarını işle
function processBangCommand(query) {
    const bangMatch = query.match(/^(![a-z]+)\s+(.+)$/i);
    if (!bangMatch) return null;

    const [, bangCommand, searchTerm] = bangMatch;
    const redirectUrl = BANG_COMMANDS[bangCommand.toLowerCase()];

    if (redirectUrl) {
        if (bangCommand.toLowerCase() === '!w') {
            return redirectUrl + encodeURIComponent(searchTerm);
        }
        return redirectUrl + encodeURIComponent(searchTerm);
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
    const engine = url.searchParams.get('engine') || 'Brave'; // Arama motoru parametresi
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

    if (searchType === 'web' && engine === 'Hybrid Proxy') {
        try {
            // Use same pattern as images: let proxy handle offset, just request count results
            const limitTotal = Math.max(1, Math.min(200, count));
            const proxyLimitPerEngine = Math.max(1, Math.min(20, Number(proxyLimitPerEngineRaw ?? Math.ceil(limitTotal / 4))));
            const timeoutMs = Math.max(3000, Math.min(30000, Number(proxyTimeoutMsRaw ?? 20000)));
            const cacheEnabled = proxyCacheRaw == null ? true : !(String(proxyCacheRaw) === '0' || String(proxyCacheRaw).toLowerCase() === 'false');

            // Build proxy request query
            const params = new URLSearchParams();
            params.set('q', query);
            params.set('limitTotal', String(limitTotal));
            params.set('limitPerEngine', String(proxyLimitPerEngine));
            params.set('cache', cacheEnabled ? '1' : '0');
            if (safe) params.set('safe', safe);
            if (region && region !== 'all') params.set('region', region);
            if (proxyEngines) params.set('engines', proxyEngines);
            params.set('p', String(offsetParam + 1)); // Pass 1-based page to proxy for consistency
            params.set('offset', String(internalOffset)); // Also pass raw offset for engines that need it

            const proxyUrl = `${proxyBaseUrl}/search?${params.toString()}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                let details = `Proxy request failed with status ${response.status}`;
                try { details = await response.text(); } catch (e) { }
                return json({ ok: false, error: `Proxy search hatası: ${response.status}`, details }, { status: response.status });
            }

            const data = await response.json();
            const searchResults = (Array.isArray(data.results) ? data.results : []).map((item) => {
                return {
                    title: item.title || 'Başlık Yok',
                    url: item.url || '#',
                    description: item.snippet || '',
                    icon: `https://icons.duckduckgo.com/ip3/${getDomain(item.url)}.ico`,
                    sources: Array.isArray(item.sources) && item.sources.length ? item.sources : (item.engine ? [item.engine] : []),
                    age: ''
                };
            });

            // Check Wikipedia for infobox (Same logic as Brave handler)
            let wikipediaInfo = null;
            try {
                const wikipediaApiUrl = `https://tr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
                const wikiResponse = await fetch(wikipediaApiUrl);

                if (wikiResponse.ok) {
                    const wikiData = await wikiResponse.json();
                    if (wikiData.extract) {
                        wikipediaInfo = {
                            title: wikiData.title || query,
                            extract: wikiData.extract,
                            thumbnail: wikiData.thumbnail?.source,
                            url: wikiData.content_urls?.desktop?.page || `https://tr.wikipedia.org/wiki/${encodeURIComponent(query)}`
                        };
                    }
                }
            } catch (wikiErr) { /* Ignore */ }

            return json({
                ok: true,
                type: searchType,
                searchResults,
                infoBoxResult: { wikipediaInfo }
            });
        } catch (err) {
            console.error('[API] Error fetching proxy search results:', err);
            return json({ ok: false, error: 'Proxy sunucu hatası', details: err.message }, { status: 500 });
        }
    }

    // === USE PROXY FOR IMAGES, VIDEOS, NEWS ===
    // For these search types, use Artado proxy service instead of Brave API
    if (['images', 'videos', 'news'].includes(searchType)) {
        try {
            // Pagination logic: Fetch enough results to cover the offset
            const neededLimit = internalOffset + count;
            // Cap at reasonable limit (e.g. 100) to prevent abuse/timeouts
            const limitTotal = Math.min(100, neededLimit);

            const proxyParams = new URLSearchParams();
            proxyParams.set('q', query);
            proxyParams.set('limitTotal', String(count));
            proxyParams.set('p', String(offsetParam + 1));
            proxyParams.set('offset', String(internalOffset));
            proxyParams.set('cache', '1');

            // Pass region and safe search to proxy for better relevance
            if (region && region !== 'all') proxyParams.set('region', region);
            if (safe) proxyParams.set('safe', safe);

            const timeoutMs = Math.max(3000, Math.min(30000, 15000)); // Increased slightly
            const proxyEndpoint = searchType;
            const proxyUrl = `${proxyBaseUrl}/search/${proxyEndpoint}?${proxyParams.toString()}`;

            console.log(`[API] Fetching ${searchType} results from proxy: ${proxyUrl} (Offset: ${offsetParam}, Limit: ${count})`);
            console.log(`[API] Proxy Request Details: URL=${proxyUrl}`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            const proxyResponse = await fetch(proxyUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!proxyResponse.ok) {
                let errorDetails = `Proxy request failed with status ${proxyResponse.status}`;
                try { errorDetails = await proxyResponse.text(); } catch (e) { }
                console.error(`[API] Proxy Error for ${searchType}:`, errorDetails);
                return json({
                    ok: false,
                    error: `Proxy arama hatası: ${proxyResponse.status}`,
                    details: errorDetails
                }, { status: proxyResponse.status });
            }

            const proxyData = await proxyResponse.json();
            const slicedResults = proxyData.results || [];
            console.log(`[API] Proxy returned ${slicedResults.length} ${searchType} results`);

            let searchResults = [];

            // Map proxy results to frontend-expected format
            if (searchType === 'images') {
                searchResults = slicedResults.map(item => ({
                    title: item.title || 'Görsel',
                    thumbnail: item.thumbnail || item.url,
                    url: item.url,
                    source: item.source || getDomain(item.url),
                    width: item.width,
                    height: item.height
                }));
            } else if (searchType === 'videos') {
                searchResults = slicedResults.map(item => ({
                    title: item.title || 'Video',
                    description: item.snippet || '',
                    url: item.url,
                    thumbnail: item.thumbnail,
                    duration: item.duration || '',
                    publisher: item.channel || '',
                    age: item.uploadDate || '',
                    views: item.views || ''
                }));
            } else if (searchType === 'news') {
                searchResults = slicedResults.map(item => ({
                    title: item.title || 'Haber',
                    url: item.url,
                    source: item.source || getDomain(item.url),
                    age: item.publishDate || '',
                    thumbnail: item.imageUrl,
                    description: item.snippet || ''
                }));

                // Apply news source filter if provided
                if (newsSource) {
                    const sourceLc = newsSource.toLowerCase();
                    searchResults = searchResults.filter(r =>
                        (r.source && String(r.source).toLowerCase().includes(sourceLc)) ||
                        (r.url && getDomain(r.url).toLowerCase().includes(sourceLc))
                    );
                }
            }

            return json({
                ok: true,
                type: searchType,
                searchResults,
                infoBoxResult: null
            });

        } catch (err) {
            console.error(`[API] Error fetching ${searchType} from proxy:`, err);

            // If it's an abort error (timeout), provide specific message
            if (err.name === 'AbortError') {
                return json({
                    ok: false,
                    error: 'Proxy arama zaman aşımına uğradı',
                    details: 'Lütfen tekrar deneyin'
                }, { status: 504 });
            }

            return json({
                ok: false,
                error: 'Proxy sunucu hatası',
                details: err.message
            }, { status: 500 });
        }
    }

    // === USE PROXY FOR ALL SEARCH TYPES ===
    // All search types use Artado proxy service
    try {
        // Pagination logic: Fetch enough results to cover the offset
        const neededLimit = internalOffset + count;
        // Cap at reasonable limit (e.g. 200) to prevent abuse/timeouts
        const limitTotal = Math.min(200, neededLimit);

        const proxyParams = new URLSearchParams();
        proxyParams.set('q', query);
        proxyParams.set('limitTotal', String(count));
        proxyParams.set('p', String(offsetParam + 1));
        proxyParams.set('offset', String(internalOffset));
        proxyParams.set('cache', '1');

        // Pass region and safe search to proxy for better relevance
        if (region && region !== 'all') proxyParams.set('region', region);
        if (safe) proxyParams.set('safe', safe);

        // Add engines if specified
        if (proxyEngines) proxyParams.set('engines', proxyEngines);

        const timeoutMs = Math.max(3000, Math.min(30000, Number(proxyTimeoutMsRaw ?? 20000)));
        const proxyEndpoint = searchType;
        const proxyUrl = `${proxyBaseUrl}/search/${proxyEndpoint}?${proxyParams.toString()}`;

        console.log(`[API] Fetching ${searchType} results from proxy: ${proxyUrl} (Offset: ${offsetParam}, Limit: ${count})`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const proxyResponse = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!proxyResponse.ok) {
            let errorDetails = `Proxy request failed with status ${proxyResponse.status}`;
            try { errorDetails = await proxyResponse.text(); } catch (e) { }
            console.error(`[API] Proxy Error for ${searchType}:`, errorDetails);
            return json({
                ok: false,
                error: `Proxy arama hatası: ${proxyResponse.status}`,
                details: errorDetails
            }, { status: proxyResponse.status });
        }

        const proxyData = await proxyResponse.json();
        const slicedResults = proxyData.results || [];
        console.log(`[API] Proxy returned ${slicedResults.length} ${searchType} results`);

        let searchResults = [];

    // Map proxy results to frontend-expected format
        if (searchType === 'images') {
            searchResults = slicedResults.map(item => ({
            title: item.title || 'Görsel',
            thumbnail: item.thumbnail || item.url,
            url: item.url,
            source: item.source || getDomain(item.url),
            width: item.width,
            height: item.height
        }));
        } else if (searchType === 'videos') {
            searchResults = slicedResults.map(item => ({
            title: item.title || 'Video',
            description: item.snippet || '',
            url: item.url,
            thumbnail: item.thumbnail,
            duration: item.duration || '',
            publisher: item.channel || '',
            age: item.uploadDate || '',
            views: item.views || ''
        }));
        } else if (searchType === 'news') {
            searchResults = slicedResults.map(item => ({
            title: item.title || 'Haber',
            url: item.url,
            source: item.source || getDomain(item.url),
            age: item.publishDate || '',
            thumbnail: item.imageUrl,
            description: item.snippet || ''
        }));

            // Apply news source filter if provided
            if (newsSource) {
                const sourceLc = newsSource.toLowerCase();
                searchResults = searchResults.filter(r =>
                    (r.source && String(r.source).toLowerCase().includes(sourceLc)) ||
                    (r.url && getDomain(r.url).toLowerCase().includes(sourceLc))
                );
            }
        } else { // web search
            searchResults = slicedResults.map(item => ({
            title: item.title || 'Başlık Yok',
            url: item.url || '#',
            description: item.snippet || '',
            icon: `https://icons.duckduckgo.com/ip3/${getDomain(item.url)}.ico`,
            sources: Array.isArray(item.sources) && item.sources.length ? item.sources : (item.engine ? [item.engine] : []),
            age: ''
        }));
        }

        // Check Wikipedia for infobox (web search only)
        let wikipediaInfo = null;
        if (searchType === 'web') {
            try {
                const wikipediaApiUrl = `https://tr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
                const wikiResponse = await fetch(wikipediaApiUrl);

                if (wikiResponse.ok) {
                    const wikiData = await wikiResponse.json();
                    if (wikiData.extract) {
                        wikipediaInfo = {
                            title: wikiData.title || query,
                            extract: wikiData.extract,
                            thumbnail: wikiData.thumbnail?.source,
                            url: wikiData.content_urls?.desktop?.page || `https://tr.wikipedia.org/wiki/${encodeURIComponent(query)}`
                        };
                    }
                }
            } catch (wikiErr) { /* Ignore */ }
        }

        return json({
            ok: true,
            type: searchType,
            searchResults,
            infoBoxResult: wikipediaInfo ? { wikipediaInfo } : null
        });

    } catch (err) {
        console.error(`[API] Error fetching ${searchType} from proxy:`, err);

        // If it's an abort error (timeout), provide specific message
        if (err.name === 'AbortError') {
            return json({
                ok: false,
                error: 'Proxy arama zaman aşımına uğradı',
                details: 'Lütfen tekrar deneyin'
            }, { status: 504 });
        }

        return json({
            ok: false,
            error: 'Proxy sunucu hatası',
            details: err.message
        }, { status: 500 });
    }
}
