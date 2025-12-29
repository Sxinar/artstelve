import { json } from '@sveltejs/kit';

const WORKSHOP_API_URL = 'http://localhost/devs/Workshop/api.php';

export async function GET() {
    console.log("[API Workshop] Fetching from:", WORKSHOP_API_URL);
    try {
        const response = await fetch(WORKSHOP_API_URL);
        if (!response.ok) {
            throw new Error(`Workshop API returned ${response.status}`);
        }
        const data = await response.json();
        return json(data);
    } catch (err) {
        console.error('[API Workshop] Error:', err);
        return json({ themes: [], plugins: [], error: err.message });
    }
} 