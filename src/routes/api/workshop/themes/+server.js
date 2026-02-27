import { json } from '@sveltejs/kit';

const WORKSHOP_API_URL = 'https://devs.artado.xyz/workshop/api.php';

export async function GET() {
    console.log("[API Themes] Fetching logos from workshop:", WORKSHOP_API_URL);
    
    try {
        // Query the workshop API for themes
        const response = await fetch(WORKSHOP_API_URL);
        
        if (!response.ok) {
            throw new Error(`Workshop API returned ${response.status}`);
        }
        
        const data = await response.json();
        
        // Extract themes from workshop response
        const workshopThemes = data.themes || [];
        const workshopPlugins = data.plugins || [];
        
        // Only fetch logos from plugins array (exclude themes and home themes)
        const logos = workshopPlugins
            .filter(plugin => {
                const downloadUrl = (plugin.download_url || "").toLowerCase();
                // Only include image files (logos)
                return downloadUrl.endsWith('.png') || 
                       downloadUrl.endsWith('.jpg') || 
                       downloadUrl.endsWith('.jpeg') || 
                       downloadUrl.endsWith('.gif') || 
                       downloadUrl.endsWith('.svg') ||
                       downloadUrl.includes('logo');
            })
            .map(logo => ({
                id: logo.id,
                name: logo.name,
                author: logo.author || 'Workshop',
                category: 'logo',
                path: logo.download_url,
                download_url: logo.download_url,
                description: logo.description || '',
                version: logo.version || '1.0.0',
                isWorkshop: true,
                isLocal: false
            }));
        
        return json({ themes: logos });
    } catch (err) {
        console.error('[API Themes] Error fetching logos from workshop:', err);
        return json({ themes: [], error: err.message });
    }
}
