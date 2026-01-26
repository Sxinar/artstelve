import { json } from '@sveltejs/kit';

const WORKSHOP_API_URL = 'https://devs.artado.xyz/workshop/api.php';
// Not: Eğer bu URL ulaşılabilir değilse 127.0.0.1 olanı deneyebilirsiniz.
// Not: Eğer artstelve bir alt dizindeyse URL: http://localhost/artstelve/devs/Workshop/api.php olabilir.

export async function GET() {
    console.log("[API Workshop] Fetching from:", WORKSHOP_API_URL);
    try {
        // Node.js environment fetch with additional options
        const response = await fetch(WORKSHOP_API_URL, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Artstelve-Workshop-Client/1.0'
            },
            // Add timeout and other options for Node.js
            signal: AbortSignal.timeout(30000)
        });
        
        if (!response.ok) {
            throw new Error(`Workshop API returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("[API Workshop] Success:", data.success ? "Yes" : "No", "Themes:", data.themes?.length || 0, "Plugins:", data.plugins?.length || 0);
        
        return json(data, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        });
    } catch (err) {
        console.error('[API Workshop] Error:', err);
        return json({ 
            themes: [], 
            plugins: [], 
            error: err.message,
            success: false 
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        });
    }
} 