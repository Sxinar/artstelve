import { json } from '@sveltejs/kit';

const WORKSHOP_API_URL = 'https://devs.artado.xyz/workshop/api.php';
// Not: Eğer bu URL ulaşılabilir değilse 127.0.0.1 olanı deneyebilirsiniz.
// Not: Eğer artstelve bir alt dizindeyse URL: http://localhost/artstelve/devs/Workshop/api.php olabilir.

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