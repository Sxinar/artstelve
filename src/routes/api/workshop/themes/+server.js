import { json } from '@sveltejs/kit';

const WORKSHOP_API_URL = 'https://devs.artado.xyz/workshop/api.php';

export async function GET() {
    console.log("[API Themes] Fetching logos from workshop:", WORKSHOP_API_URL);

    try {
        const response = await fetch(WORKSHOP_API_URL, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Artado-Search-Workshop-Client/1.0'
            },
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
            throw new Error(`Workshop API returned ${response.status}`);
        }

        const data = await response.json();
        
        // PHP'den gelen 'logos' dizisini alıyoruz. 
        // Eğer PHP tarafında logos anahtarı yoksa, plugins içinden filtreleme yapıyoruz.
        const rawLogos = data.logos || (data.plugins || []).filter(item => {
            const category = (item.category || "").toLowerCase();
            const downloadUrl = (item.download_url || "").toLowerCase();
            return category === 'artado_logo' || 
                   downloadUrl.endsWith('.png') || 
                   downloadUrl.endsWith('.jpg') || 
                   downloadUrl.includes('logo');
        });

        // Frontend'in beklediği 'themes' formatına (veya logos formatına) map ediyoruz
        const processedLogos = rawLogos.map(logo => ({
            id: logo.id,
            name: logo.name,
            author: logo.author || 'Workshop',
            category: 'logo',
            path: logo.download_url,
            download_url: logo.download_url,
            image_url: logo.image_url || logo.download_url,
            description: logo.description || 'Workshop Logo',
            version: '1.0.0',
            isWorkshop: true,
            isLocal: false
        }));

        // NOT: Frontend'infetch ettiği yer logos beklediği için 'themes' anahtarıyla da dönebiliriz
        // veya direkt logos olarak dönebiliriz. Senin frontend logos.set(data.themes) diyorsa:
        return json({ 
            success: true, 
            themes: processedLogos, // Frontend 'data.themes' beklediği için bu anahtarı kullandık
            logos: processedLogos 
        });

    } catch (err) {
        console.error('[API Themes] Error fetching logos:', err);
        return json({ themes: [], logos: [], success: false, error: err.message });
    }
}