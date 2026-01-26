import { json } from '@sveltejs/kit';

const WORKSHOP_API_URL = 'https://devs.artado.xyz/workshop/api.php';

export async function GET() {
    console.log("[API Themes] Fetching from workshop:", WORKSHOP_API_URL);
    
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
        
        // Process themes from themes array
        const generalThemes = workshopThemes.map(theme => ({
            id: theme.id,
            name: theme.name,
            author: theme.author || 'Workshop',
            category: theme.category || 'site',
            path: theme.download_url,
            download_url: theme.download_url,
            description: theme.description || '',
            version: theme.version || '1.0.0',
            isWorkshop: true,
            isLocal: false
        }));
        
        // Process home themes from plugins array (category = 'home' or 'ana-sayfa')
        const homeThemes = workshopPlugins
            .filter(plugin => {
                const category = (plugin.category || "").toLowerCase();
                return category === 'ana-sayfa' || category === 'home';
            })
            .map(theme => ({
                id: theme.id,
                name: theme.name,
                author: theme.author || 'Workshop',
                category: 'home',
                path: theme.download_url,
                download_url: theme.download_url,
                description: theme.description || '',
                version: theme.version || '1.0.0',
                isWorkshop: true,
                isLocal: false
            }));
        
        return json({ themes: [...generalThemes, ...homeThemes] });
    } catch (err) {
        console.error('[API Themes] Error fetching from workshop:', err);
        return json({ themes: [], error: err.message });
    }
}
