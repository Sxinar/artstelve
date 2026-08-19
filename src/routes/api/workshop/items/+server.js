import { json } from '@sveltejs/kit';

const WORKSHOP_API_URL = 'https://devs.artado.xyz/workshop/api.php';

export async function GET() {
    console.log("[API Workshop] Fetching from:", WORKSHOP_API_URL);
    
    // CORS ve standart headerlar
    const commonHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    try {
        const response = await fetch(WORKSHOP_API_URL, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Artado-Search-Workshop-Client/1.0'
            },
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            throw new Error(`Workshop API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        console.log("[API Workshop] Success:", data.success ? "Yes" : "No", 
                    "Themes:", data.themes?.length || 0,
                    "Logos:", data.logos?.length || 0);

        // Workshop istemcisi yalnızca görsel tema ve logo verisi sunar.
        return json({
            success: Boolean(data.success),
            themes: Array.isArray(data.themes) ? data.themes : [],
            logos: Array.isArray(data.logos) ? data.logos : []
        }, { headers: commonHeaders });

    } catch (err) {
        console.error('[API Workshop] Error:', err);
        
        // Hata durumunda boş diziler dönerek uygulamanın çökmesini engelliyoruz
        return json({
            themes: [],
            logos: [], // Artık logolar da hata durumunda boş dizi döner
            success: false,
            error: err.message
        }, { headers: commonHeaders });
    }
}
