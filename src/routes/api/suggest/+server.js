import { json } from '@sveltejs/kit';

export async function GET({ url, setHeaders }) {
    const query = url.searchParams.get('q');

    // Set caching: 1 hour browser, 2 hours CDN
    setHeaders({
        'Cache-Control': 'public, max-age=3600, s-maxage=7200'
    });

    if (!query) {
        return json([]);
    }

    try {
        const googleSuggestUrl = `http://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}&ie=UTF-8&oe=UTF-8`;
        const response = await fetch(googleSuggestUrl);

        if (response.ok) {
            const data = await response.json();
            // data structure: [query, [suggestions...]]
            const suggestions = data[1] || [];
            return json(suggestions);
        } else {
            return json([]);
        }
    } catch (e) {
        console.error("Suggestion API Error:", e);
        return json([]);
    }
}
