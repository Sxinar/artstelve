<script lang="js">
    import { page } from "$app/stores";
    import { getContext, onMount } from "svelte";
    import { writable } from "svelte/store";
    import { goto } from "$app/navigation";
    import { browser } from "$app/environment";
    import { t } from "$lib/i18n.js";
    import { fade, slide, fly } from "svelte/transition";

    // --- Debug Mode ---
    const DEBUG = false;
    function debugLog(message, data = null) {
        if (DEBUG) {
            console.log(`[Settings Debug] ${message}`, data);
        }
    }

    // --- Import Stores ---
    import {
        selectedTheme,
        customLogo,
        customCssStore,
        aiSummaryEnabled,
        isSidebarOpen,
        selectedLanguage,
        selectedEngine,
        hybridProxyBaseUrl,
        hybridProxyEngines,
        hybridProxyLimitPerEngine,
        hybridProxyLimitTotal,
        hybridProxyTimeoutMs,
        hybridProxyCache,
        enableSuggestions,
        enableSpellCorrection,
        enableWikiCard,
        enableRelatedNews,
        enableRelatedSearches,
        enableTranslatePlugin,
        themeMode,
        uiDensity,
        fontScale,
        cornerRadius,
        accentColor,
        safeSearch,
        searchRegion,
        searchHomeDesign,
        blockedSites,
        showNavbarSubCategory,
        bangsOpenNewTab,
        customBangs,
    } from "$lib/stores.js";

    let notifications = false;
    let activeTab = $state("Temel Ayarlar");
    let backupSelection = $state({
        theme: true,
        search: true,
        proxy: true,
        features: true,
        bangs: true,
        customCss: true,
        blockedSites: true,
        advanced: true,
    });

    let proxyLatency = null;
    let isTestingProxy = false;

    async function pingProxy() {
        if (!browser) return;
        isTestingProxy = true;
        const start = performance.now();
        try {
            // Use a simple HEAD request to check latency
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            await fetch($hybridProxyBaseUrl, {
                method: "HEAD",
                mode: "no-cors",
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            proxyLatency = Math.round(performance.now() - start);
        } catch (e) {
            console.error("Proxy ping failed:", e);
            proxyLatency = "Hata";
        } finally {
            isTestingProxy = false;
        }
    }

    const tabs = [
        {
            id: "Temel Ayarlar",
            icon: "fas fa-sliders-h",
            label: "basicSettings",
        },
        { id: "Görünüm", icon: "fas fa-paint-brush", label: "appearance" },
        {
            id: "Hybrid Proxy",
            icon: "fas fa-network-wired",
            label: "Artado Proxy",
        },
        { id: "Bangs", icon: "fas fa-bolt", label: "Bangs" },
        { id: "Gelişmiş", icon: "fas fa-tools", label: "advanced" },
        { id: "Özel CSS", icon: "fas fa-code", label: "customCSS" },
    ];

    const filteredTabs = tabs;

    // --- Helper Functions ---
    function applyPresetCSS(preset) {
        const presets = {
            modernClean: `
/* Modern Yuvarlak - Tüm sayfalarda yuvarlak köşeler, yumuşak gölgeler, inter font */
html, body, * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
body { background: var(--background-color); }
.result-item-card, .setting-card, .infobox-card, .widget-card, .calculator-box, .location-box { border: none; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); background: var(--card-background); transition: transform 0.2s ease, box-shadow 0.2s ease; }
.result-item-card:hover, .setting-card:hover, .widget-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
.search-box, .search-input, .search-bar-container { border-radius: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); border: none; }
button, .btn, .search-button-header, .settings-button-header { border-radius: 12px; font-weight: 500; transition: all 0.2s ease; }
.sidebar { border-radius: 0 16px 16px 0; box-shadow: 4px 0 16px rgba(0,0,0,0.08); }
input, select, textarea { border-radius: 10px; font-family: inherit; }`,
            softShadows: `
/* Derin Gölgeler - Tüm sayfalarda derinlik hissi veren katmanlı gölgeler, georgia font */
html, body, * { font-family: Georgia, 'Times New Roman', serif; }
body { background: var(--background-color); }
.result-item-card, .setting-card, .infobox-card, .widget-card { border-radius: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); background: var(--card-background); border: none; }
.search-box, .search-bar-container { box-shadow: 0 12px 40px rgba(0,0,0,0.15); border-radius: 28px; border: none; }
button, .btn { box-shadow: 0 4px 16px rgba(0,0,0,0.1); transition: box-shadow 0.2s ease; }
button:hover, .btn:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
.sidebar { box-shadow: 8px 0 32px rgba(0,0,0,0.1); }
input, select, textarea { box-shadow: inset 0 2px 8px rgba(0,0,0,0.05); border-radius: 12px; }`,
            darkModern: `
/* Koyu Modern - Tüm sayfalarda koyu arka plan, yüksek kontrast, jetbrains mono font */
html, body, * { font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace; }
:root { --background-color: #0a0a0f; --card-background: #12121a; --text-color: #e8e8e8; --text-color-secondary: #a0a0a0; --border-color: #22222e; --input-background: #1a1a24; --hover-background: #1e1e2a; }
body { background: #0a0a0f; color: #e8e8e8; }
.result-item-card, .setting-card, .infobox-card, .widget-card { background: #12121a; border: 1px solid #22222e; border-radius: 12px; }
.search-box, .search-bar-container, input, select, textarea { background: #1a1a24; border: 1px solid #22222e; color: #e8e8e8; border-radius: 10px; }
button, .btn { background: #1a1a24; border: 1px solid #22222e; color: #e8e8e8; border-radius: 8px; }
.sidebar { background: #12121a; border-right: 1px solid #22222e; }
a { color: #66b3ff; }
a:hover { color: #99ccff; }`,
            minimalElegant: `
/* Minimal Şık - Tüm sayfalarda ince çizgiler, küçük yuvarlak köşeler, system-ui font */
html, body, * { font-family: system-ui, -apple-system, sans-serif; }
body { background: var(--background-color); }
.result-item-card, .setting-card, .infobox-card, .widget-card { border: none; border-radius: 8px; background: var(--card-background); box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
.search-box, .search-bar-container { border-radius: 12px; border: 1px solid var(--border-color); background: var(--input-background); }
button, .btn { border-radius: 8px; font-weight: 500; border: 1px solid var(--border-color); }
.sidebar { border-right: 1px solid var(--border-color); }
input, select, textarea { border-radius: 6px; border: 1px solid var(--border-color); }
h1, h2, h3, h4 { font-weight: 600; letter-spacing: -0.01em; }`,
            glassModern: `
/* Cam Efekt - Tüm sayfalarda arka planı gösteren buzlu cam görünüm, poppins font */
html, body, * { font-family: 'Poppins', -apple-system, sans-serif; }
body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); background-attachment: fixed; }
.result-item-card, .setting-card, .infobox-card, .widget-card { background: rgba(255,255,255,0.7); backdrop-filter: blur(20px); border-radius: 16px; border: 1px solid rgba(255,255,255,0.3); box-shadow: 0 8px 32px rgba(0,0,0,0.1); }
.search-box, .search-bar-container { background: rgba(255,255,255,0.8); backdrop-filter: blur(10px); border-radius: 24px; border: 1px solid rgba(255,255,255,0.3); }
button, .btn { background: rgba(255,255,255,0.7); backdrop-filter: blur(10px); border-radius: 12px; border: 1px solid rgba(255,255,255,0.3); }
.sidebar { background: rgba(255,255,255,0.7); backdrop-filter: blur(20px); border-right: 1px solid rgba(255,255,255,0.2); }
input, select, textarea { background: rgba(255,255,255,0.6); backdrop-filter: blur(10px); border-radius: 10px; }`,
            colorful: `
/* Canlı Renkler - Tüm sayfalarda mor-mavi renk geçişleri, nunito font */
html, body, * { font-family: 'Nunito', -apple-system, sans-serif; }
body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); background-attachment: fixed; }
.result-item-card, .setting-card, .infobox-card, .widget-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 20px; border: none; color: white; }
.result-item-card *, .setting-card *, .infobox-card *, .widget-card * { color: white !important; }
.search-box, .search-bar-container { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 24px; color: white; border: none; }
button, .btn { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 12px; color: white; border: none; }
.sidebar { background: linear-gradient(180deg, #667eea 0%, #764ba2 100%); }
input, select, textarea { background: rgba(255,255,255,0.2); color: white; border-radius: 10px; border: none; }`,
            neumorphic: `
/* Yumuşak Derinlik - Tüm sayfalarda dışarı çıkık / içeri çökük efekt, segoe ui font */
html, body, * { font-family: 'Segoe UI', Tahoma, Geneva, sans-serif; }
body { background: #e0e5ec; }
.result-item-card, .setting-card, .infobox-card, .widget-card { background: #e0e5ec; border-radius: 20px; box-shadow: 8px 8px 16px rgba(163,177,198,0.6), -8px -8px 16px rgba(255,255,255,0.5); border: none; }
.search-box, .search-bar-container { background: #e0e5ec; border-radius: 24px; box-shadow: inset 4px 4px 8px rgba(163,177,198,0.6), inset -4px -4px 8px rgba(255,255,255,0.5); border: none; }
button, .btn { background: #e0e5ec; border-radius: 12px; box-shadow: 4px 4px 8px rgba(163,177,198,0.6), -4px -4px 8px rgba(255,255,255,0.5); border: none; color: #4a5568; }
.sidebar { background: #e0e5ec; box-shadow: 5px 0 15px rgba(163,177,198,0.5); }
input, select, textarea { background: #e0e5ec; box-shadow: inset 2px 2px 5px rgba(163,177,198,0.6), inset -2px -2px 5px rgba(255,255,255,0.5); border-radius: 10px; border: none; }`,
            retro80s: `
/* Retro 80'ler - Tüm sayfalarda parlak neon renkler, retro hissi, press start 2p font */
html, body, * { font-family: 'Press Start 2P', cursive, monospace; font-size: 0.95em; }
body { background: linear-gradient(45deg, #2d1b4e 0%, #1a0b2e 100%); }
.result-item-card, .setting-card, .infobox-card, .widget-card { background: linear-gradient(45deg, #ff6b6b, #feca57); border: 3px solid #fff; border-radius: 0; box-shadow: 0 0 20px rgba(255,107,107,0.5); }
.search-box, .search-bar-container { background: linear-gradient(90deg, #ff6b6b, #feca57); border: 3px solid #fff; border-radius: 0; box-shadow: 0 0 15px rgba(255,107,107,0.5); }
button, .btn { background: #48dbfb; border: 3px solid #fff; border-radius: 0; box-shadow: 0 0 10px rgba(72,219,251,0.5); color: #000; }
.sidebar { background: linear-gradient(180deg, #ff6b6b, #48dbfb); border-right: 3px solid #fff; }
input, select, textarea { background: #ff9ff3; border: 3px solid #fff; border-radius: 0; color: #000; }
a { color: #feca57; text-decoration: underline; }`,
            cyberNeon: `
/* Neon Işıklar - Tüm sayfalarda parlak yeşil neon ışıklar, koyu arka plan, orbitron font */
html, body, * { font-family: 'Orbitron', 'Courier New', monospace; }
:root { --background-color: #050505; --card-background: #0a0a0a; --text-color: #00ff41; --text-color-secondary: #00cc33; --border-color: #00ff41; --input-background: #0a0a0a; --hover-background: #111111; }
body { background: #050505; color: #00ff41; }
.result-item-card, .setting-card, .infobox-card, .widget-card { background: #0a0a0a; border: 2px solid #00ff41; border-radius: 0; box-shadow: 0 0 10px #00ff41, inset 0 0 10px rgba(0,255,65,0.1); }
.result-item-card:hover, .setting-card:hover { box-shadow: 0 0 20px #00ff41, inset 0 0 20px rgba(0,255,65,0.2); }
.search-box, .search-bar-container { background: #0a0a0a; border: 2px solid #00ff41; box-shadow: 0 0 15px #00ff41; color: #00ff41; border-radius: 0; }
button, .btn { background: #0a0a0a; border: 2px solid #00ff41; color: #00ff41; box-shadow: 0 0 10px #00ff41; border-radius: 0; }
.sidebar { background: #0a0a0a; border-right: 2px solid #00ff41; box-shadow: 0 0 10px #00ff41; }
input, select, textarea { background: #0a0a0a; border: 2px solid #00ff41; color: #00ff41; border-radius: 0; }
a { color: #00ff41; text-shadow: 0 0 5px #00ff41; }`,
            glitch: `
/* Dijital Bozulma - Tüm sayfalarda renkli glitch kayma efekti, vt323 font */
html, body, * { font-family: 'VT323', 'Courier New', monospace; font-size: 1.05em; }
body { background: #000; color: #0f0; }
.result-item-card, .setting-card, .infobox-card, .widget-card { background: #0f0; color: #000; border: 3px solid #f0f; border-radius: 0; box-shadow: 5px 5px 0 #f0f, -5px -5px 0 #0ff; animation: glitchMove 0.3s infinite; }
@keyframes glitchMove { 0% { transform: translate(0); } 20% { transform: translate(-2px, 2px); } 40% { transform: translate(-2px, -2px); } 60% { transform: translate(2px, 2px); } 80% { transform: translate(2px, -2px); } 100% { transform: translate(0); } }
.search-box, .search-bar-container { background: #0f0; border: 3px solid #f0f; color: #000; box-shadow: 3px 3px 0 #f0f, -3px -3px 0 #0ff; border-radius: 0; }
button, .btn { background: #0ff; border: 3px solid #f0f; color: #000; box-shadow: 2px 2px 0 #f0f; border-radius: 0; }
.sidebar { background: #0f0; border-right: 3px solid #f0f; }
input, select, textarea { background: #f0f; border: 3px solid #0f0; color: #000; border-radius: 0; }
h1, h2, h3 { text-shadow: 2px 2px 0 #f0f; }
a { color: #0ff; text-decoration: underline wavy #f0f; }`,
        };
        if (presets[preset]) applyCustomCss(presets[preset]);
    }

    function applySidebarTheme(theme) {
        // Logic for sidebar themes could be implemented via direct store if supported,
        // or injecting CSS (legacy). For now, we'll use a simplified version or skip if strict.
        // Keeping legacy logic for compatibility if used elsewhere.
        const themes = {
            default: "",
            gradient: `.sidebar-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important; }`,
            glass: `.sidebar { background: rgba(255,255,255,0.1) !important; backdrop-filter: blur(20px) !important; border-left: 1px solid rgba(255,255,255,0.2) !important; }`,
        };
        let styleElement = document.getElementById("sidebar-theme-css");
        if (!styleElement) {
            styleElement = document.createElement("style");
            styleElement.id = "sidebar-theme-css";
            document.head.appendChild(styleElement);
        }
        styleElement.textContent = themes[theme] || "";
    }

    function applyCustomCss(css) {
        customCssStore.set(css);
    }

    // --- Backup & Restore System ---
    function backupSettings() {
        const settings = {};
        if (backupSelection.theme) {
            settings.selectedTheme = $selectedTheme;
            settings.themeMode = $themeMode;
            settings.uiDensity = $uiDensity;
            settings.fontScale = $fontScale;
            settings.cornerRadius = $cornerRadius;
            settings.accentColor = $accentColor;
            settings.searchHomeDesign = $searchHomeDesign;
            settings.showNavbarSubCategory = $showNavbarSubCategory;
        }
        if (backupSelection.search) {
            settings.selectedLanguage = $selectedLanguage;
            settings.selectedEngine = $selectedEngine;
            settings.safeSearch = $safeSearch;
            settings.searchRegion = $searchRegion;
        }
        if (backupSelection.proxy) {
            settings.hybridProxyBaseUrl = $hybridProxyBaseUrl;
            settings.hybridProxyEngines = $hybridProxyEngines;
            settings.hybridProxyLimitPerEngine = $hybridProxyLimitPerEngine;
            settings.hybridProxyLimitTotal = $hybridProxyLimitTotal;
            settings.hybridProxyTimeoutMs = $hybridProxyTimeoutMs;
            settings.hybridProxyCache = $hybridProxyCache;
        }
        if (backupSelection.features) {
            settings.enableSuggestions = $enableSuggestions;
            settings.enableSpellCorrection = $enableSpellCorrection;
            settings.enableWikiCard = $enableWikiCard;
            settings.enableRelatedNews = $enableRelatedNews;
            settings.enableRelatedSearches = $enableRelatedSearches;
        }
        if (backupSelection.bangs) {
            settings.bangsOpenNewTab = $bangsOpenNewTab;
            settings.customBangs = $customBangs;
        }
        if (backupSelection.customCss) {
            settings.customCss = $customCssStore;
        }
        if (backupSelection.blockedSites) {
            settings.blockedSites = $blockedSites;
        }
        if (backupSelection.advanced) {
            settings.notifications = notifications;
        }
        const blob = new Blob([JSON.stringify(settings, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `artado_search_settings_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function resetCustomLogo() {
        customLogo.set("/logo.png");
    }

    // This ensures local storage values are locked in once chosen.
    // Manual selection in Settings should override everything on refresh.

    function restoreSettings(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const settings = JSON.parse(e.target.result);
                if (settings.selectedTheme)
                    selectedTheme.set(settings.selectedTheme);
                if (settings.customCss !== undefined)
                    customCssStore.set(settings.customCss);
                if (settings.aiSummaryEnabled !== undefined)
                    aiSummaryEnabled.set(settings.aiSummaryEnabled);
                if (settings.selectedLanguage)
                    selectedLanguage.set(settings.selectedLanguage);
                if (settings.selectedEngine)
                    selectedEngine.set(settings.selectedEngine);
                if (settings.hybridProxyBaseUrl)
                    hybridProxyBaseUrl.set(settings.hybridProxyBaseUrl);
                if (settings.hybridProxyEngines)
                    hybridProxyEngines.set(settings.hybridProxyEngines);
                if (settings.hybridProxyLimitPerEngine)
                    hybridProxyLimitPerEngine.set(
                        settings.hybridProxyLimitPerEngine,
                    );
                if (settings.hybridProxyLimitTotal)
                    hybridProxyLimitTotal.set(settings.hybridProxyLimitTotal);
                if (settings.hybridProxyTimeoutMs)
                    hybridProxyTimeoutMs.set(settings.hybridProxyTimeoutMs);
                if (settings.hybridProxyCache !== undefined)
                    hybridProxyCache.set(settings.hybridProxyCache);
                if (settings.enableSuggestions !== undefined)
                    enableSuggestions.set(settings.enableSuggestions);
                if (settings.enableSpellCorrection !== undefined)
                    enableSpellCorrection.set(settings.enableSpellCorrection);
                if (settings.enableWikiCard !== undefined)
                    enableWikiCard.set(settings.enableWikiCard);
                if (settings.enableRelatedNews !== undefined)
                    enableRelatedNews.set(settings.enableRelatedNews);
                if (settings.enableRelatedSearches !== undefined)
                    enableRelatedSearches.set(settings.enableRelatedSearches);
                if (settings.themeMode) themeMode.set(settings.themeMode);
                if (settings.uiDensity) uiDensity.set(settings.uiDensity);
                if (settings.fontScale) fontScale.set(settings.fontScale);
                if (settings.cornerRadius)
                    cornerRadius.set(settings.cornerRadius);
                if (settings.accentColor) accentColor.set(settings.accentColor);
                if (settings.safeSearch !== undefined)
                    safeSearch.set(settings.safeSearch);
                if (settings.blockedSites)
                    blockedSites.set(settings.blockedSites);
                if (settings.searchHomeDesign)
                    searchHomeDesign.set(settings.searchHomeDesign);
                if (settings.showNavbarSubCategory !== undefined)
                    showNavbarSubCategory.set(settings.showNavbarSubCategory);
                if (settings.showNavbarSearch !== undefined)
                    showNavbarSearch.set(settings.showNavbarSearch);
                if (settings.searchHomeCustomTheme)
                    searchHomeCustomTheme.set(settings.searchHomeCustomTheme);
                if (settings.bangsOpenNewTab !== undefined)
                    bangsOpenNewTab.set(settings.bangsOpenNewTab);
                if (settings.customBangs !== undefined)
                    customBangs.set(settings.customBangs);

                alert("Ayarlar başarıyla geri yüklendi!");
                location.reload(); // Reload to ensure full application
            } catch (err) {
                alert("Dosya okunurken hata oluştu: " + err.message);
            }
        };
        reader.readAsText(file);
    }

    function removeBlockedSite(site) {
        blockedSites.update((sites) => sites.filter((s) => s !== site));
    }

    // --- Workshop Items (Legacy but kept) ---
    let themes = writable([]);
    let plugins = writable([]);
    let logos = writable([]);
    let homeThemes = writable([]);
    let workshopError = writable(null);
    let isLoadingWorkshop = writable(true);
    let installingId = null;

    async function fetchWorkshopItems() {
        debugLog("fetchWorkshopItems started");
        isLoadingWorkshop.set(true);
        try {
            // Fetch themes (which now contains logos only)
            const themesResponse = await fetch("/api/workshop/themes");
            debugLog("Workshop Themes API response", {
                status: themesResponse.status,
                ok: themesResponse.ok,
            });

            // Fetch items (which returns empty since disabled)
            const itemsResponse = await fetch("/api/workshop/items");
            debugLog("Workshop Items API response", {
                status: itemsResponse.status,
                ok: itemsResponse.ok,
            });

            if (themesResponse.ok && itemsResponse.ok) {
                const themesData = await themesResponse.json();
                const itemsData = await itemsResponse.json();

                debugLog("Workshop data received", {
                    themesCount: themesData.themes?.length,
                    itemsSuccess: itemsData.success,
                });

                // Set themes (empty since we disabled themes)
                themes.set([]);

                // Set logos from themes API
                logos.set(themesData.themes || []);

                // Set plugins and home themes (empty since disabled)
                plugins.set([]);
                homeThemes.set([]);

                workshopError.set(null);
                debugLog("Workshop items processed", {
                    logos: themesData.themes?.length,
                });
            } else {
                workshopError.set(
                    data.error || "Workshop devre dışı bırakıldı.",
                );
                debugLog("Workshop API error", data.error);
            }
        } catch (err) {
            console.error(err);
            workshopError.set("Bağlantı hatası: " + err.message);
            debugLog("Workshop fetch error", err.message);
        } finally {
            isLoadingWorkshop.set(false);
            debugLog("fetchWorkshopItems completed");
        }
    }

    async function applyWorkshopItem(item, type) {
        if (!item.download_url) return;

        if (type === "theme") {
            if (item.category === "home") {
                searchHomeDesign.set(item.download_url);
                alert("Özel ana sayfa teması anında uygulandı!");
            } else {
                selectedTheme.set(item.download_url);
                alert("Site teması anında uygulandı!");
            }
        } else if (type === "plugin") {
            // Store active workshop plugins in localStorage
            const activePlugins = JSON.parse(
                localStorage.getItem("activeWorkshopPlugins") || "[]",
            );
            if (!activePlugins.find((p) => p.id === item.id)) {
                activePlugins.push({
                    id: item.id,
                    name: item.name,
                    url: item.download_url,
                    category: item.category,
                });
                localStorage.setItem(
                    "activeWorkshopPlugins",
                    JSON.stringify(activePlugins),
                );
            }
            alert(
                "Eklenti buluttan uygulandı! Bir sonraki aramanızda etkinleşecek.",
            );
        } else if (type === "logo") {
            // Apply logo to customLogo store
            customLogo.set(item.download_url);
            alert("Logo anında uygulandı!");
        }
    }

    // Since we're not downloading files anymore, we'll use direct workshop URLs
    // Install function now just applies the item directly
    async function installItem(item, type) {
        if (installingId) return;
        installingId = item.id;
        try {
            await applyWorkshopItem(item, type);
        } catch (e) {
            alert("Hata: " + e.message);
        } finally {
            installingId = null;
        }
    }

    onMount(() => {
        debugLog("Settings page mounted", { browser, activeTab });
        if (browser) {
            debugLog("Fetching workshop items");
            fetchWorkshopItems();
            debugLog("Fetching installed themes");
            fetchInstalledThemes();
            debugLog("Fetching installed plugins");
            fetchInstalledPlugins();
            document.body.classList.add("settings-active");
            debugLog("Settings page initialized successfully");
            return () => {
                debugLog("Settings page cleanup");
                document.body.classList.remove("settings-active");
            };
        }
    });

    let installedGeneralThemes = [];
    let installedHomeThemes = [];
    async function fetchInstalledThemes() {
        try {
            const res = await fetch("/api/workshop/themes");
            if (res.ok) {
                const data = await res.json();
                const all = data.themes || [];
                installedGeneralThemes = all.filter(
                    (t) => t.category !== "home",
                );
                installedHomeThemes = all.filter((t) => t.category === "home");
            }
        } catch (e) {
            console.error("Failed to fetch installed themes:", e);
        }
    }
    // Since we're not downloading files anymore, uninstall removes from active items
    async function uninstallItem(id, type) {
        if (
            !confirm(
                "Bu " +
                    (type === "theme" ? "temayı" : "eklentiyi") +
                    " devre dışı bırakmak istediğinize emin misiniz?",
            )
        )
            return;

        try {
            if (type === "theme") {
                // If the theme being disabled is currently selected, reset to default
                if ($selectedTheme === id) {
                    selectedTheme.set("klasik");
                }
                if ($searchHomeDesign === id) {
                    searchHomeDesign.set("klasik");
                }
            } else if (type === "plugin") {
                // Remove from active workshop plugins
                const activePlugins = JSON.parse(
                    localStorage.getItem("activeWorkshopPlugins") || "[]",
                );
                const filteredPlugins = activePlugins.filter(
                    (p) => p.id !== id,
                );
                localStorage.setItem(
                    "activeWorkshopPlugins",
                    JSON.stringify(filteredPlugins),
                );
            }

            alert("Başarıyla devre dışı bırakıldı.");
        } catch (e) {
            alert("Hata: " + e.message);
        }
    }

    let installedPluginsList = [];
    async function fetchInstalledPlugins() {
        try {
            const res = await fetch("/api/workshop/plugins");
            if (res.ok) {
                const data = await res.json();
                installedPluginsList = data.plugins || [];
            }
        } catch (e) {
            console.error("Failed to fetch installed plugins:", e);
        }
    }

    function formatThemeName(kebabCaseName) {
        if (!kebabCaseName) return "";
        return kebabCaseName
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
    }

    function saveDefaultEngine() {
        // The selectedEngine store is already persistent, so it's automatically saved
        alert(
            "Varsayılan arama motoru kaydedildi!\n\nSeçiminiz: " +
                $selectedEngine,
        );
    }

    function installAsDefaultSearch() {
        // Create OpenSearch description and trigger browser installation
        if (
            browser &&
            window.external &&
            "AddSearchProvider" in window.external
        ) {
            // For Internet Explorer/Edge
            window.external.AddSearchProvider("/opensearch.xml");
        } else {
            // For modern browsers - show instructions
            alert(
                "Tarayıcınızda varsayılan arama motoru olarak ayarlamak için:\n\n" +
                    "1. Adres çubuğuna tıklayın\n" +
                    "2. Arama motoru simgesine tıklayın\n" +
                    "3. 'Arama motorlarını yönet' seçeneğini seçin\n" +
                    "4. 'Artado Search'ü bulun ve varsayılan yapın\n\n" +
                    "Veya doğrudan OpenSearch'i ekleyin:",
            );
            window.open("/opensearch.xml", "_blank");
        }
    }
</script>

<svelte:head>
    <title>{$t("settings")} - Artado Search</title>
</svelte:head>

<div class="settings-page" transition:fade={{ duration: 300 }}>
    {#if DEBUG}
        <div
            class="debug-panel"
            style="position: fixed; top: 10px; right: 10px; background: #000; color: #0f0; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 12px; z-index: 9999; max-width: 300px;"
        >
            <strong>DEBUG MODE</strong><br />
            Active Tab: {activeTab}<br />
            Workshop Loading: {$isLoadingWorkshop}<br />
            Workshop Error: {$workshopError}<br />
            Themes: {$themes.length}<br />
            Plugins: {$plugins.length}<br />
            Browser: {browser}<br />
            <button
                onclick={() =>
                    console.log("Debug Data:", {
                        activeTab,
                        themes: $themes,
                        plugins: $plugins,
                        workshopError: $workshopError,
                    })}
                style="margin-top: 5px; padding: 2px 5px; font-size: 10px;"
                >Log Data</button
            >
        </div>
    {/if}

    <header class="settings-header">
        <div class="header-left">
            <a href="/" class="back-button" aria-label="Aramaya Dön">
                <i class="fas fa-arrow-left"></i>
                <span>Aramaya Dön</span>
            </a>
        </div>
        <h1 class="settings-title">{$t("settings")}</h1>
        <div class="header-right"></div>
    </header>

    <div class="settings-content-wrapper">
        <aside class="settings-sidebar">
            <nav aria-label="Ayarlar Menüsü">
                <ul>
                    {#each filteredTabs as tab}
                        <li>
                            <button
                                class:active={activeTab === tab.id}
                                onclick={() => (activeTab = tab.id)}
                            >
                                <i class={tab.icon}></i>
                                <span>{$t(tab.label)}</span>
                            </button>
                        </li>
                    {/each}
                </ul>
            </nav>
        </aside>

        <main class="settings-main-content">
            {#if activeTab === "Temel Ayarlar"}
                <section in:slide={{ duration: 300 }}>
                    <h2 class="section-heading">{$t("basicSettings")}</h2>
                    <div class="setting-card">
                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>{$t("language")}</h3>
                                <p>Artado Search'ü kullandığınız dili seçin.</p>
                            </div>
                            <div class="select-wrapper">
                                <select bind:value={$selectedLanguage}>
                                    <option value="tr">Türkçe</option>
                                    <option value="en">English</option>
                                    <option value="fr">Français</option>
                                </select>
                            </div>
                        </div>

                        <div class="divider"></div>

                        <div class="setting-row">
                            <div class="setting-info">
                                <h3><label for="engine-select">Arama Kaynağı</label></h3>
                                <p>Sonuçların getirileceği güvenli katman.</p>
                            </div>
                            <div class="enhanced-select">
                                <select
                                    id="engine-select"
                                    bind:value={$selectedEngine}
                                >
                                    <option value="Artado Proxy">Artado Proxy (Önerilen)</option>
                                    <option value="Artado">Artado Search</option>
                                </select>
                            </div>
                        </div>
                        <div class="divider"></div>

                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>Tarayıcı Varsayılan Arama Motoru</h3>
                                <p>
                                    Artado Search'ü tarayıcınızın varsayılan
                                    arama motoru olarak ayarlayın.
                                </p>
                            </div>
                            <div class="setting-actions">
                                <button
                                    class="btn btn-primary"
                                    onclick={installAsDefaultSearch}
                                >
                                    <i class="fas fa-plus-circle"></i> Tarayıcıya
                                    Ekle
                                </button>
                                <button
                                    class="btn btn-outline"
                                    onclick={() => {
                                        alert(
                                            "Tarayıcınızda varsayılan arama motoru olarak ayarlamak için:\n\n" +
                                                "1. Adres çubuğuna tıklayın\n" +
                                                "2. Arama motoru simgesine tıklayın\n" +
                                                "3. 'Arama motorlarını yönet' seçeneğini seçin\n" +
                                                "4. 'Artado Search'ü bulun ve varsayılan yapın",
                                        );
                                    }}
                                >
                                    <i class="fas fa-info-circle"></i> Yardım
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="setting-card" style="margin-top: 2rem;">
                        <div class="setting-row">
                            <div class="setting-info">
                                <h4>Otomatik Öneriler</h4>
                                <p>Yazarken arama önerileri göster.</p>
                            </div>
                            <label class="switch">
                                <input type="checkbox" bind:checked={$enableSuggestions} />
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="divider"></div>
                        <div class="setting-row">
                            <div class="setting-info">
                                <h4>Bunu mu demek istediniz?</h4>
                                <p>Yazım hatası olduğunda düzeltme önerisi göster.</p>
                            </div>
                            <label class="switch">
                                <input type="checkbox" bind:checked={$enableSpellCorrection} />
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="divider"></div>
                        <div class="setting-row">
                            <div class="setting-info">
                                <h4>Wikipedia Kartı</h4>
                                <p>Arama sonuçlarında Wikipedia bilgi kartı göster.</p>
                            </div>
                            <label class="switch">
                                <input type="checkbox" bind:checked={$enableWikiCard} />
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="divider"></div>
                        <div class="setting-row">
                            <div class="setting-info">
                                <h4>İlgili Haberler</h4>
                                <p>Arama sonuçlarında ilgili haberleri göster.</p>
                            </div>
                            <label class="switch">
                                <input type="checkbox" bind:checked={$enableRelatedNews} />
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="divider"></div>
                        <div class="setting-row">
                            <div class="setting-info">
                                <h4>İlgili Aramalar</h4>
                                <p>Arama sonuçlarında ilgili arama önerileri göster.</p>
                            </div>
                            <label class="switch">
                                <input type="checkbox" bind:checked={$enableRelatedSearches} />
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                </section>
            {:else if activeTab === "Görünüm"}
                <section in:slide={{ duration: 300 }}>
                    <h2 class="section-heading">{$t("appearance")}</h2>
                    <div class="setting-card">
                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>{$t("themeMode")}</h3>
                                <p>{$t("themeModeDesc")}</p>
                            </div>
                            <div class="select-wrapper">
                                <select bind:value={$themeMode}>
                                    <option value="system"
                                        >{$t("system")}</option
                                    >
                                    <option value="light">{$t("light")}</option>
                                    <option value="dark">{$t("dark")}</option>
                                </select>
                            </div>
                        </div>
                        <div class="divider"></div>
                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>{$t("cornerRadius")}</h3>
                                <p>Köşe yuvarlaklığını ayarlayın.</p>
                            </div>
                            <div class="select-wrapper">
                                <select bind:value={$cornerRadius}>
                                    <option value="rounded">Yuvarlak</option>
                                    <option value="medium">Orta</option>
                                    <option value="square">Keskin</option>
                                </select>
                            </div>
                        </div>
                        <div class="divider"></div>
                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>Tema</h3>
                                <p>Site genelinde uygulanan görsel temayı seçin.</p>
                            </div>
                            <div class="select-wrapper">
                                <select bind:value={$selectedTheme}>
                                    <option value="klasik">Klasik</option>
                                    <option value="koyu">Koyu</option>
                                    <option value="mavi">Mavi</option>
                                    <option value="pastel">Pastel</option>
                                    <option value="doga">Doğa</option>
                                    <option value="terminal">Terminal</option>
                                    <option value="gece-yarisi">Gece Yarısı</option>
                                    <option value="gunesli">Güneşli</option>
                                    <option value="retro">Retro</option>
                                    <option value="komur">Kömür</option>
                                    <option value="okyanus">Okyanus</option>
                                </select>
                            </div>
                        </div>
                        <div class="divider"></div>
                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>{$t("accentColor")}</h3>
                                <p>{$t("accentColorDesc")}</p>
                            </div>
                            <input
                                type="color"
                                bind:value={$accentColor}
                                class="color-picker"
                            />
                        </div>

                        <div class="divider"></div>

                        <div class="workshop-integration">
                            <h3>
                                <i class="fas fa-store"></i> Workshop (Logolar)
                            </h3>
                            <p>
                                Workshop'tan özel logo tasarımlarını keşfedin.
                                Seçtiğiniz logo anında uygulanır.
                            </p>

                            <div class="workshop-tabs">
                                {#if $isLoadingWorkshop}
                                    <p>Yükleniyor...</p>
                                {:else if $workshopError}
                                    <div class="error-msg">
                                        <i class="fas fa-exclamation-circle"
                                        ></i>
                                        {$workshopError}
                                    </div>
                                {:else}
                                    <div class="workshop-sections">
                                        <div class="workshop-section">
                                            <div class="workshop-mini-grid">
                                                {#each $logos.slice(0, 4) as logo}
                                                    <div class="mini-item">
                                                        <img
                                                            src={logo.download_url ||
                                                                "/placeholder.png"}
                                                            alt={logo.name}
                                                            style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;"
                                                        />
                                                        <div class="mini-info">
                                                            <span
                                                                >{logo.name}</span
                                                            >
                                                            <button
                                                                onclick={() =>
                                                                    applyWorkshopItem(
                                                                        logo,
                                                                        "logo",
                                                                    )}
                                                                >Seç</button
                                                            >
                                                        </div>
                                                    </div>
                                                {/each}
                                            </div>
                                            <a
                                                href="/settings/logos"
                                                class="view-all"
                                                >Tüm Logoları Gör <i
                                                    class="fas fa-arrow-right"
                                                ></i></a
                                            >
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    </div>
                </section>

                <style>
                    /* Setting Actions */
                    .setting-actions {
                        display: flex;
                        gap: 0.5rem;
                        flex-wrap: wrap;
                    }

                    .btn {
                        display: inline-flex;
                        align-items: center;
                        gap: 0.5rem;
                        padding: 0.5rem 1rem;
                        border: 1px solid transparent;
                        border-radius: 0.375rem;
                        font-size: 0.875rem;
                        font-weight: 500;
                        text-decoration: none;
                        cursor: pointer;
                        transition: all 0.2s;
                    }

                    .btn-outline {
                        background: transparent;
                        color: var(--primary-color);
                        border-color: var(--primary-color);
                    }

                    .btn-outline:hover {
                        background: var(--primary-color);
                        color: white;
                    }
                </style>
            {:else if activeTab === "Hybrid Proxy"}
                <section in:slide={{ duration: 300 }}>
                    <h2 class="section-heading">Artado Proxy</h2>

                    <div class="setting-card">
                        <!-- Proxy URL -->
                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>Proxy URL</h3>
                                <p>
                                    Artado Proxy sunucusunun adresi. Varsayılan: <code>https://artados.vercel.app</code>
                                </p>
                            </div>
                            <input
                                class="text-input"
                                type="text"
                                bind:value={$hybridProxyBaseUrl}
                                placeholder="https://artados.vercel.app"
                            />
                        </div>

                        <div class="divider"></div>

                        <!-- Kaynak -->
                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>Kaynak</h3>
                                <p>
                                    Sonuçların getirileceği kaynak:
                                    <code>google</code>, <code>bing</code> veya <code>all</code>.
                                    Birden fazla girilirse otomatik <code>all</code> seçilir.
                                </p>
                            </div>
                            <input
                                class="text-input"
                                type="text"
                                bind:value={$hybridProxyEngines}
                                placeholder="all"
                            />
                        </div>

                        <div class="divider"></div>

                        <!-- Sonuç Sayısı -->
                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>Sonuç Sayısı</h3>
                                <p>Arama başına getirilecek maksimum sonuç sayısı (1–50). Varsayılan: 20</p>
                            </div>
                            <input
                                class="text-input"
                                type="number"
                                min="1"
                                max="50"
                                bind:value={$hybridProxyLimitTotal}
                            />
                        </div>

                        <div class="divider"></div>

                        <!-- Timeout -->
                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>Zaman Aşımı (ms)</h3>
                                <p>Proxy isteği için maksimum bekleme süresi (3000–30000 ms).</p>
                            </div>
                            <input
                                class="text-input"
                                type="number"
                                min="3000"
                                max="30000"
                                step="1000"
                                bind:value={$hybridProxyTimeoutMs}
                            />
                        </div>

                        <div class="divider"></div>

                        <!-- Önbellek -->
                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>Önbellek</h3>
                                <p>Sonuçları önbellekten getir (daha hızlı ama eski veriler olabilir).</p>
                            </div>
                            <label class="switch">
                                <input type="checkbox" bind:checked={$hybridProxyCache} />
                                <span class="slider"></span>
                            </label>
                        </div>

                        <div class="divider"></div>

                        <!-- Hız Testi -->
                        <div class="setting-row" style="flex-direction: column; align-items: flex-start; gap: 1rem;">
                            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                                <div class="setting-info">
                                    <h3>Bağlantı Testi</h3>
                                    <p>Proxy sunucusunun yanıt süresini ölçer.</p>
                                </div>
                                <button class="button" onclick={pingProxy} disabled={isTestingProxy}>
                                    <i class="fas fa-sync-alt" class:fa-spin={isTestingProxy}></i>
                                    {proxyLatency !== null ? `${proxyLatency} ms` : "Test Et"}
                                </button>
                            </div>
                            {#if proxyLatency !== null && (proxyLatency > 400 || proxyLatency === "Hata")}
                                <div class="latency-warning" in:fade>
                                    <i class="fas fa-exclamation-triangle"></i>
                                    <div class="warning-text">
                                        <strong>Düşük Hız Algılandı!</strong>
                                        <p>Proxy yanıt süresi yüksek, arama sonuçları etkilenebilir.</p>
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </div>
                </section>
            {:else if activeTab === "Bangs"}
                <section in:slide={{ duration: 300 }}>
                    <h2 class="section-heading">Bang Komutları</h2>
                    <div class="setting-card">
                        <div class="setting-info">
                            <h3>Bang Komutları Hakkında</h3>
                            <p>
                                Artado Search'te bang komutlarını kullanarak
                                hızlı arama yapabilirsiniz. Örneğin: <code
                                    >!g test</code
                                >
                                Google'da, <code>!w türkiye</code> Wikipedia'da arama
                                yapar.
                            </p>
                        </div>

                        <div class="divider"></div>
                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>{$t("openBangsInNewTab")}</h3>
                                <p>
                                    {$t("openBangsInNewTabDesc")}
                                </p>
                            </div>
                            <label class="switch">
                                <input
                                    type="checkbox"
                                    bind:checked={$bangsOpenNewTab}
                                />
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="divider"></div>
                        <div class="bangs-preview">
                            <h4>Bang Komutları</h4>
                            <div class="bangs-quick-list">
                                <div class="bang-item">
                                    <code>!g</code>
                                    <span>Google</span>
                                </div>
                                <div class="bang-item">
                                    <code>!ddg</code>
                                    <span>DuckDuckGo</span>
                                </div>
                                <div class="bang-item">
                                    <code>!yt</code>
                                    <span>YouTube</span>
                                </div>
                                <div class="bang-item">
                                    <code>!w</code>
                                    <span>Wikipedia</span>
                                </div>
                                <div class="bang-item">
                                    <code>!gh</code>
                                    <span>GitHub</span>
                                </div>
                                <div class="bang-item">
                                    <code>!tw</code>
                                    <span>Twitter</span>
                                </div>
                                <div class="bang-item">
                                    <code>!fb</code>
                                    <span>Facebook</span>
                                </div>
                                <div class="bang-item">
                                    <code>!rd</code>
                                    <span>Reddit</span>
                                </div>
                            </div>
                        </div>
                        <div class="divider"></div>
                        <div class="custom-bangs-section">
                            <h4>Kendi Bang'lerinizi Ekleyin</h4>
                            <p>Özel kısayollar oluşturun. Örn: <code>!yt</code> ile YouTube'da arama.</p>
                            <div class="custom-bang-form">
                                <input type="text" placeholder="!kısayol" id="bangTrigger" style="flex:1; padding:0.5rem; border-radius:6px; border:1px solid var(--border-color); background:var(--background-color); color:var(--text-color);" />
                                <input type="text" placeholder="İsim (örn: YouTube)" id="bangName" style="flex:2; padding:0.5rem; border-radius:6px; border:1px solid var(--border-color); background:var(--background-color); color:var(--text-color);" />
                                <input type="text" placeholder="URL şablonu (örn: https://youtube.com/results?search_query={{q}})" id="bangUrl" style="flex:3; padding:0.5rem; border-radius:6px; border:1px solid var(--border-color); background:var(--background-color); color:var(--text-color);" />
                                <button class="btn btn-primary" onclick={() => {
                                    const t = document.getElementById('bangTrigger').value.trim();
                                    const n = document.getElementById('bangName').value.trim();
                                    const u = document.getElementById('bangUrl').value.trim();
                                    if (!t || !n || !u) return alert('Tüm alanları doldurun');
                                    if (!t.startsWith('!')) return alert('Kısayol ! ile başlamalı');
                                    if (!u.includes('{{q}}')) return alert('URL şablonunda {{q}} olmalı');
                                    const list = $customBangs;
                                    if (list.find(b => b.trigger === t)) return alert('Bu kısayol zaten var');
                                    customBangs.set([...list, { trigger: t, name: n, url: u }]);
                                    document.getElementById('bangTrigger').value = '';
                                    document.getElementById('bangName').value = '';
                                    document.getElementById('bangUrl').value = '';
                                }}>Ekle</button>
                            </div>
                            {#if $customBangs.length > 0}
                                <div class="custom-bang-list" style="margin-top:1rem;">
                                    {#each $customBangs as bang}
                                        <div class="bang-item" style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; padding:0.5rem; background:var(--card-background); border-radius:6px; margin-bottom:0.5rem;">
                                            <div style="display:flex; align-items:center; gap:1rem; flex:1;">
                                                <code style="font-weight:bold;">{bang.trigger}</code>
                                                <span>{bang.name}</span>
                                                <span style="font-size:0.8rem; opacity:0.6; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{bang.url}</span>
                                            </div>
                                            <button onclick={() => {
                                                customBangs.set($customBangs.filter(b => b.trigger !== bang.trigger));
                                            }} aria-label="{bang.name} bang'ini sil" style="background:none; border:none; color:var(--danger-color,#e53935); cursor:pointer; padding:0.3rem;"><i class="fas fa-trash"></i></button>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    </div>
                </section>
            {:else if activeTab === "Temalar"}
                <section in:slide={{ duration: 300 }}>
                    <h2 class="section-heading">{$t("themes")}</h2>
                    <div class="setting-card">
                        <div class="themes-grid">
                            {#each ["klasik", "koyu", "mavi", "pastel", "doga", "terminal", "gece-yarisi", "gunesli", "retro", "komur", "okyanus"] as theme}
                                <button
                                    class="theme-button"
                                    class:active={$selectedTheme === theme}
                                    onclick={() => selectedTheme.set(theme)}
                                >
                                    <div
                                        class="theme-preview-box {theme}"
                                    ></div>
                                    <span>{formatThemeName(theme)}</span>
                                </button>
                            {/each}

                            {#if installedGeneralThemes.length > 0}
                                {#each installedGeneralThemes as itheme}
                                    <div class="theme-button-wrapper">
                                        <button
                                            class="theme-button"
                                            class:active={$selectedTheme ===
                                                itheme.id}
                                            onclick={() =>
                                                selectedTheme.set(itheme.id)}
                                        >
                                            <div
                                                class="theme-preview-box external"
                                            >
                                                <i class="fas fa-file-code"></i>
                                            </div>
                                            <span>{itheme.name}</span>
                                            <small class="author-tag"
                                                >{itheme.author}</small
                                            >
                                        </button>
                                        <button
                                            class="delete-theme-btn"
                                            onclick={(e) => {
                                                e.stopPropagation();
                                                uninstallItem(
                                                    itheme.id,
                                                    "theme",
                                                );
                                            }}
                                            title="Temayı Sil"
                                            aria-label="Temayı Sil"
                                        >
                                            <i
                                                class="fas fa-trash"
                                                aria-hidden="true"
                                            ></i>
                                        </button>
                                    </div>
                                {/each}
                            {/if}
                        </div>

                        <h3 style="margin-top: 2rem;">Menü Temaları</h3>
                        <div class="themes-grid small">
                            <button
                                class="theme-button"
                                onclick={() => applySidebarTheme("default")}
                            >
                                <div
                                    class="theme-preview-box small sidebar-default"
                                ></div>
                                <span>Varsayılan</span>
                            </button>
                            <button
                                class="theme-button"
                                onclick={() => applySidebarTheme("gradient")}
                            >
                                <div
                                    class="theme-preview-box small sidebar-gradient"
                                ></div>
                                <span>Gradient</span>
                            </button>
                            <button
                                class="theme-button"
                                onclick={() => applySidebarTheme("glass")}
                            >
                                <div
                                    class="theme-preview-box small sidebar-glass"
                                ></div>
                                <span>Cam Efekti</span>
                            </button>
                        </div>
                    </div>
                </section>
            {:else if activeTab === "Özel CSS"}
                <section in:slide={{ duration: 300 }}>
                    <h2 class="section-heading">Özel CSS</h2>
                    <div class="setting-card">
                        <p>Hızlı başlangıç için hazır CSS şablonları:</p>
                        <div class="preset-buttons">
                            <button onclick={() => applyPresetCSS("modernClean")} title="Tüm sayfalarda yuvarlak köşeler uygular. Kartlar, arama kutusu ve butonlar 16px ile 24px arası yuvarlaklık kazanır. Gölgeler yumuşak ve katmanlıdır. Inter font ailesini kullanarak modern ve temiz bir tipografi sunar. Arama sonuçları kartlarının üzerine gelindiğinde hafifçe yukarı kalkma ve gölge derinleşme efekti oluşturur. Ayarlar sayfası, sidebar ve diğer tüm bileşenlerde tutarlı bir görünüm sağlar." >Modern Yuvarlak</button>
                            <button onclick={() => applyPresetCSS("softShadows")} title="Tüm sayfalarda derinlik hissi veren çok katmanlı gölgeler oluşturur. Kartlar 20px yuvarlaklıkla birlikte 32px derinliğinde yumuşak gölgeler alır. Arama kutusu daha belirgin 40px gölgelerle öne çıkar. Georgia serif font kullanarak klasik ve okunaklı bir tipografi sunar. Butonlarda hover efektiyle gölge büyümesi sağlar. Tüm bileşenlerde tutarlı derinlik katmanları oluşturur." >Derin Gölgeler</button>
                            <button onclick={() => applyPresetCSS("darkModern")} title="Tüm sayfalarda koyu bir arka plan ve yüksek kontrast oluşturur. Arka plan tam siyah yakını (#0a0a0f), kartlar koyu gri tonlarındadır. JetBrains Mono monospace font kullanarak kod editörü hissiyatı verir. Kenarlıklar ince ve koyu renklidir. Bağlantılar mavi tonlarda belirginleşir. Ayarlar, arama sonuçları ve sidebar dahil tüm sayfalarda tutarlı koyu tema uygular." >Koyu Modern</button>
                            <button onclick={() => applyPresetCSS("minimalElegant")} title="Tüm sayfalarda ince çizgiler ve küçük yuvarlak köşelerle sade bir görünüm sunar. Kartlar sadece 8px yuvarlaklık ve hafif bir gölge alır. System-ui font ile işletim sistemi yerel tipografisini kullanır. Başlıklar arasında harf aralığı daraltması yaparak modern bir hava katar. Tüm bileşenlerde gereksiz süslemeleri kaldırarak sade ve zarif bir deneyim sağlar. Ayarlar ve sidebar dahil her yerde tutarlıdır." >Minimal Şık</button>
                            <button onclick={() => applyPresetCSS("glassModern")} title="Tüm sayfalarda arka planı gösteren buzlu cam görünümü uygular. Kartlar, arama kutusu ve butonlar yarı saydam beyaz zeminle blur efekti alır. Sayfa arka planında mor-mavi renk geçişi sabitlenir. Poppins font kullanarak yuvarlak ve modern karakterler sunar. Sidebar ve ayarlar kartlarında da cam efekti devam eder. Tüm sayfalarda içerikler hafifçe arka planı göstererek derinlik yaratır." >Cam Efekt</button>
                            <button onclick={() => applyPresetCSS("colorful")} title="Tüm sayfalarda canlı mor-mavi renk geçişleri uygular. Kartlar ve arama kutusu moradan maviye doğru geçişli renklere bürünür. Nunito font ile yuvarlak ve samimi karakterler sunar. Butonlar pembe-kırmızı tonlarda farklı bir geçiş alır. Tüm kart içindeki metinler beyaz renge döner. Sidebar da aynı geçişli renkleri alır. Ayarlar sayfası dahil tüm bileşenlerde tutarlı canlı renk paleti oluşturur." >Canlı Renkler</button>
                            <button onclick={() => applyPresetCSS("neumorphic")} title="Tüm sayfalarda dışarı çıkık ve içeri çökük efektler uygular. Kartlar, arama kutusu ve butonlar gri arka plan üzerinde yumuşak gölgelerle 3D görünüm kazanır. Aynı anda hem açık hem koyu yönlu gölgeler kullanılarak çıkıntı hissi oluşturulur. Segoe UI font ile Windows tarzı temiz tipografi sunar. Giriş alanları içeri çökük görünürken butonlar dışarı çıkık görünür. Tüm sayfalarda yumuşak ve dokunulabilir bir his yaratır." >Yumuşak Derinlik</button>
                            <button onclick={() => applyPresetCSS("retro80s")} title="Tüm sayfalarda 1980'lerin parlak neon renklerini ve retro oyun estetiğini getirir. Kartlar kırmızı-sarı geçişli parlak renklerle kaplanır ve beyaz kalın kenarlıklar alır. Press Start 2P pixel font kullanarak 8-bit oyun hissi sunar. Köşeler keskin ve karedir. Butonlar turkuaz, giriş alanları pembe renge bürünür. Tüm sayfalarda oyun konsolu estetiği hakim olur. Arka plan koyu mor tonlarda sabitlenir." >Retro 80'ler</button>
                            <button onclick={() => applyPresetCSS("cyberNeon")} title="Tüm sayfalarda parlak yeşil neon ışıklar ve karanlık bir cyberpunk atmosferi oluşturur. Arka plan tam siyah, tüm kenarlıklar ve metinler parlak yeşil neondur. Orbitron font ile bilim kurgu temalı tipografi sunar. Kartlar ve butonlar neon yeşil ışıltılı kutular haline gelir. Arama kutusu da neon çerçeveyle parlar. Tüm sayfalarda gece şehir ışıkları hissiyatı yaratır. Giriş alanları ve bağlantılar da neon efekti alır." >Neon Işıklar</button>
                            <button onclick={() => applyPresetCSS("glitch")} title="Tüm sayfalarda sürekli hareket eden renkli dijital bozulma efekti uygular. Kartlar parlak yeşil, pembe ve mavi kutularla çevrilidir. VT323 terminal font kullanarak eski bilgisayar ekranı hissi sunar. Kartlar sürekli hafifçe titreyerek kayma efekti oluşturur. Köşeler tamamen karedir. Butonlar turkuaz, giriş alanları pembe zemine döner. Tüm sayfalarda hacker tarzı, bozuk ekran estetiği hakim olur." >Dijital Bozulma</button>
                        </div>
                        <p style="font-size:0.8rem; opacity:0.7; margin-top:0.5rem;"><i class="fas fa-info-circle"></i> Bir şablonun üzerine gelerek ne yaptığını görebilirsiniz.</p>
                        <textarea
                            bind:value={$customCssStore}
                            oninput={(e) => applyCustomCss(e.target.value)}
                            rows="12"
                            placeholder="/* CSS kodunuzu buraya yazın... */"
                            class="css-editor"
                        ></textarea>
                        <button
                            class="button danger"
                            style="margin-top: 1rem;"
                            onclick={() => applyCustomCss("")}>Temizle</button
                        >
                    </div>
                </section>
            {:else if activeTab === "Gelişmiş"}
                <section in:slide={{ duration: 300 }}>
                    <h2 class="section-heading">Gelişmiş Ayarlar</h2>

                    <div class="setting-card">
                        <h3>Yedekleme ve Geri Yükleme</h3>
                        <p>
                            Yedeklemek istediğiniz ayarları seçin ve dışa aktarın.
                        </p>
                        <div class="backup-selection" style="margin:1rem 0; display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:0.5rem;">
                            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; padding:0.3rem;">
                                <input type="checkbox" bind:checked={backupSelection.theme} /> Tema ve Görünüm
                            </label>
                            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; padding:0.3rem;">
                                <input type="checkbox" bind:checked={backupSelection.search} /> Arama Ayarları
                            </label>
                            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; padding:0.3rem;">
                                <input type="checkbox" bind:checked={backupSelection.proxy} /> Proxy Ayarları
                            </label>
                            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; padding:0.3rem;">
                                <input type="checkbox" bind:checked={backupSelection.features} /> Arama Özellikleri
                            </label>
                            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; padding:0.3rem;">
                                <input type="checkbox" bind:checked={backupSelection.bangs} /> Bang Komutları
                            </label>
                            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; padding:0.3rem;">
                                <input type="checkbox" bind:checked={backupSelection.customCss} /> Özel CSS
                            </label>
                            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; padding:0.3rem;">
                                <input type="checkbox" bind:checked={backupSelection.blockedSites} /> Engellenen Siteler
                            </label>
                            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; padding:0.3rem;">
                                <input type="checkbox" bind:checked={backupSelection.advanced} /> Gelişmiş Ayarlar
                            </label>
                        </div>
                        <div class="action-buttons">
                            <button
                                class="button primary"
                                onclick={backupSettings}
                            >
                                <i class="fas fa-download"></i> Seçili Ayarları Yedekle
                            </button>
                            <label class="button secondary file-upload-btn">
                                <i class="fas fa-upload"></i> Yedekten Geri
                                Yükle
                                <input
                                    type="file"
                                    accept=".json"
                                    onchange={restoreSettings}
                                    style="display: none;"
                                />
                            </label>
                        </div>
                    </div>

                    <div class="setting-card danger-card" style="margin-top: 2rem;">
                        <h3><i class="fas fa-trash-alt" style="color:var(--danger-color, #e53935);"></i> Verileri Sıfırla</h3>
                        <p>
                            Tüm ayarlar, tema tercihleri ve özel CSS fabrika değerlerine döndürülür.
                            <strong>Bu işlem geri alınamaz.</strong>
                        </p>
                        <div class="action-buttons" style="margin-top:1rem;">
                            <button
                                class="button danger"
                                onclick={() => {
                                    if (confirm('Tüm ayarlar sıfırlanacak. Emin misiniz?')) {
                                        localStorage.clear();
                                        location.reload();
                                    }
                                }}
                            >
                                <i class="fas fa-redo"></i> Tüm Ayarları Sıfırla
                            </button>
                        </div>
                    </div>

                    <div class="setting-card" style="margin-top: 2rem;">
                        <h3>Engellenen / Öne Çıkarılmayan Siteler</h3>
                        <p>
                            Arama sonuçlarında öne çıkarılması engellenen
                            sitelerin listesi.
                        </p>
                        {#if $blockedSites.length > 0}
                            <ul class="blocked-sites-list">
                                {#each $blockedSites as site}
                                    <li>
                                        <span>{site}</span>
                                        <button
                                            onclick={() =>
                                                removeBlockedSite(site)}
                                            title="Engeli Kaldır"
                                            aria-label="Engeli Kaldır"
                                        >
                                            <i
                                                class="fas fa-times"
                                                aria-hidden="true"
                                            ></i>
                                        </button>
                                    </li>
                                {/each}
                            </ul>
                        {:else}
                            <p class="empty-state">
                                Henüz engellenen bir site yok.
                            </p>
                        {/if}
                    </div>
                </section>
            {:else if activeTab === "Eklentiler"}
                <section in:slide={{ duration: 300 }}>
                    <h2 class="section-heading">Workshop</h2>
                    {#if $isLoadingWorkshop}
                        <p>Yükleniyor...</p>
                    {:else if $workshopError}
                        <div class="setting-card error-card">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>{$workshopError}</p>
                            <button
                                class="button secondary small"
                                onclick={fetchWorkshopItems}>Tekrar Dene</button
                            >
                        </div>
                    {:else}
                        <div class="setting-card">
                            <h3 style="margin-bottom: 1rem;">
                                <i class="fas fa-palette"></i> Temalar
                            </h3>
                            {#if $themes.length > 0}
                                <div class="workshop-grid">
                                    {#each $themes as theme}
                                        <div class="workshop-item">
                                            <div class="workshop-preview">
                                                {#if theme.image_url}
                                                    <img
                                                        src={theme.image_url}
                                                        alt={theme.name}
                                                    />
                                                {:else}
                                                    <div class="no-preview">
                                                        Resim Yok
                                                    </div>
                                                {/if}
                                            </div>
                                            <div class="workshop-info">
                                                <strong>{theme.name}</strong>
                                                <small>{theme.author}</small>
                                                <p>{theme.description || ""}</p>
                                                {#if [...installedGeneralThemes, ...installedHomeThemes].some((t) => t.id === theme.id || t.id === theme.name
                                                                .replace(/[^a-z0-9]/gi, "_")
                                                                .toLowerCase())}
                                                    <button
                                                        class="button primary small"
                                                        style="background-color: var(--error-color, #dc3545); color: white;"
                                                        onclick={() =>
                                                            uninstallItem(
                                                                theme.id ||
                                                                    theme.name
                                                                        .replace(
                                                                            /[^a-z0-9]/gi,
                                                                            "_",
                                                                        )
                                                                        .toLowerCase(),
                                                                "theme",
                                                            )}
                                                    >
                                                        Kaldır
                                                    </button>
                                                {:else}
                                                    <button
                                                        class="button primary small"
                                                        onclick={() =>
                                                            installItem(
                                                                theme,
                                                                "theme",
                                                            )}
                                                        disabled={installingId ===
                                                            theme.id}
                                                    >
                                                        {installingId ===
                                                        theme.id
                                                            ? "Yükleniyor..."
                                                            : "İndir"}
                                                    </button>
                                                    <button
                                                        class="button secondary small"
                                                        style="background: var(--accent-color); border: none;"
                                                        onclick={() =>
                                                            applyRemoteItem(
                                                                theme,
                                                                "theme",
                                                            )}
                                                    >
                                                        Uygula (Anında)
                                                    </button>
                                                {/if}
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {:else}
                                <p class="empty-state">
                                    Henüz tema bulunamadı.
                                </p>
                            {/if}

                            <div class="divider" style="margin: 2rem 0;"></div>

                            <h3 style="margin-bottom: 1rem;">
                                <i class="fas fa-puzzle-piece"></i> Eklentiler
                            </h3>
                            {#if $plugins.length > 0}
                                <div class="workshop-grid">
                                    {#each $plugins as plugin}
                                        <div class="workshop-item">
                                            <div class="workshop-preview">
                                                {#if plugin.image_url}
                                                    <img
                                                        src={plugin.image_url}
                                                        alt={plugin.name}
                                                    />
                                                {:else}
                                                    <div class="no-preview">
                                                        Resim Yok
                                                    </div>
                                                {/if}
                                            </div>
                                            <div class="workshop-info">
                                                <strong>{plugin.name}</strong>
                                                <small>{plugin.author}</small>
                                                <p>
                                                    {plugin.description || ""}
                                                </p>
                                                {#if installedPluginsList.some((p) => p.id === plugin.id || p.id === plugin.name
                                                                .replace(/[^a-z0-9]/gi, "_")
                                                                .toLowerCase())}
                                                    <button
                                                        class="button secondary small"
                                                        style="background-color: var(--error-color, #dc3545); color: white;"
                                                        onclick={() =>
                                                            uninstallItem(
                                                                plugin.id ||
                                                                    plugin.name
                                                                        .replace(
                                                                            /[^a-z0-9]/gi,
                                                                            "_",
                                                                        )
                                                                        .toLowerCase(),
                                                                "plugin",
                                                            )}
                                                        aria-label="Kaldır"
                                                    >
                                                        Kaldır
                                                    </button>
                                                {:else}
                                                    <button
                                                        class="button secondary small"
                                                        onclick={() =>
                                                            installItem(
                                                                plugin,
                                                                "plugin",
                                                            )}
                                                        disabled={installingId ===
                                                            plugin.id}
                                                    >
                                                        {installingId ===
                                                        plugin.id
                                                            ? "Yükleniyor..."
                                                            : "İndir"}
                                                    </button>
                                                {/if}
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {:else}
                                <p class="empty-state">
                                    Henüz eklenti bulunamadı.
                                </p>
                            {/if}
                        </div>
                    {/if}
                </section>
            {/if}
        </main>
    </div>
</div>

<style>
    /* Premium Settings Styles */
    .settings-page {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background-color: var(--background-color);
        background-image: var(--background-image, none);
        color: var(--text-color);
        font-family: "Inter", sans-serif;
    }

    .settings-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.5rem 3rem;
        background: transparent;
        box-shadow: none;
        position: sticky;
        top: 0;
        z-index: 100;
        backdrop-filter: none;
        border-radius: 12px;
        margin: 0.5rem 1rem;
    }

    .settings-title {
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0;
        background: linear-gradient(
            135deg,
            var(--primary-color),
            var(--accent-color)
        );
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .back-button {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        text-decoration: none;
        color: var(--text-color-secondary);
        font-weight: 500;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        transition: all 0.2s;
        background: var(--input-background);
    }
    .back-button:hover {
        background: var(--hover-background);
        color: var(--primary-color);
        transform: translateX(-3px);
    }

    .settings-content-wrapper {
        display: flex;
        max-width: 1400px;
        margin: 2rem auto;
        width: 95%;
        gap: 2rem;
        align-items: flex-start;
    }

    .settings-sidebar {
        width: 260px;
        flex-shrink: 0;
    }

    .settings-sidebar nav ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .settings-sidebar nav li {
        margin-bottom: 0.5rem;
    }

    .settings-sidebar button {
        width: 100%;
        text-align: left;
        background: transparent;
        border: none;
        padding: 1rem 1.2rem;
        border-radius: 12px;
        color: var(--text-color-secondary);
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 1rem;
        font-size: 1rem;
    }

    .settings-sidebar button i {
        width: 20px;
        text-align: center;
    }

    .settings-sidebar button:hover {
        background: var(--hover-background);
        color: var(--text-color);
    }

    .settings-sidebar button.active {
        background: var(--primary-color);
        color: white;
        box-shadow: 0 4px 12px rgba(var(--primary-color-rgb), 0.3);
    }

    .settings-main-content {
        flex-grow: 1;
        min-width: 0;
    }

    .section-heading {
        margin-bottom: 1.5rem;
        font-size: 1.8rem;
        font-weight: 700;
    }

    .setting-card {
        background: var(--card-background);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 2rem;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
    }

    .setting-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0;
        gap: 2rem;
    }

    .setting-info h3 {
        margin: 0 0 0.5rem 0;
        font-size: 1.1rem;
        font-weight: 600;
    }

    .setting-info p {
        margin: 0;
        color: var(--text-color-secondary);
        font-size: 0.9rem;
    }

    .divider {
        height: 1px;
        background: var(--border-color);
        margin: 1.5rem 0;
        opacity: 0.5;
    }

    /* Controls */
    .select-wrapper {
        position: relative;
        min-width: 180px;
    }
    .select-wrapper select {
        width: 100%;
        padding: 0.7rem 2.5rem 0.7rem 1rem;
        border-radius: 8px;
        border: 1px solid var(--border-color);
        background: var(--input-background);
        color: var(--text-color);
        font-size: 0.95rem;
        cursor: pointer;
        appearance: none;
    }
    .select-wrapper .dropdown-icon {
        position: absolute;
        right: 1rem;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        color: var(--text-color-secondary);
    }

    .color-picker {
        border: none;
        width: 50px;
        height: 50px;
        padding: 0;
        background: none;
        cursor: pointer;
    }

    /* Switch */
    .switch {
        position: relative;
        display: inline-block;
        width: 50px;
        height: 28px;
    }
    .switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #ccc;
        transition: 0.3s;
        border-radius: 34px;
    }
    .slider:before {
        position: absolute;
        content: "";
        height: 20px;
        width: 20px;
        left: 4px;
        bottom: 4px;
        background-color: white;
        transition: 0.3s;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    input:checked + .slider {
        background-color: var(--primary-color);
    }
    input:checked + .slider:before {
        transform: translateX(22px);
    }

    /* Themes Grid */
    .themes-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
        gap: 1.5rem;
    }
    .theme-button {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.8rem;
        padding: 1rem;
        border: 1px solid var(--border-color);
        border-radius: 12px;
        background: var(--input-background);
        cursor: pointer;
        transition: all 0.2s;
    }
    .theme-button:hover {
        transform: translateY(-3px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
    }
    .theme-button.active {
        border-color: var(--primary-color);
        background: rgba(var(--primary-color-rgb), 0.05);
    }

    .theme-preview-box {
        width: 100%;
        height: 80px;
        border-radius: 8px;
        background: #f0f0f0; /* Default */
        box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.05);
    }
    /* Complete color previews for all themes */
    .theme-preview-box.klasik {
        background: linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%);
        border: 1px solid #ddd;
    }
    .theme-preview-box.koyu {
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
    }
    .theme-preview-box.mavi {
        background: linear-gradient(135deg, #e3f2fd 0%, #90caf9 100%);
        border: 1px solid #64b5f6;
    }
    .theme-preview-box.pastel {
        background: linear-gradient(135deg, #fef6e4 0%, #f3d5c0 100%);
        border: 1px solid #f8b500;
    }
    .theme-preview-box.doga {
        background: linear-gradient(135deg, #f0f4f0 0%, #a8d5ba 100%);
        border: 1px solid #68b684;
    }
    .theme-preview-box.terminal {
        background: linear-gradient(135deg, #0c0c0c 0%, #00ff00 100%);
        border: 1px solid #00ff00;
    }
    .theme-preview-box.gece-yarisi {
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid #0f3460;
    }
    .theme-preview-box.gunesli {
        background: linear-gradient(135deg, #fffde7 0%, #ffeb3b 100%);
        border: 1px solid #fbc02d;
    }
    .theme-preview-box.retro {
        background: linear-gradient(135deg, #fdf0d5 0%, #e07a5f 100%);
        border: 1px solid #c1666b;
    }
    .theme-preview-box.komur {
        background: linear-gradient(135deg, #121212 0%, #424242 100%);
        border: 1px solid #616161;
    }
    .theme-preview-box.okyanus {
        background: linear-gradient(135deg, #e0f7fa 0%, #4dd0e1 100%);
        border: 1px solid #00acc1;
    }

    /* CSS Editor */
    .css-editor {
        width: 100%;
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid var(--border-color);
        background: var(--input-background);
        color: var(--text-color);
        font-family: monospace;
        margin-top: 1rem;
        resize: vertical;
    }
    .preset-buttons {
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
    }
    .preset-buttons button {
        padding: 0.5rem 1rem;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        background: var(--card-background);
        cursor: pointer;
    }

    /* Buttons */
    .button {
        padding: 0.7rem 1.5rem;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        transition: all 0.2s;
    }
    .button.primary {
        background: var(--primary-color);
        color: white;
    }
    .button.secondary {
        background: var(--input-background);
        color: var(--text-color);
        border: 1px solid var(--border-color);
    }
    .button.danger {
        background: #ff4757;
        color: white;
    }
    .button:hover {
        opacity: 0.9;
        transform: translateY(-1px);
    }

    .file-upload-btn {
        display: inline-flex;
        cursor: pointer;
    }

    .blocked-sites-list {
        list-style: none;
        padding: 0;
    }
    .blocked-sites-list li {
        display: flex;
        justify-content: space-between;
        padding: 0.8rem;
        background: var(--input-background);
        margin-bottom: 0.5rem;
        border-radius: 6px;
    }
    .blocked-sites-list button {
        background: none;
        border: none;
        color: #ff4757;
        cursor: pointer;
    }

    /* History Styles */
    .history-list {
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
    }
    .history-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem;
        background: var(--input-background);
        border: 1px solid var(--border-color);
        border-radius: 10px;
        transition: all 0.2s;
    }
    .history-item:hover {
        border-color: var(--primary-color);
        background: var(--hover-background);
    }
    .history-item-info {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex: 1;
        min-width: 0;
    }
    .history-item-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }
    .history-query {
        font-weight: 500;
        color: var(--primary-color);
        text-decoration: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .history-query:hover {
        text-decoration: underline;
    }
    .setting-info p {
        font-size: 0.95rem;
        color: var(--text-color-secondary);
        margin: 0;
        line-height: 1.5;
    }

    .history-disabled-notice {
        margin-top: 0.5rem !important;
        font-size: 0.9rem !important;
        color: var(--primary-color) !important;
        opacity: 0.9;
        font-weight: 500;
    }

    .link-btn {
        background: none;
        border: none;
        color: var(--primary-color);
        text-decoration: underline;
        cursor: pointer;
        padding: 0;
        font-size: inherit;
        font-family: inherit;
        font-weight: 700;
        transition: opacity 0.2s;
    }

    .link-btn:hover {
        opacity: 0.7;
    }
    .history-disabled-banner {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        background: rgba(var(--primary-color-rgb), 0.1);
        padding: 0.6rem 1.2rem;
        border-radius: 50px;
        color: var(--primary-color);
        font-size: 0.9rem;
        font-weight: 500;
        border: 1px solid rgba(var(--primary-color-rgb), 0.2);
    }

    .link-btn-history {
        background: none;
        border: none;
        color: var(--primary-color);
        text-decoration: underline;
        cursor: pointer;
        padding: 0;
        font-size: inherit;
        font-weight: 700;
    }

    .history-filter-container {
        margin-bottom: 1.5rem;
    }

    .history-search-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        background: var(--background-color-secondary);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 0 1rem;
        transition: all 0.2s;
    }

    .history-search-wrapper:focus-within {
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.1);
    }

    .history-search-wrapper i {
        color: var(--text-color-secondary);
        font-size: 0.9rem;
    }

    .history-filter-input {
        width: 100%;
        background: transparent;
        border: none;
        outline: none;
        padding: 0.8rem;
        color: var(--text-color);
        font-size: 0.95rem;
    }

    .clear-history-search {
        background: none;
        border: none;
        color: var(--text-color-secondary);
        cursor: pointer;
        padding: 0.5rem;
        font-size: 0.9rem;
    }

    .clear-history-search:hover {
        color: var(--text-color);
    }

    .filter-chips {
        display: flex;
        gap: 0.6rem;
        margin-top: 1rem;
        flex-wrap: wrap;
    }

    .chip {
        padding: 0.5rem 1.2rem;
        border-radius: 50px;
        background: var(--input-background);
        border: 1px solid var(--border-color);
        color: var(--text-color-secondary);
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .chip:hover {
        border-color: var(--primary-color);
        color: var(--primary-color);
    }

    .chip.active {
        background: var(--primary-color);
        border-color: var(--primary-color);
        color: white;
    }

    .history-delete-btn {
        background: none;
        border: none;
        color: var(--text-color-secondary);
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 50%;
        transition: all 0.2s;
    }
    .history-delete-btn:hover {
        background: rgba(255, 71, 87, 0.1);
        color: #ff4757;
    }
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 3rem 0;
        color: var(--text-color-secondary);
        text-align: center;
    }

    /* Workshop Styles */
    .workshop-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1.5rem;
    }
    .workshop-item {
        background: var(--card-background);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transition: transform 0.2s;
    }
    .workshop-item:hover {
        transform: translateY(-4px);
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    }
    .workshop-preview {
        height: 120px;
        background: var(--input-background);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }
    .workshop-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .no-preview {
        font-size: 0.8rem;
        color: var(--text-color-secondary);
        opacity: 0.5;
    }
    .workshop-info {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        flex-grow: 1;
    }
    .workshop-info strong {
        font-size: 1rem;
        color: var(--text-color);
    }
    .workshop-info small {
        color: var(--primary-color);
        font-weight: 500;
    }
    .workshop-info p {
        font-size: 0.8rem;
        color: var(--text-color-secondary);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        margin: 0;
    }
    .workshop-info button {
        margin-top: auto;
    }
    .divider {
        height: 1px;
        background: var(--border-color);
        width: 100%;
        opacity: 0.5;
    }
    .error-card {
        border-color: #ff4757;
        color: #ff4757;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        padding: 2rem;
    }
    .error-card i {
        font-size: 2rem;
    }

    .theme-preview-box.external {
        background: linear-gradient(45deg, #1a73e8, #9d50bb);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 1.5rem;
    }

    .author-tag {
        display: block;
        font-size: 0.7rem;
        color: var(--text-color-secondary);
        margin-top: 0.2rem;
    }

    .theme-button-wrapper {
        position: relative;
        display: inline-block;
    }

    .delete-theme-btn {
        position: absolute;
        top: -5px;
        right: -5px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #dc3545;
        color: white;
        border: 2px solid var(--card-background);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.7rem;
        cursor: pointer;
        opacity: 0;
        transition: all 0.2s;
        z-index: 10;
        padding: 0;
    }

    .theme-button-wrapper:hover .delete-theme-btn {
        opacity: 1;
        transform: scale(1.1);
    }

    .delete-theme-btn:hover {
        background: #a71d2a;
        transform: scale(1.2) !important;
    }

    /* Responsive Styles */
    @media (max-width: 1024px) {
        .settings-content-wrapper {
            flex-direction: column;
            margin: 1rem auto;
            gap: 1.5rem;
        }
        .settings-sidebar {
            width: 100%;
            overflow-x: auto;
            position: sticky;
            top: 70px;
            z-index: 90;
            background: var(--background-color);
            padding: 0.5rem 0;
            margin-bottom: 0;
        }
        .settings-sidebar nav ul {
            display: flex;
            gap: 0.5rem;
            padding: 0 0.5rem;
        }
        .settings-sidebar nav li {
            margin-bottom: 0;
            white-space: nowrap;
        }
        .settings-sidebar button {
            padding: 0.6rem 1rem;
            font-size: 0.9rem;
            border-radius: 12px;
        }
    }

    @media (max-width: 768px) {
        .settings-page {
            width: 100%;
            min-height: 100vh;
            background-color: var(--background-color);
            margin: 0;
            padding: 0 12px;
            box-sizing: border-box;
            overflow-x: hidden;
        }

        .settings-header {
            position: relative;
            left: -12px;
            width: calc(100% + 24px);
            padding: 1rem 12px;
            margin: 0;
            box-sizing: border-box;
            border-radius: 12px;
        }

        .settings-content-wrapper {
            flex-direction: column;
            margin: 0;
            width: 100%;
            padding: 0;
            gap: 0;
        }

        .settings-sidebar {
            width: 100%;
            order: 1;
            background: var(--card-background);
            border-bottom: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 0.5rem;
        }

        .settings-main-content {
            order: 2;
            width: 100%;
            padding: 1rem 0;
        }

        .settings-title {
            font-size: 1.2rem;
        }
        .back-button span {
            display: none;
        }
        .setting-card {
            padding: 1rem;
        }
        .setting-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
        }
        .setting-control {
            width: 100%;
        }
        .setting-control select {
            width: 100%;
        }
        .section-heading {
            font-size: 1.5rem;
        }
        .workshop-grid {
            grid-template-columns: 1fr;
        }

        .preset-buttons {
            flex-direction: column;
            gap: 0.5rem;
        }

        .preset-buttons button {
            width: 100%;
        }
    }
    .latency-warning {
        display: flex;
        align-items: center;
        gap: 1rem;
        background: rgba(255, 193, 7, 0.1);
        border: 1px solid rgba(255, 193, 7, 0.3);
        padding: 1rem;
        border-radius: 12px;
        width: 100%;
        color: #856404;
    }

    .warning-text strong {
        display: block;
        font-size: 0.95rem;
        margin-bottom: 0.2rem;
    }

    .warning-text p {
        margin: 0;
        font-size: 0.85rem;
        opacity: 0.8;
    }

    /* Workshop Integration Styles */
    .workshop-integration {
        padding: 1rem 0;
    }
    .workshop-mini-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
    }
    .mini-item {
        background: var(--input-background);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transition: transform 0.2s;
    }
    .mini-item:hover {
        transform: translateY(-2px);
        border-color: var(--primary-color);
    }
    .mini-item img {
        width: 100%;
        height: 100px;
        object-fit: cover;
    }
    .mini-info {
        padding: 0.8rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .mini-info span {
        font-size: 0.85rem;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .mini-info button {
        background: var(--primary-color);
        color: white;
        border: none;
        border-radius: 6px;
        padding: 0.4rem;
        font-size: 0.75rem;
        cursor: pointer;
    }
    .plugin-icon {
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--hover-background);
        font-size: 2rem;
        color: var(--primary-color);
    }
    .view-all {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--primary-color);
        text-decoration: none;
        font-size: 0.85rem;
        font-weight: 600;
    }
    .view-all:hover {
        text-decoration: underline;
    }
    .workshop-section h4 {
        margin: 0 0 1rem 0;
        font-size: 1rem;
        color: var(--text-color);
    }
    .error-msg {
        color: #ff4757;
        font-size: 0.9rem;
        padding: 1rem;
        background: rgba(255, 71, 87, 0.1);
        border-radius: 8px;
    }

    .report-btn {
        margin-left: auto;
        padding: 0.6rem 1.2rem;
        background: #ffc107;
        color: #000;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.85rem;
        transition: all 0.2s;
        white-space: nowrap;
    }

    .report-btn:hover {
        background: #ffca2c;
        transform: translateY(-1px);
    }

    @media (max-width: 600px) {
        .latency-warning {
            flex-direction: column;
            align-items: flex-start;
        }
        .report-btn {
            margin-left: 0;
            width: 100%;
            text-align: center;
        }
    }
    .sample-box {
        background: var(--card-background);
        border: 1px dashed var(--border-color);
        padding: 1.2rem;
        border-radius: 12px;
        transition: all 0.2s;
    }
    .sample-box:hover {
        border-style: solid;
        border-color: var(--primary-color);
        transform: translateY(-2px);
    }
    .sample-box strong {
        display: block;
        margin-bottom: 0.8rem;
        color: var(--primary-color);
        font-size: 1rem;
    }
    .sample-box ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    .sample-box li {
        font-size: 0.85rem;
        color: var(--text-color-secondary);
        margin-bottom: 0.4rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .sample-box li::before {
        content: "•";
        color: var(--primary-color);
    }


    /* Switch Toggle Styles */
    .switch {
        position: relative;
        display: inline-block;
        width: 50px;
        height: 24px;
    }

    .switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }

    .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #ccc;
        transition: 0.4s;
        border-radius: 24px;
    }

    .slider:before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: 0.4s;
        border-radius: 50%;
    }

    input:checked + .slider {
        background-color: var(--primary-color);
    }

    input:focus + .slider {
        box-shadow: 0 0 1px var(--primary-color);
    }

    input:checked + .slider:before {
        transform: translateX(26px);
    }

    /* Setting Actions */
    .setting-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        border: 1px solid transparent;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        font-weight: 500;
        text-decoration: none;
        cursor: pointer;
        transition: all 0.2s;
    }

    .btn-outline {
        background: transparent;
        color: var(--primary-color);
        border-color: var(--primary-color);
    }

    .btn-outline:hover {
        background: var(--primary-color);
        color: white;
    }

    /* Bangs Preview Section */
    .bangs-preview {
        margin-top: 1.5rem;
    }

    .bangs-preview h4 {
        font-size: 1rem;
        margin: 0 0 1rem 0;
        color: var(--text-color);
        font-weight: 600;
    }

    .bangs-quick-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1rem;
    }

    .bang-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem;
        background-color: var(--card-background);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        transition:
            transform 0.2s,
            box-shadow 0.2s;
    }

    .bang-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .bang-item code {
        background-color: var(--primary-color);
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-family: "Courier New", monospace;
        font-size: 0.85rem;
        font-weight: 600;
    }

    .bang-item span {
        color: var(--text-color);
        font-size: 0.9rem;
    }

    .btn-primary {
        background-color: var(--primary-color);
        color: white;
        border-color: var(--primary-color);
    }

    .btn-primary:hover {
        background-color: var(--primary-color-hover);
    }

    @media (max-width: 768px) {
        .shortcuts-list {
            gap: 0.5rem;
        }

        .shortcut-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
        }

        .api-info {
            grid-template-columns: 1fr;
        }

        /* Hide dropdown icons on mobile */
        .dropdown-icon {
            display: none !important;
        }

        /* Settings Page Responsive */
        .settings-page {
            padding: 0 12px;
        }

        .settings-header {
            position: relative;
            left: -12px;
            width: calc(100% + 24px);
            padding: 1rem 12px;
        }

        .page-title h1 {
            font-size: 1.5rem;
        }

        .tabs {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 0.5rem;
        }

        .tab {
            padding: 0.5rem 1rem;
            font-size: 0.9rem;
            white-space: nowrap;
            flex-shrink: 0;
        }

        .section {
            padding: 1rem 0;
        }

        .section-heading {
            font-size: 1.25rem;
        }

        .setting-card {
            padding: 1rem;
        }

        .setting-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
        }

        .setting-actions {
            width: 100%;
            justify-content: flex-start;
        }

        .btn {
            width: 100%;
            justify-content: center;
        }

        .text-input,
        select {
            width: 100%;
        }

        .logo-grid {
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 0.75rem;
        }

        .logo-preview {
            height: 60px;
        }

        .logo-name {
            font-size: 0.75rem;
        }
    }

    @media (max-width: 480px) {
        .settings-page {
            padding: 0 12px;
        }

        .page-title h1 {
            font-size: 1.25rem;
        }

        .section {
            padding: 0.75rem 0;
        }

        .section-heading {
            font-size: 1.1rem;
        }

        .setting-card {
            padding: 0.75rem;
        }

        .setting-info h3 {
            font-size: 1rem;
        }

        .setting-info p {
            font-size: 0.9rem;
        }

        .logo-grid {
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 0.5rem;
        }

        .logo-preview {
            height: 50px;
        }

        .btn {
            padding: 0.5rem 1rem;
            font-size: 0.9rem;
        }

        /* Hybrid Proxy Mobile Responsive */

        .setting-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
        }

        .setting-info {
            width: 100%;
        }

        .setting-info h3 {
            font-size: 1rem;
        }

        .setting-info p {
            font-size: 0.85rem;
            line-height: 1.4;
        }

        .text-input,
        select {
            width: 100%;
            font-size: 0.9rem;
        }

        .divider {
            margin: 1rem 0;
        }
    }
</style>
