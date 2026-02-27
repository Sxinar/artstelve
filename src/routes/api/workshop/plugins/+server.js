import { json } from '@sveltejs/kit';

const WORKSHOP_API_URL = 'https://devs.artado.xyz/workshop/api.php';

export async function GET() {
    console.log("[API Plugins] Workshop API disabled - returning empty results");
    
    // Workshop API disabled - return empty results
    return json({ plugins: [] });
}
