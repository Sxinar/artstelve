import { json } from '@sveltejs/kit';

export async function GET({ url }) {
    const cssUrl = url.searchParams.get('url');
    
    if (!cssUrl) {
        return json({ error: 'URL parameter is required' }, { status: 400 });
    }
    
    // Validate URL to prevent SSRF attacks
    try {
        const urlObj = new URL(cssUrl);
        // Only allow URLs from devs.artado.xyz domain (for logos and themes)
        if (!urlObj.hostname.includes('devs.artado.xyz')) {
            return json({ error: 'Invalid URL domain' }, { status: 400 });
        }
    } catch (error) {
        return json({ error: 'Invalid URL format' }, { status: 400 });
    }
    
    console.log("[API CSS] Fetching CSS/Logo from:", cssUrl);
    
    try {
        // Node.js environment fetch with additional options
        const response = await fetch(cssUrl, {
            headers: {
                'Accept': 'text/css,application/css,*/*',
                'User-Agent': 'Artado-Workshop-Proxy/1.0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`CSS fetch returned ${response.status}: ${response.statusText}`);
        }
        
        const cssContent = await response.text();
        
        return new Response(cssContent, {
            headers: {
                'Content-Type': 'text/css',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        });
        
    } catch (error) {
        console.error("[API CSS] Error fetching CSS/Logo:", error);
        return json({ 
            error: `Failed to fetch CSS/Logo: ${error.message}` 
        }, { status: 500 });
    }
}
