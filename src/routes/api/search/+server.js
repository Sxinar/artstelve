import { json } from '@sveltejs/kit';

// WARNING: Storing API keys directly in code is insecure, even on the backend.
// Use environment variables for production.
const BRAVE_API_KEY = 'BSAuFJ0CRuCgoNsyYopbiFg6hItXpsL';
const GEMINI_API_KEY = 'AIzaSyBs9IlQ7MQcNHtJ45sTn2bFhkpSjFqT8ZA';
// Use stable model name
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
// const DEEPSEEK_API_KEY = '...'; // Insufficient balance, disabled.


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

// --- Google Gemini AI Query Summary Function ---
async function getAiQuerySummary(searchQuery) {
    if (!GEMINI_API_KEY) {
        console.warn("[API] Gemini API key not configured. Skipping AI query summary.");
        return null;
    }
    if (!searchQuery) return null;

    const systemInstruction = "Sen, kullanıcıların arama sorgularını doğrudan ve kısaca (1-2 cümle) yanıtlayan veya tanımlayan yardımcı bir asistansın.";
    const userPrompt = `Arama Sorgusu: "${searchQuery}"\nTanım/Cevap:`;

    try {
        const requestBody = {
            contents: [{ parts: [{ text: systemInstruction }, { text: userPrompt }] }],
            generationConfig: { temperature: 0.6, maxOutputTokens: 100 }
        };

        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            console.error(`[API] Gemini API Error: ${response.status}`);
            return 'AI_ERROR';
        }

        const data = await response.json();
        const summary = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        return summary ? summary.replace(/^"|"$/g, '') : '';

    } catch (err) {
        console.error('[API] Error calling Gemini API:', err);
        return 'AI_ERROR';
    }
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

export async function GET({ url }) {
    console.log("[API LIFECYCLE] GET /api/search endpoint hit!");

    const query = url.searchParams.get('i');
    const searchType = url.searchParams.get('t') || 'web'; // Renamed variable from 'type'
    const engine = url.searchParams.get('engine') || 'Brave'; // Arama motoru parametresi
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

    // --- Fetch AI Query Summary (Only for web searches) ---
    let queryAiSummary = null;
    if (searchType === 'web') {
        console.log(`[API DEBUG] Getting AI summary for the query (using Gemini): ${query}`);
        queryAiSummary = await getAiQuerySummary(query);
        console.log(`[API DEBUG] Query AI Summary result:`, queryAiSummary);
    }

    // Seçilen arama motoruna göre API URL'sini belirle
    let apiUrl;
    let useGoogleApi = false;

    if (engine === 'Google') {
        useGoogleApi = true;
        console.log(`[API] Using Google search engine for: ${query}`);
    } else {
        const params = new URLSearchParams();
        params.set('q', query);
        if (!Number.isNaN(offset) && offset > 0) params.set('offset', String(offset));
        if (!Number.isNaN(count) && count > 0) params.set('count', String(count));
        if (safe === 'on') params.set('safesearch', 'strict');
        // Image specific filters (Brave supports some via query params)
        if (searchType === 'images') {
            if (size) params.set('size', size);
            if (color) params.set('color', color);
            if (aspect) params.set('aspect', aspect);
            if (imgType) params.set('type', imgType);
            if (palette) params.set('palette', palette);
        }
        apiUrl = `https://api.search.brave.com/res/v1/${searchType}/search?${params.toString()}`;
        console.log(`[API] Fetching ${searchType} results for: ${query} from Brave`);
    }

    try {
        let response;
        let data;
        let searchResults = [];
        let infoBoxResult = null;
        let wikipediaInfo = null;

        if (useGoogleApi) {
            // Google API kullanarak sonuçları getir
            const googleResults = await fetchGoogleResults(query, searchType);
            if (googleResults === null) {
                return json({ error: 'Google API hatası' }, { status: 500 });
            }
            searchResults = googleResults;
        } else if (engine === 'DuckDuckGo') {
            // DuckDuckGo API kullanarak sonuçları getir
            const ddgResults = await fetchDuckDuckGoResults(query, searchType);
            if (ddgResults === null) {
                return json({ error: 'DuckDuckGo API hatası' }, { status: 500 });
            }
            searchResults = ddgResults;
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
                // Return a structured error
                return json({ error: `Brave API hatası: ${response.status}`, details: errorBody }, { status: response.status });
            }

            data = await response.json();
            // console.log('[API] Brave API Response:', data); // Optional: Log raw response

            // Wikipedia özeti için arama yap (web aramaları için)
            if (searchType === 'web') {
                try {
                    // Wikipedia API'sini kullanarak özet bilgisi al
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
                            console.log("[API DEBUG] Found Wikipedia summary for query.");
                        }
                    }
                } catch (wikiErr) {
                    console.error('[API] Error fetching Wikipedia summary:', wikiErr);
                    // Hata durumunda Wikipedia özeti gösterme, ama işleme devam et
                }
            }

            // --- Process results ---
            let infoBoxResult = null;

            // Web Results
            if (searchType === 'web' && data.web && data.web.results) {
                // Map results WITHOUT individual AI summaries
                searchResults = data.web.results.map(item => {
                    return {
                        title: item.title || 'Başlık Yok',
                        url: item.url || '#',
                        description: item.description || 'Açıklama yok.',
                        icon: item.profile?.img || `https://icons.duckduckgo.com/ip3/${getDomain(item.url)}.ico`,
                        age: formatAge(item.page_age)
                        // No aiSummary field here anymore
                    };
                });
                console.log("[API DEBUG] Processed web results (no individual summaries).");
            }
            // Image Results
            else if (searchType === 'images') {
                console.log('[API DEBUG] Raw Image Response Keys:', Object.keys(data));
                if (data.results) {
                    console.log('[API DEBUG] Found data.results for images (Length):', data.results.length);
                    searchResults = data.results.map(item => ({
                        title: item.title || 'Görsel',
                        thumbnail: item.thumbnail?.src || item.url,
                        url: item.properties?.url || item.url,
                        source: item.source || getDomain(item.url)
                    }));
                } else if (data.images && data.images.results) {
                    console.log('[API DEBUG] Found data.images.results for images (Length):', data.images.results.length);
                    searchResults = data.images.results.map(item => ({
                        title: item.title || 'Görsel',
                        thumbnail: item.thumbnail?.src || item.url,
                        url: item.properties?.url || item.url,
                        source: item.source || getDomain(item.url)
                    }));
                } else {
                    console.warn('[API DEBUG] No image results found in standard paths. Data:', JSON.stringify(data).substring(0, 200) + '...');
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
                        duration: formatDuration(item.duration), // Format duration
                        publisher: item.publisher?.name,
                        age: formatAge(item.page_age) // Format age
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
                // Apply source filter if provided (by domain or publisher name)

                if (newsSource) {
                    const sourceLc = newsSource.toLowerCase();
                    searchResults = searchResults.filter(r =>
                        (r.source && String(r.source).toLowerCase().includes(sourceLc)) ||
                        (r.url && getDomain(r.url).toLowerCase().includes(sourceLc))
                    );
                }
                // Apply date range filter if provided (expects ISO yyyy-mm-dd)
                if (startDate || endDate) {
                    const start = startDate ? new Date(startDate) : null;
                    const end = endDate ? new Date(endDate) : null;
                    searchResults = searchResults.filter(r => {
                        const d = r.age ? new Date(r.age) : null;
                        if (!d || isNaN(d.getTime())) return true; // keep if unknown
                        if (start && d < start) return false;
                        if (end) {
                            // include entire end day
                            const endDay = new Date(end);
                            endDay.setHours(23, 59, 59, 999);
                            if (d > endDay) return false;
                        }
                        return true;
                    });
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
                console.log('[API DEBUG] Creating Generic Infobox from first result:', firstResult.title);

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
                        // Add styles/classes if needed or force size in frontend
                    },
                    fallback: true // Mark as fallback to help frontend debugging
                };
            }
        }

        // This section is redundant as we already checked response.ok and parsed data above
        // The duplicate data declaration is causing the error
        // Removing this redundant code block

        // This section was removed as it was a duplicate of the processing code above
        // The duplicate variable declarations were causing the SyntaxError
        // Add more checks here if needed

        // console.log('[API] Processed results:', searchResults);
        // console.log('[API] Infobox result:', infoBoxResult);

        // console.log("[API DEBUG] Final searchResults being sent to frontend:", searchResults); // Log final results
        return json({
            ok: true,
            type: searchType,
            searchResults,
            infoBoxResult: {
                ...infoBoxResult,
                wikipediaInfo: wikipediaInfo
            },
            queryAiSummary: queryAiSummary
        });

    } catch (err) {
        console.error('[API] Error fetching search results:', err);
        return json({ ok: false, error: 'Sunucu hatası', details: err.message }, { status: 500 });
    }
}
