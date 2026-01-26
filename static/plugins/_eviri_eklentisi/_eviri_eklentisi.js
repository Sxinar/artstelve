/**
 * Advanced Translate Plugin - Toggle Destekli
 * 12 dil desteği, API entegrasyonu, cache sistemi
 */

(function() {
    'use strict';
    
    console.log("[Plugin] Advanced Translate initialized");
    
    // Plugin aktif mi kontrolü
    function isPluginEnabled() {
        try {
            // Settings store'dan değeri oku
            const settings = JSON.parse(localStorage.getItem('artado-settings') || '{}');
            return settings.enableTranslatePlugin !== false; // Varsayılan true
        } catch (e) {
            return true; // Hata durumunda aktif kabul et
        }
    }
    
    // Plugin aktif değilse çalışma
    if (!isPluginEnabled()) {
        console.log("[Plugin] Translate plugin is disabled in settings");
        return;
    }
    
    // Desteklenen diller
    const supportedLanguages = {
        'en': { name: 'English', flag: '🇬🇧', code: 'en' },
        'tr': { name: 'Türkçe', flag: '🇹🇷', code: 'tr' },
        'de': { name: 'Deutsch', flag: '🇩🇪', code: 'de' },
        'fr': { name: 'Français', flag: '🇫🇷', code: 'fr' },
        'es': { name: 'Español', flag: '🇪🇸', code: 'es' },
        'it': { name: 'Italiano', flag: '🇮🇹', code: 'it' },
        'pt': { name: 'Português', flag: '🇵🇹', code: 'pt' },
        'ru': { name: 'Русский', flag: '🇷🇺', code: 'ru' },
        'ar': { name: 'العربية', flag: '🇸🇦', code: 'ar' },
        'zh': { name: '中文', flag: '🇨🇳', code: 'zh' },
        'ja': { name: '日本語', flag: '🇯🇵', code: 'ja' },
        'ko': { name: '한국어', flag: '🇰🇷', code: 'ko' }
    };
    
    // Çeviri API'si - MyMemory (ücretsiz)
    const translateText = async (text, from = 'en', to = 'tr') => {
        try {
            // Cache kontrolü
            const cacheKey = `${from}-${to}-${text}`;
            if (translationCache.has(cacheKey)) {
                console.log('[Translate] Using cache for:', cacheKey);
                return translationCache.get(cacheKey);
            }
            
            // MyMemory Free API (5000 karakter/gün limit)
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`);
            const data = await response.json();
            
            if (data.responseStatus === 200 && data.responseData.translatedText) {
                const result = data.responseData.translatedText;
                // Cache'e ekle
                translationCache.set(cacheKey, result);
                return result;
            } else {
                throw new Error('API response failed');
            }
        } catch (error) {
            console.log('[Translate] API failed, using fallback:', error);
            return null;
        }
    };
    
    // Cache sistemi
    const translationCache = new Map();
    
    // Dil seçimi arayüzü
    function showLanguageSelector(query, originalText) {
        const languageOptions = Object.entries(supportedLanguages)
            .map(([code, lang]) => `
                <div class="lang-option" data-from="${code}" style="
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.8rem;
                    cursor: pointer;
                    border-radius: 8px;
                    transition: all 0.2s;
                    border: 1px solid var(--border-color, #e0e0e0);
                    background: var(--card-background, #fff);
                " onmouseover="this.style.background='var(--hover-background, #f5f5f5)'" 
                   onmouseout="this.style.background='var(--card-background, #fff)'"
                   onclick="window.translatePlugin.selectLanguage('${code}', '${query.replace(/'/g, "\\'")}', '${originalText.replace(/'/g, "\\'")}')">
                    <span style="font-size: 1.5rem;">${lang.flag}</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--text-color, #333);">${lang.name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-color-secondary, #666);">${code.toUpperCase()}</div>
                    </div>
                    <div style="color: var(--primary-color, #1a73e8); font-weight: 500;">→</div>
                </div>
            `).join('');
        
        const selectorHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--card-background, #fff);
                border: 1px solid var(--border-color, #e0e0e0);
                border-radius: 16px;
                padding: 1.5rem;
                box-shadow: 0 20px 40px rgba(0,0,0,0.15);
                z-index: 10000;
                max-width: 400px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            ">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                    <h3 style="margin: 0; color: var(--text-color, #333); font-size: 1.2rem;">
                        🌍 Dil Seçimi
                    </h3>
                    <button onclick="this.closest('[style*=fixed]').remove()" style="
                        background: none;
                        border: none;
                        font-size: 1.5rem;
                        cursor: pointer;
                        color: var(--text-color-secondary, #666);
                        padding: 0.5rem;
                    ">×</button>
                </div>
                <div style="margin-bottom: 1rem; padding: 0.8rem; background: var(--hover-background, #f5f5f5); border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: var(--text-color-secondary, #666); margin-bottom: 0.3rem;">Çevrilecek metin:</div>
                    <div style="font-weight: 500; color: var(--text-color, #333);">${originalText}</div>
                </div>
                <div style="margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--text-color-secondary, #666);">
                    Kaynak dil seçin:
                </div>
                ${languageOptions}
            </div>
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 9999;
                onclick="this.remove(); this.previousElementSibling.remove();"
            "></div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', selectorHTML);
    }
    
    // Dil seçimi ve çeviri
    async function selectLanguage(fromLang, query, originalText) {
        // Modal'ı kapat
        const modal = document.querySelector('[style*="position: fixed"][style*="translate(-50%, -50%)"]');
        const overlay = document.querySelector('[style*="position: fixed"][style*="rgba(0,0,0,0.5)"]');
        if (modal) modal.remove();
        if (overlay) overlay.remove();
        
        // Hedef dil belirle (basit mantık)
        let toLang = 'tr'; // Varsayılan Türkçe
        if (fromLang === 'tr') toLang = 'en';
        else if (fromLang === 'en') toLang = 'tr';
        else if (['de', 'fr', 'es', 'it', 'pt'].includes(fromLang)) toLang = 'en';
        else if (['ru', 'ar', 'zh', 'ja', 'ko'].includes(fromLang)) toLang = 'en';
        
        // Çeviriyi yap
        const translation = await translateText(originalText, fromLang, toLang);
        
        // Sonucu göster
        showTranslationResult(originalText, translation, fromLang, toLang);
    }
    
    // Çeviri sonucunu göster
    function showTranslationResult(original, translation, from = 'en', to = 'tr') {
        const fromLang = supportedLanguages[from];
        const toLang = supportedLanguages[to];
        
        if (!fromLang || !toLang) return;
        
        // Önceki çeviri sonuçlarını temizle
        document.querySelectorAll('[data-translate-result]').forEach(el => el.remove());
        
        const resultHTML = `
            <div data-translate-result style="
                background: linear-gradient(135deg, ${fromLang.flag === '🇹🇷' ? '#e30a7a' : '#1a73e8'}, ${toLang.flag === '🇹🇷' ? '#e30a7a' : '#1a73e8'});
                border-radius: 16px;
                padding: 2px;
                margin: 1rem 0;
                position: relative;
                animation: slideIn 0.5s ease-out;
            ">
                <div style="
                    background: var(--card-background, #fff);
                    border-radius: 14px;
                    padding: 1.5rem;
                    position: relative;
                ">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 1.5rem;">${fromLang.flag}</span>
                            <span style="font-weight: 600; color: var(--text-color, #333);">${fromLang.name}</span>
                            <span style="color: var(--text-color-secondary, #666);">→</span>
                            <span style="font-size: 1.5rem;">${toLang.flag}</span>
                            <span style="font-weight: 600; color: var(--text-color, #333);">${toLang.name}</span>
                        </div>
                        <button onclick="this.closest('[data-translate-result]').remove()" style="
                            background: none;
                            border: none;
                            font-size: 1.2rem;
                            cursor: pointer;
                            color: var(--text-color-secondary, #666);
                            padding: 0.3rem;
                        ">×</button>
                    </div>
                    
                    <div style="margin-bottom: 1rem;">
                        <div style="font-size: 0.9rem; color: var(--text-color-secondary, #666); margin-bottom: 0.3rem;">Orijinal:</div>
                        <div style="font-size: 1.1rem; font-weight: 500; color: var(--text-color, #333); line-height: 1.5;">${original}</div>
                    </div>
                    
                    <div style="margin-bottom: 1rem;">
                        <div style="font-size: 0.9rem; color: var(--text-color-secondary, #666); margin-bottom: 0.3rem;">Çeviri:</div>
                        <div style="font-size: 1.1rem; font-weight: 600; color: var(--primary-color, #1a73e8); line-height: 1.5;">${translation || 'Çeviri başarısız'}</div>
                    </div>
                    
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button onclick="navigator.clipboard.writeText('${translation || ''}').then(() => this.textContent='Kopyalandı!').then(() => setTimeout(() => this.textContent='Kopyala', 2000))" style="
                            background: var(--primary-color, #1a73e8);
                            color: white;
                            border: none;
                            padding: 0.5rem 1rem;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 0.9rem;
                            transition: all 0.2s;
                        " onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
                            📋 Kopyala
                        </button>
                        <button onclick="window.translatePlugin.reverseTranslate('${translation.replace(/'/g, "\\'")}', '${to}', '${from}')" style="
                            background: var(--hover-background, #f5f5f5);
                            color: var(--text-color, #333);
                            border: 1px solid var(--border-color, #e0e0e0);
                            padding: 0.5rem 1rem;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 0.9rem;
                            transition: all 0.2s;
                        " onmouseover="this.style.background='var(--card-background, #fff)'" onmouseout="this.style.background='var(--hover-background, #f5f5f5)'">
                            🔄 Ters Çevir
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Sonucu ekle
        const resultsContainer = document.querySelector('.results, .search-results, main');
        if (resultsContainer) {
            resultsContainer.insertAdjacentHTML('afterbegin', resultHTML);
        } else {
            document.body.insertAdjacentHTML('beforeend', resultHTML);
        }
    }
    
    // Ters çeviri
    async function reverseTranslate(text, from, to) {
        const translation = await translateText(text, from, to);
        showTranslationResult(text, translation, from, to);
    }
    
    // Event listener'ları kur
    function setupEventListeners() {
        // Arama event'lerini dinle
        const searchInput = document.querySelector('input[type="search"], input[placeholder*="ara" i], input[placeholder*="search" i], .search-input');
        
        if (searchInput) {
            // Enter tuşu ile çeviri
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const value = e.target.value.trim();
                    if (value.startsWith('!tr ')) {
                        e.preventDefault();
                        const text = value.substring(4).trim();
                        if (text) {
                            translateText(text, 'en', 'tr').then(result => {
                                showTranslationResult(text, result, 'en', 'tr');
                            });
                        }
                    } else if (value.startsWith('!en ')) {
                        e.preventDefault();
                        const text = value.substring(4).trim();
                        if (text) {
                            translateText(text, 'tr', 'en').then(result => {
                                showTranslationResult(text, result, 'tr', 'en');
                            });
                        }
                    } else if (value.startsWith('!de ')) {
                        e.preventDefault();
                        const text = value.substring(4).trim();
                        if (text) {
                            translateText(text, 'en', 'de').then(result => {
                                showTranslationResult(text, result, 'en', 'de');
                            });
                        }
                    } else if (value.startsWith('!fr ')) {
                        e.preventDefault();
                        const text = value.substring(4).trim();
                        if (text) {
                            translateText(text, 'fr', 'tr').then(result => {
                                showTranslationResult(text, result, 'fr', 'tr');
                            });
                        }
                    } else if (value === '!tr') {
                        e.preventDefault();
                        showLanguageSelector('!tr', '');
                    }
                }
            });
        }
        
        // Klavye kısayolları
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                const input = document.querySelector('input[type="search"], input[placeholder*="ara" i], .search-input');
                if (input) {
                    input.value = '!tr ';
                    input.focus();
                    input.setSelectionRange(input.value.length, input.value.length);
                }
            } else if (e.ctrlKey && e.shiftKey && e.key === 'E') {
                e.preventDefault();
                const input = document.querySelector('input[type="search"], input[placeholder*="ara" i], .search-input');
                if (input) {
                    input.value = '!en ';
                    input.focus();
                    input.setSelectionRange(input.value.length, input.value.length);
                }
            }
        });
    }
    
    // Global fonksiyonlar
    window.translatePlugin = {
        selectLanguage,
        reverseTranslate,
        translateText,
        showLanguageSelector,
        isPluginEnabled
    };
    
    // CSS animasyonları
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        [data-translate-result] {
            animation: slideIn 0.5s ease-out;
        }
    `;
    document.head.appendChild(style);
    
    // Başlat
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupEventListeners);
    } else {
        setupEventListeners();
    }
    
    console.log('[Plugin] Advanced Translate loaded successfully');
})();
