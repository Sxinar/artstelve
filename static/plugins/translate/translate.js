(function () {
    console.log("[Plugin] Quick Translate initialized");
    window.addEventListener('artstelve_search', (e) => {
        const query = (e.detail.query || "").toLowerCase();
        if (query.includes(' çevir') || query.includes(' translate ')) {
            const word = query.replace(' çevir', '').replace('translate', '').trim();
            if (!word) return;

            e.detail.addSpecialResult({
                id: 'translate_result',
                type: 'plugin_result',
                title: 'Hızlı Çeviri',
                content: `<div style="padding:0.5rem 0;">
                            <div style="opacity:0.6; font-size:0.8rem;">Türkçe → İngilizce</div>
                            <div style="font-size:1.2rem; margin-top:0.3rem;">"${word}" → <b style="color:var(--primary-color);">"${word} (Translated)"</b></div>
                          </div>`,
                icon: 'fas fa-language',
                plugin: 'Quick Translate'
            });
        }
    });
})();
