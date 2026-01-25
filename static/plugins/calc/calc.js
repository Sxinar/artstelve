(function () {
    console.log("[Plugin] Calculator Pro initialized");
    window.addEventListener('artstelve_search', (e) => {
        const query = (e.detail.query || "").trim();
        try {
            // Simple math check (e.g. 5 + 5, 10 * 20)
            if (/^[0-9+\-*/().\s]+$/.test(query) && /[+\-*/]/.test(query)) {
                // Use Function instead of eval for slighty better safety
                const result = new Function('return ' + query)();
                e.detail.addSpecialResult({
                    id: 'calc_result',
                    type: 'plugin_result',
                    title: 'Hesap Makinesi',
                    content: `${query} = <span style="color:var(--primary-color); font-weight:bold; font-size:1.4rem;">${result}</span>`,
                    icon: 'fas fa-calculator',
                    plugin: 'Calculator Pro'
                });
            }
        } catch (err) {
            console.error("[calc] Error:", err);
        }
    });
})();
