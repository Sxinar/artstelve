import { json } from '@sveltejs/kit';

// WARNING: Storing API keys directly in code is insecure, even on the backend.
// Use environment variables for production.
const BRAVE_API_KEY = 'BSAuFJ0CRuCgoNsyYopbiFg6hItXpsL'; 
const GEMINI_API_KEY = 'AIzaSyBFk0rmuDqJoG0rdVeurS3hU2skd5YsjDw'; // Switched to Gemini
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

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
    if (!searchQuery) {
        return null; // No query to summarize
    }

    // Gemini prompt structure - UPDATED PROMPT
    const systemInstruction = "Sen, kullanıcıların arama sorgularını doğrudan ve kısaca yanıtlayan veya tanımlayan yardımcı bir asistansın."; // Updated system instruction
    const userPrompt = `Aşağıdaki arama sorgusu için çok kısa (1-2 cümle) bir tanım veya doğrudan bir cevap sağla:
Arama Sorgusu: "${searchQuery}"
Tanım/Cevap:
`; // Updated user prompt
    // console.log("[API DEBUG] Gemini Query Summary Prompt (User Part):", userPrompt);

    try {
        // Construct the Gemini API request body
        const requestBody = {
            contents: [{
                parts: [
                    {text: systemInstruction},
                    {text: userPrompt}
                ]
            }],
            generationConfig: { 
                temperature: 0.6,
                maxOutputTokens: 100 // Slightly increased tokens for potentially longer answers
            }
        };
        // console.log("[API DEBUG] Gemini Request Body:", JSON.stringify(requestBody)); 

        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // API key is in the URL, no Authorization header needed
            },
            body: JSON.stringify(requestBody)
        });

        // console.log("[API DEBUG] Gemini Response Status:", response.status);

        if (!response.ok) {
            let errorData = { message: `Gemini API request failed with status ${response.status}` };
            try {
                 errorData = await response.json(); 
                 // Check for specific Gemini error structure
                 if (errorData.error) errorData.message = errorData.error.message;
            } catch(e) {
                 console.warn("[API] Could not parse Gemini error response body.");
            }
            console.error(`[API] Gemini API Error (${response.status}) for Query Summary:`, errorData);
             return 'AI_ERROR'; // Return specific error marker
        }

        const data = await response.json();
        // console.log("[API DEBUG] Gemini Query Summary Response Data:", JSON.stringify(data));

        // Extract summary from Gemini response structure
        const summary = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        // console.log("[API DEBUG] Extracted Query Summary from Gemini:", summary);

        // Basic cleanup (already handled by replace below, keeping for safety)
        if (summary) {
            let cleanedSummary = summary.replace(/^"|"$/g, ''); // Remove surrounding quotes if any
            // console.log("[API DEBUG] Cleaned Gemini Query Summary:", cleanedSummary);
            return cleanedSummary;
        }
        // console.log("[API DEBUG] No query summary content found in Gemini response.");
        return ''; // Return empty string if no summary content

    } catch (err) {
        console.error('[API] Error calling Gemini API for Query Summary:', err);
        return 'AI_ERROR'; // Return specific error marker on network/other errors
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

// Google arama sonuçlarını getirme fonksiyonu
async function fetchGoogleResults(query, searchType) {
    if (!GOOGLE_API_KEY || !GOOGLE_CX) {
        console.warn("[API] Google API anahtarı veya CX tanımlanmamış.");
        return null;
    }
    
    try {
        // Google Custom Search API URL
        const googleApiUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}`;
        
        const response = await fetch(googleApiUrl);
        
        if (!response.ok) {
            console.error(`[API] Google API Error: ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        
        // Google sonuçlarını dönüştür
        if (data.items && data.items.length > 0) {
            return data.items.map(item => ({
                title: item.title || 'Başlık Yok',
                url: item.link || '#',
                description: item.snippet || 'Açıklama yok.',
                icon: `https://www.google.com/s2/favicons?domain=${getDomain(item.link)}`,
                age: '' // Google API yaş bilgisi sağlamıyor
            }));
        }
        
        return [];
    } catch (err) {
        console.error('[API] Error fetching Google search results:', err);
        return null;
    }
}

export async function GET({ url }) {
    console.log("[API LIFECYCLE] GET /api/search endpoint hit!");

    const query = url.searchParams.get('i');
    const searchType = url.searchParams.get('t') || 'web'; // Renamed variable from 'type'
    const engine = url.searchParams.get('engine') || 'Brave'; // Arama motoru parametresi

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
        console.log(`[API DEBUG] Query AI Summary result (Gemini):`, queryAiSummary);
    }
    
    // Seçilen arama motoruna göre API URL'sini belirle
    let apiUrl;
    let useGoogleApi = false;
    
    if (engine === 'Google') {
        useGoogleApi = true;
        console.log(`[API] Using Google search engine for: ${query}`);
    } else {
        apiUrl = `https://api.search.brave.com/res/v1/${searchType}/search?q=${encodeURIComponent(query)}`;
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
                try { errorBody = await response.text(); } catch(e) {}
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
            else if (searchType === 'images' && data.images && data.images.results) {
                searchResults = data.images.results.map(item => ({
                    title: item.title || 'Görsel',
                    thumbnail: item.thumbnail?.src,
                    url: item.properties?.url || item.url,
                    source: getDomain(item.source) // Get domain from source
                }));
            }
            // Video Results
            else if (searchType === 'videos' && data.videos && data.videos.results) {
                searchResults = data.videos.results.map(item => ({
                    title: item.title || 'Video',
                    description: item.description,
                    url: item.url,
                    thumbnail: item.thumbnail?.src,
                    duration: formatDuration(item.duration), // Format duration
                    publisher: item.publisher?.name,
                    age: formatAge(item.page_age) // Format age
                }));
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
            searchResults: searchResults,
            infoBoxResult: {
                ...infoBoxResult,
                wikipediaInfo: wikipediaInfo // Wikipedia özet bilgisini ekle
            },
            queryAiSummary: queryAiSummary // Add the single query summary to the response
        });

    } catch (err) {
        console.error('[API] Error fetching search results:', err);
        return json({ error: 'Sunucu hatası', details: err.message }, { status: 500 });
    }
}
