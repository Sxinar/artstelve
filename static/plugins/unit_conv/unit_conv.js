(function () {
    console.log("[Plugin] Unit Converter initialized");
    window.addEventListener('artstelve_search', (e) => {
        const query = (e.detail.query || "").toLowerCase();
        if (query.includes('kaç') || query.includes('to')) {
            if (query.includes('kg') && (query.includes('lbs') || query.includes('libre'))) {
                const kg = parseFloat(query) || 1;
                const lbs = (kg * 2.20462).toFixed(2);
                e.detail.addSpecialResult({
                    id: 'unit_result',
                    type: 'plugin_result',
                    title: 'Birim Dönüştürücü',
                    content: `<div style="font-size:1.3rem;"><b>${kg} kg</b> = <span style="color:var(--primary-color); font-weight:bold;">${lbs} lbs</span></div>`,
                    icon: 'fas fa-balance-scale',
                    plugin: 'Unit Converter'
                });
            }
        }
    });
})();
