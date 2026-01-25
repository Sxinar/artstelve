(function () {
    console.log("[Plugin] Advanced Translate initialized");
    
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
            // MyMemory Free API (5000 karakter/gün limit)
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`);
            const data = await response.json();
            
            if (data.responseStatus === 200 && data.responseData.translatedText) {
                return data.responseData.translatedText;
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
    const cacheKey = (text, from, to) => `${from}-${to}-${text}`;
    
    // Dil seçimi arayüzü
    function showLanguageSelector(query, originalText) {
        const languageOptions = Object.entries(supportedLanguages)
            .map(([code, lang]) => `
                <div class="lang-option" data-from="${code}" style="
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.8rem;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid transparent;
                " onmouseover="this.style.background='rgba(var(--primary-color-rgb), 0.1)'; this.style.borderColor='rgba(var(--primary-color-rgb), 0.3)'" 
                   onmouseout="this.style.background='transparent'; this.style.borderColor='transparent'">
                    <span style="font-size: 1.2rem;">${lang.flag}</span>
                    <span style="font-weight: 500;">${lang.name}</span>
                    <span style="margin-left: auto; opacity: 0.5; font-size: 0.8rem;">!${code} ${originalText}</span>
                </div>
            `).join('');
        
        return `
            <div style="padding: 1rem;">
                <div style="margin-bottom: 1rem; text-align: center;">
                    <h3 style="margin: 0; color: var(--primary-color); font-size: 1.2rem;">
                        🌍 Çeviri Dili Seçin
                    </h3>
                    <p style="margin: 0.5rem 0 0 0; opacity: 0.7; font-size: 0.9rem;">
                        "${originalText}" metnini hangi dile çevirmek istersiniz?
                    </p>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; max-height: 300px; overflow-y: auto;">
                    ${languageOptions}
                </div>
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color); text-align: center;">
                    <p style="margin: 0; font-size: 0.8rem; opacity: 0.5;">
                        💡 İpucu: Direkt komut kullanabilirsiniz: <code style="background: var(--hover-background); padding: 0.2rem 0.4rem; border-radius: 4px;">!tr hello</code>
                    </p>
                </div>
            </div>
        `;
    }
    
    window.addEventListener('artstelve_search', async (e) => {
        const query = (e.detail.query || "").trim();
        
        // !tr komutu kontrolü (dil seçimi modu)
        if (query === '!tr' || query === '!tr ') {
            const lastSearch = localStorage.getItem('lastSearchQuery') || '';
            if (lastSearch) {
                // Dil seçimi arayüzü göster
                e.detail.addSpecialResult({
                    id: 'language_selector',
                    type: 'plugin_result',
                    title: '🌍 Çeviri Dili Seçin',
                    content: showLanguageSelector(query, lastSearch),
                    icon: 'fas fa-language',
                    plugin: 'Advanced Translate'
                });
            } else {
                // Boş ise yardım göster
                e.detail.addSpecialResult({
                    id: 'translate_help',
                    type: 'plugin_result',
                    title: '🌍 Çeviri Yardımı',
                    content: `
                        <div style="padding: 1rem;">
                            <h4 style="margin: 0 0 1rem 0; color: var(--primary-color);">🚀 Hızlı Çeviri Komutları:</h4>
                            <div style="display: grid; gap: 0.5rem;">
                                <div style="padding: 0.5rem; background: var(--hover-background); border-radius: 6px;">
                                    <code style="color: var(--primary-color);">!tr hello</code> → İngilizce'den Türkçe'ye
                                </div>
                                <div style="padding: 0.5rem; background: var(--hover-background); border-radius: 6px;">
                                    <code style="color: var(--primary-color);">!en merhaba</code> → Türkçe'den İngilizce'ye
                                </div>
                                <div style="padding: 0.5rem; background: var(--hover-background); border-radius: 6px;">
                                    <code style="color: var(--primary-color);">!de hello</code> → İngilizce'den Almanca'ya
                                </div>
                                <div style="padding: 0.5rem; background: var(--hover-background); border-radius: 6px;">
                                    <code style="color: var(--primary-color);">!fr bonjour</code> → Fransızca'dan Türkçe'ye
                                </div>
                            </div>
                            <div style="margin-top: 1rem; padding: 0.5rem; background: rgba(var(--primary-color-rgb), 0.1); border-radius: 6px; text-align: center;">
                                <p style="margin: 0; font-size: 0.9rem; opacity: 0.8;">
                                    🎯 <strong>12 dil</strong> desteği ile çeviri yapın!
                                </p>
                            </div>
                        </div>
                    `,
                    icon: 'fas fa-language',
                    plugin: 'Advanced Translate'
                });
            }
            return;
        }
        
        // Genel dil komutları (!tr, !en, !de, !fr, vb.)
        const langMatch = query.match(/^!(\w{2})\s+(.+)$/);
        if (langMatch) {
            const [, targetLang, textToTranslate] = langMatch;
            
            if (!supportedLanguages[targetLang]) {
                // Desteklenmeyen dil
                e.detail.addSpecialResult({
                    id: 'unsupported_lang',
                    type: 'plugin_result',
                    title: '❌ Desteklenmeyen Dil',
                    content: `
                        <div style="padding: 1rem; text-align: center;">
                            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🌍</div>
                            <p style="margin: 0; opacity: 0.7;">"${targetLang}" dili desteklenmiyor</p>
                            <p style="margin: 0.5rem 0 0 0; font-size: 0.8rem; opacity: 0.5;">
                                Desteklenen diller: ${Object.keys(supportedLanguages).join(', ')}
                            </p>
                        </div>
                    `,
                    icon: 'fas fa-language',
                    plugin: 'Advanced Translate'
                });
                return;
            }
            
            if (!textToTranslate) return;
            
            // Son aramayı kaydet
            localStorage.setItem('lastSearchQuery', textToTranslate);
            
            // Kaynak dili otomatik tespit (basit)
            const sourceLang = targetLang === 'tr' ? 'en' : 'tr';
            
            // Cache kontrolü
            const cached = translationCache.get(cacheKey(textToTranslate, sourceLang, targetLang));
            if (cached) {
                showTranslationResult(e, textToTranslate, cached, true, sourceLang, targetLang);
                return;
            }
            
            // Loading göster
            e.detail.addSpecialResult({
                id: 'translate_loading',
                type: 'plugin_result',
                title: '🌍 Çeviri Yapılıyor...',
                content: `
                    <div style="padding: 1.5rem; text-align: center; background: linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.05), rgba(var(--primary-color-rgb), 0.02)); border-radius: 12px; border: 1px solid rgba(var(--primary-color-rgb), 0.1);">
                        <div style="font-size: 2.5rem; margin-bottom: 1rem; animation: pulse 1.5s infinite;">⏳</div>
                        <div style="font-size: 1.1rem; margin-bottom: 0.5rem; font-weight: 500;">
                            "${textToTranslate}"
                        </div>
                        <div style="opacity: 0.7; font-size: 0.9rem;">
                            ${supportedLanguages[sourceLang].flag} ${supportedLanguages[sourceLang].name} → ${supportedLanguages[targetLang].flag} ${supportedLanguages[targetLang].name}
                        </div>
                        <div style="margin-top: 1rem; font-size: 0.8rem; opacity: 0.5;">
                            ⚡ API üzerinden çeviri yapılıyor...
                        </div>
                    </div>
                    <style>
                        @keyframes pulse {
                            0%, 100% { transform: scale(1); opacity: 1; }
                            50% { transform: scale(1.1); opacity: 0.8; }
                        }
                    </style>
                `,
                icon: 'fas fa-language',
                plugin: 'Advanced Translate'
            });
            
            // API'den çeviri al
            const translation = await translateText(textToTranslate, sourceLang, targetLang);
            
            // Cache'e kaydet
            translationCache.set(cacheKey(textToTranslate, sourceLang, targetLang), translation);
            
            // Sonucu göster
            setTimeout(() => {
                showTranslationResult(e, textToTranslate, translation || `${textToTranslate} (çeviri başarısız)`, !!translation, sourceLang, targetLang);
            }, 800);
        }
        
        // Eski trigger'ları da destekle (geriye uyumluluk)
        else if (query.includes(' çevir') || query.includes(' translate ')) {
            const word = query.replace(' çevir', '').replace('translate', '').trim();
            if (!word) return;

            e.detail.addSpecialResult({
                id: 'translate_result_old',
                type: 'plugin_result',
                title: '🔄 Çeviri (Eski Yöntem)',
                content: `
                    <div style="padding: 1rem; opacity: 0.8;">
                        <div style="font-size: 0.8rem; color: var(--warning-color); margin-bottom: 0.5rem;">
                            💡 Yeni yöntem: "!tr ${word}" veya dil kodu ile "!de ${word}" yazın
                        </div>
                        <div style="opacity: 0.6; font-size: 0.8rem;">API destekli çoklu dil çevirisi</div>
                        <div style="font-size: 0.9rem; margin-top: 0.3rem;">⚡ 12 dil desteği</div>
                    </div>
                `,
                icon: 'fas fa-language',
                plugin: 'Quick Translate'
            });
        }
    });
    
    // Çeviri sonucunu gösteren fonksiyon
    function showTranslationResult(e, original, translation, success, from = 'en', to = 'tr') {
        const fromLang = supportedLanguages[from];
        const toLang = supportedLanguages[to];
        
        if (!fromLang || !toLang) return;
        
        // Önceki çeviri sonuçlarını temizle
        const existingResults = document.querySelectorAll('[id^="translate_result"], [id="translate_loading"], [id="language_selector"], [id="translate_help"], [id="unsupported_lang"], [id="translate_result_old"]');
        existingResults.forEach(el => {
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
        
        // Unique ID oluştur
        const uniqueId = `translate_result_${from}_${to}_${Date.now()}`;
        
        e.detail.addSpecialResult({
            id: uniqueId,
            type: 'plugin_result',
            title: '🌍 API Çeviri',
            content: `
                <div style="padding: 1.5rem; background: linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.05), rgba(var(--primary-color-rgb), 0.02)); border-radius: 16px; border: 1px solid rgba(var(--primary-color-rgb), 0.1); position: relative; overflow: hidden;">
                    <div style="position: absolute; top: 0; right: 0; background: rgba(var(--primary-color-rgb), 0.1); padding: 0.3rem 0.8rem; border-bottom-left-radius: 8px; font-size: 0.7rem; opacity: 0.7;">
                        ⚡ API
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.2rem;">
                        <span style="font-size: 1.5rem;">${fromLang.flag}</span>
                        <span style="font-size: 1rem; opacity: 0.7; font-weight: 500;">${fromLang.name}</span>
                        <div style="flex: 1; display: flex; align-items: center; justify-content: center;">
                            <div style="width: 30px; height: 2px; background: var(--primary-color); border-radius: 1px;"></div>
                            <div style="margin: 0 0.5rem; color: var(--primary-color); font-size: 1.2rem;">→</div>
                            <div style="width: 30px; height: 2px; background: var(--primary-color); border-radius: 1px;"></div>
                        </div>
                        <span style="font-size: 1.5rem;">${toLang.flag}</span>
                        <span style="font-size: 1rem; opacity: 0.7; font-weight: 500;">${toLang.name}</span>
                    </div>
                    
                    <div style="background: rgba(255, 255, 255, 0.05); padding: 1rem; border-radius: 12px; margin-bottom: 1rem; border: 1px solid rgba(255, 255, 255, 0.1);">
                        <div style="font-size: 0.8rem; opacity: 0.6; margin-bottom: 0.3rem;">Orijinal Metin</div>
                        <div style="font-size: 1.2rem; font-weight: 600; color: var(--text-color); line-height: 1.4;">
                            "${original}"
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin: 1rem 0;">
                        <div style="display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; background: var(--primary-color); color: white; border-radius: 50%; font-size: 1.2rem; margin-bottom: 0.5rem;">
                            ↓
                        </div>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.15), rgba(var(--primary-color-rgb), 0.05)); padding: 1.2rem; border-radius: 12px; border: 1px solid rgba(var(--primary-color-rgb), 0.2); position: relative;">
                        <div style="font-size: 0.8rem; opacity: 0.6; margin-bottom: 0.3rem; color: var(--primary-color);">Çeviri Sonucu</div>
                        <div style="font-size: 1.4rem; font-weight: 700; color: var(--primary-color); line-height: 1.4;">
                            "${translation}"
                        </div>
                        ${success ? 
                            `<div style="position: absolute; top: 0.5rem; right: 0.5rem; background: var(--success-color); color: white; padding: 0.2rem 0.5rem; border-radius: 12px; font-size: 0.6rem; font-weight: 600;">✅ BAŞARILI</div>` : 
                            `<div style="position: absolute; top: 0.5rem; right: 0.5rem; background: var(--danger-color); color: white; padding: 0.2rem 0.5rem; border-radius: 12px; font-size: 0.6rem; font-weight: 600;">❌ HATALI</div>`
                        }
                    </div>
                    
                    <div style="margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: center;">
                        <button onclick="navigator.clipboard.writeText('${translation}')" style="
                            background: var(--primary-color);
                            color: white;
                            border: none;
                            padding: 0.5rem 1rem;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 0.8rem;
                            display: flex;
                            align-items: center;
                            gap: 0.3rem;
                        " onmouseover="this.style.background='var(--primary-color-light)'" onmouseout="this.style.background='var(--primary-color)'">
                            📋 Kopyala
                        </button>
                        <button onclick="navigator.clipboard.writeText('!${to} ${translation}')" style="
                            background: var(--hover-background);
                            color: var(--text-color);
                            border: 1px solid var(--border-color);
                            padding: 0.5rem 1rem;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 0.8rem;
                            display: flex;
                            align-items: center;
                            gap: 0.3rem;
                        " onmouseover="this.style.background='rgba(var(--primary-color-rgb), 0.1)'" onmouseout="this.style.background='var(--hover-background)'">
                            🔄 Ters Çevir
                        </button>
                    </div>
                </div>
            `,
            icon: 'fas fa-language',
            plugin: 'Advanced Translate'
        });
        
        // Auto-suggestion'a ekle
        if (success) {
            e.detail.addSuggestion({
                text: `!${to} ${translation}`,
                description: `${toLang.name} çeviri: ${translation}`,
                icon: 'fas fa-arrow-right'
            });
        }
    }
    
    // Klavye kısayolları
    document.addEventListener('keydown', (e) => {
        const searchInput = document.querySelector('.search-input, .search-input-header');
        if (!searchInput) return;
        
        // Ctrl+Shift+T ile Türkçe çeviri
        if (e.ctrlKey && e.shiftKey && e.key === 'T') {
            const currentValue = searchInput.value.trim();
            searchInput.value = currentValue ? `!tr ${currentValue}` : '!tr';
            searchInput.focus();
            searchInput.dispatchEvent(new Event('input'));
        }
        
        // Ctrl+Shift+E ile İngilizce çeviri
        if (e.ctrlKey && e.shiftKey && e.key === 'E') {
            const currentValue = searchInput.value.trim();
            searchInput.value = currentValue ? `!en ${currentValue}` : '!en';
            searchInput.focus();
            searchInput.dispatchEvent(new Event('input'));
        }
    });
})();
