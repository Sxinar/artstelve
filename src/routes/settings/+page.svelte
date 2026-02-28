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
    } from "$lib/stores.js";

    let notifications = false;
    let activeTab = "Temel Ayarlar";

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

    $: if (activeTab === "Hybrid Proxy" && proxyLatency === null) {
        pingProxy();
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
            label: "hybridProxy",
        },
        {
            id: "Çeviri",
            icon: "fas fa-language",
            label: "Translate",
            show: true,
        },
        { id: "Bangs", icon: "fas fa-bolt", label: "Bangs" },
        { id: "Gelişmiş", icon: "fas fa-tools", label: "advanced" },
        { id: "Özel CSS", icon: "fas fa-code", label: "customCSS" },
    ];

    $: filteredTabs = $enableTranslatePlugin
        ? tabs
        : tabs.filter((tab) => tab.id !== "Çeviri");

    // --- Helper Functions ---
    function applyPresetCSS(preset) {
        const presets = {
            minimal: `
/* Minimal Theme */
.result-item-card { border: none; box-shadow: 0 1px 3px rgba(0,0,0,0.05); background: var(--card-background); }
.sidebar { backdrop-filter: none; background: var(--card-background); }`,
            glassmorphism: `
/* Glassmorphism Theme */
.result-item-card { background: rgba(255,255,255,0.1); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1); }
.sidebar { background: rgba(255,255,255,0.1); backdrop-filter: blur(12px); border-right: 1px solid rgba(255,255,255,0.1); }`,
            neon: `
/* Neon Theme */
.result-item-card { background: #000; border: 1px solid #0f0; box-shadow: 0 0 10px #0f0; color: #0f0; }
.result-title a { color: #0f0 !important; text-shadow: 0 0 5px #0f0; }`,
            retroTerminal: `
/* Retro Terminal */
body { font-family: 'Courier New', Courier, monospace; }
.result-item-card { border: 1px dashed var(--primary-color); box-shadow: none; border-radius: 0; }
.search-box { border-radius: 0; border: 2px solid var(--primary-color); }`,
            cyberpunk: `
/* Cyberpunk */
.result-item-card { clip-path: polygon(0 0, 100% 0, 100% 85%, 95% 100%, 0 100%); border-left: 5px solid #f0e; border-right: 5px solid #0ff; background: #0a0a0f; }
h1, h2, h3 { text-transform: uppercase; letter-spacing: 2px; }`,
            bubbleGum: `
/* Bubble Gum */
.result-item-card { border-radius: 20px; border: 3px solid #ffb7b2; background: #fff0f5; }
.search-box { border: 3px solid #ff9aa2; }
.sidebar { background: #ffdac1; }`,
            midnightOled: `
/* Midnight OLED */
:root { --background-color: #000000; --card-background: #0a0a0a; --text-color: #ffffff; --border-color: #222; }
body { background: #000 !important; }
.result-item-card { border: 1px solid #333; box-shadow: none; }`,
            matrix: `
/* Matrix Green */
:root { --primary-color: #00ff41; --text-color: #00ff41; --background-color: #000; --card-background: #050505; }
* { font-family: 'Courier New', monospace !important; }
.result-item-card { border: 1px solid #00ff41; box-shadow: 0 0 5px #00ff41; }
a { color: #00ff41 !important; }`,
            lavenderMist: `
/* Lavender Mist */
:root { --primary-color: #9d50bb; --background-color: #f8f9ff; --card-background: #ffffff; --text-color: #2d3436; }
.result-item-card { border: none; border-radius: 24px; box-shadow: 0 10px 30px rgba(157, 80, 187, 0.05); }
.search-box { border-radius: 30px; background: #fff; border: 1px solid #eee; }`,
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
        const settings = {
            selectedTheme: $selectedTheme,
            customCss: $customCssStore,
            aiSummaryEnabled: $aiSummaryEnabled,
            selectedLanguage: $selectedLanguage,
            selectedEngine: $selectedEngine,
            hybridProxyBaseUrl: $hybridProxyBaseUrl,
            hybridProxyEngines: $hybridProxyEngines,
            hybridProxyLimitPerEngine: $hybridProxyLimitPerEngine,
            hybridProxyLimitTotal: $hybridProxyLimitTotal,
            hybridProxyTimeoutMs: $hybridProxyTimeoutMs,
            hybridProxyCache: $hybridProxyCache,
            themeMode: $themeMode,
            uiDensity: $uiDensity,
            fontScale: $fontScale,
            cornerRadius: $cornerRadius,
            accentColor: $accentColor,
            safeSearch: $safeSearch,
            blockedSites: $blockedSites,
            searchHomeDesign: $searchHomeDesign,
            showNavbarSubCategory: $showNavbarSubCategory,
            bangsOpenNewTab: $bangsOpenNewTab,
        };
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

                        <div class="setting-group">
                            <div class="setting-info">
                                <label for="engine-select">Arama Kaynağı</label>
                                <p>Sonuçların getirileceği güvenli katman.</p>
                            </div>
                            <div class="setting-control">
                                <div class="enhanced-select">
                                    <select
                                        id="engine-select"
                                        bind:value={$selectedEngine}
                                    >
                                        <option value="Hybrid Proxy"
                                            >Artado Proxy (Önerilen)</option
                                        >
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="divider"></div>

                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>Otomatik Tamamlama</h3>
                                <p>Arama çubuğunda önerileri göster.</p>
                            </div>
                            <label class="switch">
                                <input
                                    type="checkbox"
                                    bind:checked={$enableSuggestions}
                                />
                                <span class="slider"></span>
                            </label>
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
                                <h3>{$t("accentColor")}</h3>
                                <p>Uygulama genelinde vurgu rengini seçin.</p>
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
                    <h2 class="section-heading">Hybrid Proxy</h2>
                    <div class="setting-card">
                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>Proxy Base URL</h3>
                                <p>
                                    Varsayılan:
                                    https://artstelve-proxy.vercel.app/ — kendi
                                    proxy sunucunuzu kullanıyorsanız burayı
                                    güncelleyin. host ederek kendi sunucunuzu
                                    kullanabilirsiniz.
                                </p>
                            </div>
                            <input
                                class="text-input"
                                type="text"
                                bind:value={$hybridProxyBaseUrl}
                                placeholder="https://artstelve-proxy.vercel.app/"
                            />
                        </div>

                        <div class="divider"></div>

                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>Engines</h3>
                                <p>
                                    Virgülle ayırın. Varsayılan:
                                    duckduckgo,yahoo,yandex,brave,startpage,qwant,ecosia,mojeek,ask,aol
                                </p>
                            </div>
                            <input
                                class="text-input"
                                type="text"
                                bind:value={$hybridProxyEngines}
                                placeholder="duckduckgo,yahoo,yandex,brave,startpage,qwant,ecosia,mojeek,ask,aol"
                            />
                        </div>

                        <div class="divider"></div>

                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>Limit (per engine)</h3>
                                <p>
                                    Her motor için maksimum sonuç sayısı (1-20).
                                </p>
                            </div>
                            <input
                                class="text-input"
                                type="number"
                                min="1"
                                max="20"
                                bind:value={$hybridProxyLimitPerEngine}
                            />
                        </div>

                        <div class="divider"></div>

                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>Toplam Sonuç</h3>
                                <p>
                                    Arama başına getirilecek toplam sonuç
                                    (1-100). Varsayılan: 20
                                </p>
                            </div>
                            <input
                                class="text-input"
                                type="number"
                                min="1"
                                max="100"
                                bind:value={$hybridProxyLimitTotal}
                            />
                        </div>

                        <div class="divider"></div>

                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>Timeout (ms)</h3>
                                <p>Proxy arama timeout (3000-30000).</p>
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

                        <div
                            class="setting-row"
                            style="flex-direction: column; align-items: flex-start; gap: 1rem;"
                        >
                            <div
                                style="display: flex; justify-content: space-between; width: 100%; align-items: center;"
                            >
                                <div class="setting-info">
                                    <h3>Hız Testi</h3>
                                    <p>
                                        Proxy sunucusunun yanıt süresini kontrol
                                        edin.
                                    </p>
                                </div>
                                <button
                                    class="button"
                                    onclick={pingProxy}
                                    disabled={isTestingProxy}
                                >
                                    <i
                                        class="fas fa-sync-alt"
                                        class:fa-spin={isTestingProxy}
                                    ></i>
                                    {proxyLatency !== null
                                        ? `${proxyLatency} ms`
                                        : "Test Et"}
                                </button>
                            </div>

                            {#if proxyLatency !== null && (proxyLatency > 400 || proxyLatency === "Hata")}
                                <div class="latency-warning" in:fade>
                                    <i class="fas fa-exclamation-triangle"></i>
                                    <div class="warning-text">
                                        <strong>Düşük Hız Algılandı!</strong>
                                        <p>
                                            Proxy hızı oldukça yavaş görünüyor.
                                            Bu durum arama sonuçlarını
                                            etkileyebilir.
                                        </p>
                                    </div>
                                    <a
                                        href="mailto:sxi@artadosearch.com?subject=Artado%20Proxy%20Gecikme%20Raporu&body=Merhaba%2C%0A%0AProxy%20gecikmesi%3A%20{proxyLatency}%20ms%0AProxy%20URL%3A%20{$hybridProxyBaseUrl}%0A%0AProblem%20detaylar%C4%B1%3A"
                                        class="report-btn"
                                    >
                                        Hızı Bildir
                                    </a>
                                </div>
                            {/if}
                        </div>
                    </div>
                </section>
            {:else if activeTab === "Çeviri"}
                <section in:slide={{ duration: 300 }}>
                    <h2 class="section-heading">Çeviri Ayarları</h2>

                    <div class="setting-card">
                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>Çeviri Eklentisi</h3>
                                <p>
                                    Çeviri özelliklerini aktif veya pasif hale
                                    getirin.
                                </p>
                            </div>
                            <div class="setting-control">
                                <label class="switch">
                                    <input
                                        type="checkbox"
                                        bind:checked={$enableTranslatePlugin}
                                    />
                                    <span class="slider"></span>
                                </label>
                            </div>
                        </div>

                        {#if $enableTranslatePlugin}
                            <div class="setting-row">
                                <div class="setting-info">
                                    <h3>Hızlı Çeviri Komutları</h3>
                                    <p>
                                        Çeviri eklentisini kullanarak metinleri
                                        farklı dillere çevirin.
                                    </p>
                                </div>
                            </div>

                            <div class="sample-box">
                                <strong>Komut Örnekleri</strong>
                                <ul>
                                    <li>
                                        <code>!tr hello</code> - İngilizce'den Türkçe'ye
                                    </li>
                                    <li>
                                        <code>!en merhaba</code> - Türkçe'den İngilizce'ye
                                    </li>
                                    <li>
                                        <code>!de hello</code> - İngilizce'den Almanca'ya
                                    </li>
                                    <li>
                                        <code>!fr bonjour</code> - Fransızca'dan
                                        Türkçe'ye
                                    </li>
                                    <li><code>!tr</code> - Dil seçim ekranı</li>
                                </ul>
                            </div>
                        {/if}
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
                                    Bang komutlarını her zaman yeni bir sekmede
                                    açar.
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
                            <button onclick={() => applyPresetCSS("minimal")}
                                >Minimal</button
                            >
                            <button
                                onclick={() => applyPresetCSS("glassmorphism")}
                                >Glassmorphism</button
                            >
                            <button
                                onclick={() => applyPresetCSS("midnightOled")}
                                aria-label="Midnight OLED Tema Uygula"
                                >Midnight OLED</button
                            >
                            <button
                                onclick={() => applyPresetCSS("matrix")}
                                aria-label="Matrix Green Tema Uygula"
                                >Matrix</button
                            >
                            <button
                                onclick={() => applyPresetCSS("lavenderMist")}
                                aria-label="Lavender Mist Tema Uygula"
                                >Lavender</button
                            >
                        </div>
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
                            Tüm ayarlarınızı dışa aktarın veya önceden aldığınız
                            bir yedeği geri yükleyin.
                        </p>
                        <div class="action-buttons">
                            <button
                                class="button primary"
                                onclick={backupSettings}
                            >
                                <i class="fas fa-download"></i> Ayarları Yedekle
                                (İndir)
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

    /* Çeviri Ayarları Stilleri */
    .shortcuts-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-top: 1rem;
    }

    .shortcut-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        background: var(--hover-background);
        border-radius: 8px;
        border: 1px solid var(--border-color);
    }

    .shortcut-item kbd {
        background: var(--card-background);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        padding: 0.3rem 0.6rem;
        font-size: 0.8rem;
        font-family: "Courier New", monospace;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .shortcut-item span {
        flex: 1;
        font-weight: 500;
    }

    .api-info {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-top: 1rem;
    }

    .api-item {
        padding: 0.8rem;
        background: var(--hover-background);
        border-radius: 8px;
        border: 1px solid var(--border-color);
        font-size: 0.9rem;
    }

    .api-item strong {
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
