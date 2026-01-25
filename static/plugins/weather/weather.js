(function () {
    console.log("[Plugin] Weather initialized");
    window.addEventListener('artstelve_search', (e) => {
        const query = (e.detail.query || "").toLowerCase();
        if (query.includes('hava durumu') || query.includes('weather')) {
            // Simulated local weather for example
            e.detail.addSpecialResult({
                id: 'weather_result',
                type: 'plugin_result',
                title: 'Hava Durumu',
                content: `<div style="display:flex; align-items:center; gap:1.5rem;">
                            <i class="fas fa-sun" style="font-size:3rem; color:#f1c40f;"></i>
                            <div>
                                <div style="font-size:1.8rem; font-weight:bold;">24°C</div>
                                <div style="opacity:0.8;">İstanbul, Türkiye • Güneşli</div>
                            </div>
                          </div>`,
                icon: 'fas fa-cloud-sun',
                plugin: 'Weather Widget'
            });
        }
    });
})();
