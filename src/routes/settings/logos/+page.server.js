export async function load({ fetch }) {
    try {
        const response = await fetch("/api/workshop/themes");
        if (response.ok) {
            const data = await response.json();
            // PHP API'den gelen veriye göre 'logos' veya 'themes' kısmını alıyoruz
            return { logos: data.logos || data.themes || [] };
        }
    } catch (e) {
        console.error("Yükleme hatası:", e);
    }
    return { logos: [] };
}