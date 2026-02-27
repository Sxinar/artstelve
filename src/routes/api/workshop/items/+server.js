import { json } from '@sveltejs/kit';

 const WORKSHOP_API_URL = 'https://devs.artado.xyz/workshop/api.php';

export async function GET() {
    console.log("[API Workshop] Workshop API disabled - returning empty results");
    
    // Workshop API disabled - return empty results
    return json({
        themes: [],
        plugins: [],
        success: false
    }, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    });
} 