import { json } from '@sveltejs/kit';

const WORKSHOP_API_URL = 'https://devs.artado.xyz/workshop/api.php';

export async function GET() {
    console.log("[API Plugins] Fetching from workshop:", WORKSHOP_API_URL);
    
    try {
        // Query the workshop API for plugins
        const response = await fetch(WORKSHOP_API_URL);
        
        if (!response.ok) {
            throw new Error(`Workshop API returned ${response.status}`);
        }
        
        const data = await response.json();
        
        // Extract plugins from workshop response
        const workshopPlugins = data.plugins || [];
        
        // Filter only plugins (not themes or logos)
        const plugins = workshopPlugins.filter(item => {
            const category = (item.category || "").toLowerCase();
            const downloadUrl = (item.download_url || "").toLowerCase();
            
            // Exclude logos and home themes
            const isLogo = downloadUrl.endsWith('.png') || 
                          downloadUrl.endsWith('.jpg') || 
                          downloadUrl.endsWith('.jpeg') || 
                          downloadUrl.endsWith('.gif') || 
                          downloadUrl.endsWith('.svg') ||
                          downloadUrl.includes('logo');
            
            const isHomeTheme = category === 'ana-sayfa' || category === 'home';
            
            return !isLogo && !isHomeTheme;
        }).map(plugin => ({
            id: plugin.id,
            name: plugin.name,
            author: plugin.author || 'Workshop',
            description: plugin.description || '',
            download_url: plugin.download_url,
            category: plugin.category,
            version: plugin.version || '1.0.0',
            isWorkshop: true,
            isLocal: false
        }));
        
        return json({ plugins });
    } catch (err) {
        console.error('[API Plugins] Error fetching from workshop:', err);
        return json({ plugins: [], error: err.message });
    }
}
