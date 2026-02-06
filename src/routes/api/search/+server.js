import { json } from '@sveltejs/kit';

// WARNING: Storing API keys directly in code is insecure, even on the backend.
// Use environment variables for production.
const BRAVE_API_KEY = 'BSAuFJ0CRuCgoNsyYopbiFg6hItXpsL';
// GEMINI_API_KEY Removed

const PROXY_SEARCH_BASE_URL = process.env.PROXY_SEARCH_BASE_URL || 'https://artstelve-proxy.vercel.app';

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
    '!w': 'https://tr.wikipedia.org/wiki/',
    '!e': 'https://www.ekşisözlük.com/search/?q=',
    '!gh': 'https://github.com/search?q=',
    '!a': 'https://artado.xyz/search?i=' // Artado için bang komutu
};

// Google API için anahtar (entegrasyon tamamlandığında kullanılacak)
const GOOGLE_API_KEY = 'AIzaSyBK1ZR62nmEawWswvcBCsECYm0dyuExXew'; // Örnek anahtar, gerçek anahtarla değiştirilmeli
const GOOGLE_CX = '017576662512468239146:omuauf_lfve'; // Örnek CX, gerçek değerle değiştirilmeli
const BING_API_KEY = ''; // Bing Search API Key goes here

// Helper to get domain - simplified for backend
function getDomain(url) {
    if (!url) return '';
    try {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            if (url.includes('.')) {
                return url.replace(/^www\./, '');
            }
            return url;
        }
        return new URL(url).hostname.replace(/^www\./, '');
    } catch (e) {
        console.warn(`[API] Failed to parse domain from URL: ${url}`);
        return url;
    }
}

// Helper to format duration
function formatDuration(duration) {
    if (!duration || !duration.startsWith('PT')) return '';
    try {
        let time = duration.substring(2);
        let hours = '';
        let minutes = '0';
        let seconds = '0';
        if (time.includes('H')) [hours, time] = time.split('H');
        if (time.includes('M')) [minutes, time] = time.split('M');
        if (time.includes('S')) seconds = time.split('S')[0];
        seconds = seconds.padStart(2, '0');
        minutes = minutes.padStart(2, '0');
        return hours ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
    } catch (e) { return ''; }
}

// Helper to format age
function formatAge(ageString) {
    return ageString || '';
}

// Bang komutlarını işleme fonksiyonu
function processBangCommand(query) {
    // Bang komutunu ve arama terimini ayır
    const bangMatch = query.match(/^(![a-z]+)\s+(.+)$/i);
    if (!bangMatch) return null;

    const [, bangCommand, searchTerm] = bangMatch;
    const redirectUrl = BANG_COMMANDS[bangCommand.toLowerCase()];

    if (redirectUrl) {
        // Wikipedia için özel işleme (boşlukları _ ile değiştir)
        if (bangCommand.toLowerCase() === '!w') {
            return redirectUrl + searchTerm.replace(/\s+/g, '_');
        }
        return redirectUrl + encodeURIComponent(searchTerm);
    }

    return null;
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

    const query = url.searchParams.get('i');
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
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const count = Math.min(parseInt(url.searchParams.get('count') || '20', 10), 50);

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
            const configuredLimitTotal = Math.max(1, Math.min(100, Number(proxyLimitTotalRaw ?? 20)));
            const limitTotal = Math.max(1, Math.min(100, Math.max(configuredLimitTotal, offset + count)));
            const proxyLimitPerEngine = Math.max(1, Math.min(20, Number(proxyLimitPerEngineRaw ?? Math.ceil(limitTotal / 4))));
            const timeoutMs = Math.max(3000, Math.min(30000, Number(proxyTimeoutMsRaw ?? 20000)));
            const cacheEnabled = proxyCacheRaw == null ? true : !(String(proxyCacheRaw) === '0' || String(proxyCacheRaw).toLowerCase() === 'false');

            const params = new URLSearchParams();
            params.set('q', query);
            params.set('limitTotal', String(limitTotal));
            params.set('limitPerEngine', String(proxyLimitPerEngine));
            params.set('timeoutMs', String(timeoutMs));
            params.set('cache', cacheEnabled ? '1' : '0');
            if (region && region !== 'all') params.set('region', region); // Pass region to proxy if supported
            if (proxyEngines) params.set('engines', proxyEngines);

            const proxyUrl = `${proxyBaseUrl}/search?${params.toString()}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                let details = `Proxy request failed with status ${response.status}`;
                try { details = await response.text(); } catch (e) { }
                return json({ ok: false, error: `Proxy search hatası: ${response.status}`, details }, { status: response.status });
            }

            const data = await response.json();
            const all = Array.isArray(data.results) ? data.results : [];
            // Slice correctly using offset and count
            const searchResults = all.slice(offset, offset + count).map((item) => {
                return {
                    title: item.title || 'Başlık Yok',
                    url: item.url || '#',
                    description: item.snippet || '',
                    icon: `https://icons.duckduckgo.com/ip3/${getDomain(item.url)}.ico`,
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
    // For these search types, use artstelve-proxy service instead of Brave API
    if (['images', 'videos', 'news'].includes(searchType)) {
        try {
            // Pagination logic: Fetch enough results to cover the offset
            const neededLimit = offset + count;
            // Cap at reasonable limit (e.g. 100) to prevent abuse/timeouts
            const limitTotal = Math.min(100, neededLimit);

            const proxyParams = new URLSearchParams();
            proxyParams.set('q', query);
            proxyParams.set('limitTotal', String(limitTotal));
            proxyParams.set('cache', '1');

            // Pass region and safe search to proxy for better relevance
            if (region && region !== 'all') proxyParams.set('region', region);
            if (safe) proxyParams.set('safe', safe);

            const timeoutMs = Math.max(3000, Math.min(30000, 15000)); // Increased slightly
            const proxyEndpoint = searchType; // 'images', 'videos', or 'news'
            const proxyUrl = `${proxyBaseUrl}/search/${proxyEndpoint}?${proxyParams.toString()}`;

            console.log(`[API] Fetching ${searchType} results from proxy: ${proxyUrl} (Offset: ${offset}, Limit: ${limitTotal})`);
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
            const allResults = proxyData.results || [];
            console.log(`[API] Proxy returned ${allResults.length} ${searchType} results`);

            // Slice the results for pagination
            // If we requested 40 items (offset 20 + count 20), we take 20..40
            const slicedResults = allResults.slice(offset, offset + count);

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

    // === CONTINUE WITH BRAVE API FOR WEB SEARCH ===
    // Seçilen arama motoruna göre API URL'sini belirle
    let apiUrl;
    let useGoogleApi = false;

    if (engine === 'Google') {
        useGoogleApi = true;
        console.log(`[API] Using Google search engine for: ${query}`);
    } else if (engine === 'Bing') {
        // Bing logic will be handled in main block
        console.log(`[API] Using Bing search engine for: ${query}`);
    } else {
        const params = new URLSearchParams();
        params.set('q', query);
        if (!Number.isNaN(offset) && offset > 0) params.set('offset', String(offset));
        if (!Number.isNaN(count) && count > 0) params.set('count', String(count));
        if (safe === 'on') params.set('safesearch', 'strict');
        if (region && region !== 'all') params.set('country', region); // Map region to country for Brave

        // Request detailed snippets
        params.set('extra_snippets', 'true');

        // Image specific filters (Brave supports some via query params)
        if (searchType === 'images') {
            if (size) params.set('size', size);
            if (color) params.set('color', color);
            if (aspect) params.set('aspect', aspect);
            if (imgType) params.set('type', imgType);
            if (palette) params.set('palette', palette);
        }
        apiUrl = `https://api.search.brave.com/res/v1/${searchType}/search?${params.toString()}`;
        console.log(`[API] Fetching ${searchType} results for: ${query} from Brave (Region: ${region})`);
    }

    try {
        let response;
        let data;
        let searchResults = [];
        let infoBoxResult = null;
        let wikipediaInfo = null;

        if (useGoogleApi) {
            return json({ error: 'Google API integration incomplete' }, { status: 501 });

        } else if (engine === 'DuckDuckGo') {
            // DuckDuckGo API kullanarak sonuçları getir
            const ddgResults = await fetchDuckDuckGoResults(query, searchType);
            if (ddgResults === null) {
                return json({ error: 'DuckDuckGo API hatası' }, { status: 500 });
            }
            searchResults = ddgResults;
        } else if (engine === 'Bing') {
            if (!BING_API_KEY) {
                return json({ error: 'Bing API key not configured' }, { status: 501 });
            }
            return json({ error: 'Bing integration pending' }, { status: 501 });

        } else if (['Yahoo', 'Yandex', 'Qwant', 'StartPage'].includes(engine)) {
            return json({
                warning: `${engine} Search API desteği henüz eklenmedi.`,
                searchResults: [
                    {
                        title: `${engine} Arama API Henüz Hazır Değil`,
                        description: `Bu arama motoru (${engine}) için API entegrasyonu geliştirme aşamasındadır. Şimdilik Brave veya DuckDuckGo kullanmanızı öneririz.`,
                        url: '#',
                        source: 'System'
                    }
                ],
                type: searchType
            });
        } else {
            // Brave API kullanarak sonuçları getir
            response = await fetch(apiUrl, {
                headers: {
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip',
                    'X-Subscription-Token': BRAVE_API_KEY
                }
            });

            if (!response.ok) {
                let errorBody = `API request failed with status ${response.status}`;
                try { errorBody = await response.text(); } catch (e) { }
                console.error(`[API] Brave API Error: ${errorBody}`);
                return json({ error: `Brave API hatası: ${response.status}`, details: errorBody }, { status: response.status });
            }

            data = await response.json();

            // Wikipedia logic... (omitted to save tokens if unchanged, but I must replace contiguous block)
            // Wait, I am replacing a huge block to add `extra_snippets` param.

            // Re-inserting Wikipedia logic to match target block size?
            // Actually, I can just target the block where I set params.
            // Better to split this replacement.

            // I'll just Replace the params block.


            // Wikipedia özeti için arama yap (web aramaları için)
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
                } catch (wikiErr) {
                    // Ignore
                }
            }

            // --- Process results ---
            // Web Results
            if (searchType === 'web' && data.web && data.web.results) {
                searchResults = data.web.results.map(item => {
                    // Combine description and extra snippets for detailed view
                    let desc = item.description || '';
                    if (item.extra_snippets && Array.isArray(item.extra_snippets)) {
                        desc += ' ' + item.extra_snippets.join(' ');
                    }
                    return {
                        title: item.title || 'Başlık Yok',
                        url: item.url || '#',
                        description: item.description || 'Açıklama yok.',
                        icon: item.profile?.img || `https://icons.duckduckgo.com/ip3/${getDomain(item.url)}.ico`,
                        age: formatAge(item.page_age)
                    };
                });
            }
            // Image Results
            else if (searchType === 'images') {
                if (data.results) {
                    searchResults = data.results.map(item => ({
                        title: item.title || 'Görsel',
                        thumbnail: item.thumbnail?.src || item.url,
                        url: item.properties?.url || item.url,
                        source: item.source || getDomain(item.url)
                    }));
                } else if (data.images && data.images.results) {
                    searchResults = data.images.results.map(item => ({
                        title: item.title || 'Görsel',
                        thumbnail: item.thumbnail?.src || item.url,
                        url: item.properties?.url || item.url,
                        source: item.source || getDomain(item.url)
                    }));
                }
            }
            // Video Results
            else if (searchType === 'videos') {
                const vidResults = data.results || (data.videos ? data.videos.results : []);
                if (vidResults) {
                    searchResults = vidResults.map(item => ({
                        title: item.title || 'Video',
                        description: item.description,
                        url: item.url,
                        thumbnail: item.thumbnail?.src,
                        duration: formatDuration(item.duration),
                        publisher: item.publisher?.name,
                        age: formatAge(item.page_age)
                    }));
                }
            }
            // News Results
            else if (searchType === 'news') {
                const newsResults = data.results || (data.news ? data.news.results : []);
                if (newsResults) {
                    searchResults = newsResults.map(item => ({
                        title: item.title || 'Haber',
                        url: item.url,
                        source: item.publisher?.name || getDomain(item.url),
                        age: formatAge(item.date || item.age),
                        thumbnail: item.thumbnail?.src,
                        description: item.description
                    }));
                }
                if (newsSource) {
                    const sourceLc = newsSource.toLowerCase();
                    searchResults = searchResults.filter(r =>
                        (r.source && String(r.source).toLowerCase().includes(sourceLc)) ||
                        (r.url && getDomain(r.url).toLowerCase().includes(sourceLc))
                    );
                }
            }

            // --- Check for Infobox ---
            if (data.infobox && data.infobox.results && data.infobox.results.length > 0) {
                const infoData = data.infobox.results[0];
                if (!infoData.type) infoData.type = 'generic_infobox';
                infoBoxResult = infoData;
            } else if (data.locations && data.locations.results && data.locations.results.length > 0) {
                infoBoxResult = { type: 'location', data: data.locations.results[0] };
            } else if (data.calculator && data.calculator.result) {
                infoBoxResult = { type: 'calculator', query: data.query?.original || query, result: data.calculator.result };
            }

            // Fallback: If no Wikipedia info and no specific infobox, use the first search result for a generic "Site Info" box
            if (!wikipediaInfo && !infoBoxResult && searchResults.length > 0) {
                const firstResult = searchResults[0];

                // Ensure we have a valid icon URL
                let iconUrl = firstResult.icon;
                if (!iconUrl && firstResult.url) {
                    iconUrl = `https://www.google.com/s2/favicons?domain=${getDomain(firstResult.url)}&sz=128`;
                }

                infoBoxResult = {
                    type: 'generic_infobox',
                    title: firstResult.title,
                    description: firstResult.description,
                    url: firstResult.url,
                    profile: {
                        img: iconUrl
                    },
                    fallback: true
                };
            }
        }

        return json({
            ok: true,
            type: searchType,
            searchResults,
            infoBoxResult: {
                ...infoBoxResult,
                wikipediaInfo: wikipediaInfo
            }
        });

    } catch (err) {
        console.error('[API] Error fetching search results:', err);
        return json({ ok: false, error: 'Sunucu hatası', details: err.message }, { status: 500 });
    }
}
