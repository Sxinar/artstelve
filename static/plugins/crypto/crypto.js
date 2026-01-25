(function () {
    console.log("[Plugin] Crypto initialized");
    window.addEventListener('artstelve_search', (e) => {
        const query = (e.detail.query || "").toLowerCase();
        if (query.includes('btc') || query.includes('bitcoin') || query.includes('eth')) {
            e.detail.addSpecialResult({
                id: 'crypto_result',
                type: 'plugin_result',
                title: 'Kripto Piyasası',
                content: `<div style="display:flex; justify-content:space-between; width:100%; max-width:300px;">
                            <div><b>Bitcoin (BTC)</b></div>
                            <div style="color:#2ecc71;">$102,450.00 (+1.2%)</div>
                          </div>
                          <div style="display:flex; justify-content:space-between; width:100%; max-width:300px; margin-top:0.5rem;">
                            <div><b>Ethereum (ETH)</b></div>
                            <div style="color:#e74c3c;">$3,120.50 (-0.4%)</div>
                          </div>`,
                icon: 'fab fa-bitcoin',
                plugin: 'Crypto Tracker'
            });
        }
    });
})();
