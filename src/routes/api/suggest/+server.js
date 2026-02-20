import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, setHeaders }) {
    const query = url.searchParams.get('q');
    const withSpelling = url.searchParams.get('spelling') !== '0';

    // Cache: 30 dakika tarayıcı, 1 saat CDN
    setHeaders({
        'Cache-Control': 'public, max-age=1800, s-maxage=3600'
    });

    if (!query || query.trim().length < 2) {
        return json({ suggestions: [], spellCorrection: null });
    }

    const q = query.trim();

    try {
        // Paralel olarak hem öneri hem yazım düzeltme al
        const [suggestions, spellCorrection] = await Promise.all([
            fetchGoogleSuggestions(q),
            withSpelling ? fetchSpellCorrection(q) : Promise.resolve(null)
        ]);

        return json({ suggestions, spellCorrection });
    } catch (e) {
        console.error('[Suggest API] Error:', e);
        return json({ suggestions: [], spellCorrection: null });
    }
}

/**
 * Google'ın ücretsiz öneri API'sinden öneriler al.
 * Not: DuckDuckGo alternatifi düşünülebilir ancak Google Türkçe desteği için daha üstündür.
 */
async function fetchGoogleSuggestions(query) {
    try {
        const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}&hl=tr&gl=TR`;
        const res = await fetch(url, {
            headers: {
                'Accept-Language': 'tr-TR,tr;q=0.9'
            }
        });
        if (!res.ok) return [];

        const buffer = await res.arrayBuffer();
        const decoder = new TextDecoder('windows-1254');
        const text = decoder.decode(buffer);
        const data = JSON.parse(text);

        // Yanıt formatı: [query, [suggestions...]]
        return Array.isArray(data[1]) ? data[1].slice(0, 10) : [];
    } catch {
        return [];
    }
}

/**
 * Yazım düzeltme önerisi al.
 * Google Suggest'i kullanarak yazım denetimi yapıyoruz:
 * Eğer ilk öneri mevcut sorgusundan belirgin şekilde farklıysa, düzeltme önerisi göster.
 */
async function fetchSpellCorrection(query) {
    try {
        // Datamuse API (İngilizce odaklı) ile birlikte Google suggest'i kullanıyoruz.
        // Google suggest Türkçe için çok daha iyi çalışır.
        const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}&hl=tr&gl=TR`;
        const res = await fetch(url, {
            headers: {
                'Accept-Language': 'tr-TR,tr;q=0.9'
            }
        });
        if (!res.ok) return null;

        const buffer = await res.arrayBuffer();
        const decoder = new TextDecoder('windows-1254');
        const text = decoder.decode(buffer);
        const data = JSON.parse(text);
        const suggestions = Array.isArray(data[1]) ? data[1] : [];

        if (suggestions.length === 0) return null;

        const firstSuggestion = suggestions[0].toLowerCase().trim();
        const originalQuery = query.toLowerCase().trim();

        // Eğer ilk öneri orijinal sorgudaki kelimeleri içeriyorsa benzerdir
        // Eğer farklıysa ve benzerlik skoru yüksekse düzeltme önerisi göster
        if (firstSuggestion === originalQuery) return null;

        // Levenshtein mesafesi hesapla: küçük farklar = yazım hatası olabilir
        const distance = levenshtein(firstSuggestion, originalQuery);
        const maxLen = Math.max(firstSuggestion.length, originalQuery.length);
        const similarity = 1 - distance / maxLen;

        // %60-95 arası benzerlik: muhtemelen yazım hatası
        // %95+ aynı: zaten doğru
        // %60 altı: tamamen farklı bir şey
        // %50-98 arası benzerlik: yazım hatası olasılığı yüksek
        // %98+ zaten çok benzer veya aynıdır
        if (similarity >= 0.5 && similarity < 0.98) {
            return {
                original: query,
                corrected: suggestions[0]
            };
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Levenshtein mesafesi (yazım benzerliği için)
 */
function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}
