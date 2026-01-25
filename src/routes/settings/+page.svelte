<script lang="js">
    import { getContext, onMount } from "svelte";
    import { writable } from "svelte/store";
    import { browser } from "$app/environment";
    import { t } from "$lib/i18n.js";
    import { fade, slide, fly } from "svelte/transition";

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
        { id: "Arayüz", icon: "fas fa-desktop", label: "interface" },
        {
            id: "Hybrid Proxy",
            icon: "fas fa-network-wired",
            label: "hybridProxy",
        },

        { id: "Gelişmiş", icon: "fas fa-tools", label: "advanced" },
        { id: "Eklentiler", icon: "fas fa-puzzle-piece", label: "plugins" },

        { id: "Özel CSS", icon: "fas fa-code", label: "customCSS" },
    ];

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
        };
        const blob = new Blob([JSON.stringify(settings, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `artstelve_settings_${new Date().toISOString().slice(0, 10)}.json`;
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
        isLoadingWorkshop.set(true);
        try {
            const response = await fetch("/api/workshop/items");
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    themes.set(data.themes || []);

                    // Separate plugins and logos
                    const allPlugins = data.plugins || [];
                    const _plugins = [];
                    const _logos = [];
                    const _homeThemes = [];

                    allPlugins.forEach((p) => {
                        const type = (p.category || "").toLowerCase();
                        const u = (p.download_url || "").toLowerCase();
                        if (type === "ana-sayfa" || type === "home") {
                            _homeThemes.push(p);
                        } else if (
                            u.endsWith(".png") ||
                            u.endsWith(".jpg") ||
                            u.endsWith(".jpeg") ||
                            u.endsWith(".gif") ||
                            u.endsWith(".svg") ||
                            u.endsWith(".webp")
                        ) {
                            _logos.push(p);
                        } else {
                            _plugins.push(p);
                        }
                    });

                    plugins.set(_plugins);
                    logos.set(_logos);
                    homeThemes.set(_homeThemes);
                    workshopError.set(null);
                } else {
                    workshopError.set(
                        data.error || "Bilinmeyen bir API hatası oluştu.",
                    );
                }
            } else {
                workshopError.set(`Sunucu hatası: ${response.status}`);
            }
        } catch (err) {
            console.error(err);
            workshopError.set("Bağlantı hatası: " + err.message);
        } finally {
            isLoadingWorkshop.set(false);
        }
    }

    async function installItem(item, type) {
        if (installingId) return;
        installingId = item.id;
        try {
            const res = await fetch("/api/workshop/install", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    downloadUrl: item.download_url,
                    type: type,
                    name: item.name,
                    id: item.id,
                }),
            });
            const result = await res.json();
            if (result.success) {
                alert("Başarıyla indirildi!");
                fetchInstalledThemes(); // Listeyi yenile
            } else {
                alert("Hata: " + result.error);
            }
        } catch (e) {
            alert("Hata: " + e.message);
        } finally {
            installingId = null;
        }
    }

    onMount(() => {
        if (browser) {
            fetchWorkshopItems();
            fetchInstalledThemes();
            fetchInstalledPlugins();
            document.body.classList.add("settings-active");
            return () => document.body.classList.remove("settings-active");
        }
    });

    let installedThemesList = [];
    async function fetchInstalledThemes() {
        try {
            const res = await fetch("/api/workshop/themes");
            if (res.ok) {
                const data = await res.json();
                installedThemesList = data.themes || [];
            }
        } catch (e) {
            console.error("Failed to fetch installed themes:", e);
        }
    }
    async function uninstallItem(id, type) {
        if (
            !confirm(
                "Bu " +
                    (type === "theme" ? "temayı" : "eklentiyi") +
                    " silmek istediğinize emin misiniz?",
            )
        )
            return;

        try {
            const res = await fetch("/api/workshop/uninstall", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, type }),
            });
            const result = await res.json();
            if (result.success) {
                // Eğer silinen tema şu an seçiliyse varsayılana dön
                if (type === "theme" && $selectedTheme === id) {
                    selectedTheme.set("klasik");
                }
                fetchInstalledThemes();
                fetchInstalledPlugins();
                alert("Başarıyla kaldırıldı.");
            } else {
                alert("Hata: " + result.error);
            }
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
</script>

<svelte:head>
    <title>{$t("settings")} - Stelve</title>
</svelte:head>

<div class="settings-page" transition:fade={{ duration: 300 }}>
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
                    {#each tabs as tab}
                        <li>
                            <button
                                class:active={activeTab === tab.id}
                                on:click={() => (activeTab = tab.id)}
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
                                <i class="fas fa-chevron-down dropdown-icon"
                                ></i>
                            </div>
                        </div>

                        <div class="divider"></div>

                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>{$t("searchEngine")}</h3>
                                <p>Varsayılan arama motorunuzu belirleyin.</p>
                            </div>
                            <div class="select-wrapper">
                                <select bind:value={$selectedEngine}>
                                    <option value="Hybrid Proxy"
                                        >Hybrid Proxy Sonuçları</option
                                    >
                                    <option value="Brave">Brave Search</option>
                                    <option value="DuckDuckGo"
                                        >DuckDuckGo</option
                                    >
                                    <option disabled>Google (Yakında)</option>
                                </select>
                                <i class="fas fa-chevron-down dropdown-icon"
                                ></i>
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
                                <h3>Güvenli Arama</h3>
                                <p>Uygunsuz içerikleri filtreleyin.</p>
                            </div>
                            <label class="switch">
                                <input
                                    type="checkbox"
                                    bind:checked={$safeSearch}
                                />
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
                                <i class="fas fa-chevron-down dropdown-icon"
                                ></i>
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
                                <i class="fas fa-chevron-down dropdown-icon"
                                ></i>
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

                        <div
                            class="setting-row"
                            style="align-items: flex-start; flex-direction: column; gap:1rem;"
                        >
                            <div class="setting-info">
                                <h3>Özel Logo</h3>
                                <p>
                                    Workshop'tan logo seçerek görünümü
                                    kişiselleştirin.
                                </p>
                            </div>

                            <div
                                class="logo-grid"
                                style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 1rem; width: 100%;"
                            >
                                <button
                                    class="logo-option"
                                    class:active={$customLogo === "/logo.png"}
                                    on:click={resetCustomLogo}
                                    title="Varsayılan"
                                >
                                    <div class="logo-preview default">
                                        <img
                                            src="/logo.png"
                                            alt="Varsayılan"
                                            style="max-height: 50px; width: auto;"
                                        />
                                    </div>
                                    <span class="logo-name">Varsayılan</span>
                                </button>

                                {#each $logos as logo}
                                    <button
                                        class="logo-option"
                                        class:active={$customLogo ===
                                            logo.download_url}
                                        on:click={() =>
                                            customLogo.set(logo.download_url)}
                                        title={logo.name}
                                    >
                                        <div class="logo-preview">
                                            <img
                                                src={logo.image_url ||
                                                    logo.download_url}
                                                alt={logo.name}
                                            />
                                        </div>
                                        <span class="logo-name"
                                            >{logo.name}</span
                                        >
                                    </button>
                                {/each}
                            </div>
                        </div>
                    </div>
                </section>

                <style>
                    .logo-option {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        border: 2px solid transparent; /* Prepare for border */
                        border-radius: 12px;
                        padding: 0.8rem;
                        background: var(--card-background);
                        transition: all 0.2s;
                        cursor: pointer;
                        border: 1px solid var(--border-color);
                        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
                    }
                    .logo-option:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
                    }
                    .logo-option.active {
                        border-color: var(--primary-color);
                        background: rgba(var(--primary-color-rgb), 0.08);
                        box-shadow: 0 0 0 2px var(--primary-color); /* Strong outline */
                    }
                    .logo-preview {
                        height: 80px;
                        width: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-bottom: 0.5rem;
                        border-radius: 8px;
                        background: var(
                            --background-image,
                            #f5f5f5
                        ); /* Fallback */
                        overflow: hidden;
                    }
                    .logo-preview img {
                        max-width: 100%;
                        max-height: 100%;
                        object-fit: contain;
                    }
                    .logo-name {
                        font-size: 0.85rem;
                        text-align: center;
                        color: var(--text-color);
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                        overflow: hidden;
                    }
                </style>
            {:else if activeTab === "Arayüz"}
                <section in:slide={{ duration: 300 }}>
                    <h2 class="section-heading">Arayüz ve Navigasyon</h2>
                    <div class="setting-card">
                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>Ana Sayfa Tasarımı</h3>
                                <p>
                                    Arama ana sayfasının görünümünü
                                    özelleştirin.
                                </p>
                            </div>
                            <div class="select-wrapper">
                                <select bind:value={$searchHomeDesign}>
                                    <optgroup label="Sistem Tasarımları">
                                        <option value="simple"
                                            >Benim için sade (Simple)</option
                                        >
                                        <option value="modern"
                                            >Modern & Canlı</option
                                        >
                                        <option value="artistic"
                                            >Sanatsal</option
                                        >
                                    </optgroup>
                                    {#if $homeThemes && $homeThemes.length > 0}
                                        <optgroup label="Workshop Temaları">
                                            {#each $homeThemes as hTheme}
                                                <option
                                                    value={hTheme.id ||
                                                        hTheme.name.toLowerCase()}
                                                >
                                                    {hTheme.name}
                                                </option>
                                            {/each}
                                        </optgroup>
                                    {/if}
                                </select>
                                <i class="fas fa-chevron-down dropdown-icon"
                                ></i>
                            </div>
                        </div>
                        <div class="divider"></div>
                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>Navbar Alt Kategori</h3>
                                <p>
                                    Navigasyon çubuğunda ek alt kategori göster.
                                </p>
                            </div>
                            <label class="switch">
                                <input
                                    type="checkbox"
                                    bind:checked={$showNavbarSubCategory}
                                />
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                </section>
            {:else if activeTab === "Hybrid Proxy"}
                <section in:slide={{ duration: 300 }}>
                    <h2 class="section-heading">Hybrid Proxy</h2>
                    <div class="setting-card">
                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>Proxy Base URL</h3>
                                <p>
                                    Varsayılan:
                                    https://artstelve-proxy.vercel.app/ — self
                                    host ederek kendi sunucunuzu
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
                                    on:click={pingProxy}
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
            {:else if activeTab === "Temalar"}
                <section in:slide={{ duration: 300 }}>
                    <h2 class="section-heading">{$t("themes")}</h2>
                    <div class="setting-card">
                        <div class="themes-grid">
                            {#each ["klasik", "koyu", "mavi", "pastel", "doga", "terminal", "gece-yarisi", "gunesli", "retro", "komur", "okyanus"] as theme}
                                <button
                                    class="theme-button"
                                    class:active={$selectedTheme === theme}
                                    on:click={() => selectedTheme.set(theme)}
                                >
                                    <div
                                        class="theme-preview-box {theme}"
                                    ></div>
                                    <span>{formatThemeName(theme)}</span>
                                </button>
                            {/each}

                            {#if installedThemesList.length > 0}
                                {#each installedThemesList as itheme}
                                    <div class="theme-button-wrapper">
                                        <button
                                            class="theme-button"
                                            class:active={$selectedTheme ===
                                                itheme.id}
                                            on:click={() =>
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
                                            on:click|stopPropagation={() =>
                                                uninstallItem(
                                                    itheme.id,
                                                    "theme",
                                                )}
                                            title="Temayı Sil"
                                        >
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                {/each}
                            {/if}
                        </div>

                        <h3 style="margin-top: 2rem;">Menü Temaları</h3>
                        <div class="themes-grid small">
                            <button
                                class="theme-button"
                                on:click={() => applySidebarTheme("default")}
                            >
                                <div
                                    class="theme-preview-box small sidebar-default"
                                ></div>
                                <span>Varsayılan</span>
                            </button>
                            <button
                                class="theme-button"
                                on:click={() => applySidebarTheme("gradient")}
                            >
                                <div
                                    class="theme-preview-box small sidebar-gradient"
                                ></div>
                                <span>Gradient</span>
                            </button>
                            <button
                                class="theme-button"
                                on:click={() => applySidebarTheme("glass")}
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
                            <button on:click={() => applyPresetCSS("minimal")}
                                >Minimal</button
                            >
                            <button
                                on:click={() => applyPresetCSS("glassmorphism")}
                                >Glassmorphism</button
                            >
                            <button on:click={() => applyPresetCSS("neon")}
                                >Neon</button
                            >
                        </div>
                        <textarea
                            bind:value={$customCssStore}
                            on:input={(e) => applyCustomCss(e.target.value)}
                            rows="12"
                            placeholder="/* CSS kodunuzu buraya yazın... */"
                            class="css-editor"
                        ></textarea>
                        <button
                            class="button danger"
                            style="margin-top: 1rem;"
                            on:click={() => applyCustomCss("")}>Temizle</button
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
                                on:click={backupSettings}
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
                                    on:change={restoreSettings}
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
                                            on:click={() =>
                                                removeBlockedSite(site)}
                                            title="Engeli Kaldır"
                                        >
                                            <i class="fas fa-times"></i>
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
                                on:click={fetchWorkshopItems}
                                >Tekrar Dene</button
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
                                                {#if installedThemesList.some((t) => t.id === theme.id || t.id === theme.name
                                                                .replace(/[^a-z0-9]/gi, "_")
                                                                .toLowerCase())}
                                                    <button
                                                        class="button primary small"
                                                        style="background-color: var(--error-color, #dc3545); color: white;"
                                                        on:click={() =>
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
                                                        on:click={() =>
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
                                                            : "Yükle"}
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
                                                        on:click={() =>
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
                                                    >
                                                        Kaldır
                                                    </button>
                                                {:else}
                                                    <button
                                                        class="button secondary small"
                                                        on:click={() =>
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
                                                            : "Yükle"}
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
                            <div class="divider"></div>

                            <div
                                class="setting-row"
                                style="flex-direction: column; align-items: flex-start;"
                            >
                                <h3 style="margin-bottom: 1rem;">
                                    <i class="fas fa-lightbulb"></i> Örnekler & İlham
                                </h3>
                                <div
                                    class="samples-grid"
                                    style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5rem; width: 100%;"
                                >
                                    <div class="sample-box">
                                        <strong>Eklentiler</strong>
                                        <ul>
                                            <li>Borsa & Döviz Takibi</li>
                                            <li>Kod Formatlayıcı (Prettier)</li>
                                            <li>Birim Dönüştürücü</li>
                                            <li>Profesyonel Çevirmen</li>
                                            <li>Hava Durumu Widget</li>
                                        </ul>
                                    </div>
                                    <div class="sample-box">
                                        <strong>Temalar</strong>
                                        <ul>
                                            <li>Gece Parıltısı (Midnight)</li>
                                            <li>Sonbahar Esintisi</li>
                                            <li>Cyberpunk Kırmızı</li>
                                            <li>Minimalist Beyaz</li>
                                            <li>Derin Okyanus Mavisi</li>
                                        </ul>
                                    </div>
                                    <div class="sample-box">
                                        <strong>Ana Sayfa</strong>
                                        <ul>
                                            <li>Zen Bahçesi</li>
                                            <li>Geometrik Desenler</li>
                                            <li>Soyut Akışkanlık</li>
                                            <li>Antika Kağıt Dokusu</li>
                                            <li>Kozmik Bulutsu (Cosmic)</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
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
        color: var(--text-color);
        font-family: "Inter", sans-serif;
    }

    .settings-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.5rem 3rem;
        background: var(--card-background);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        position: sticky;
        top: 0;
        z-index: 100;
        backdrop-filter: blur(10px);
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
        .settings-header {
            padding: 1rem 1.5rem;
        }
        .settings-title {
            font-size: 1.2rem;
        }
        .back-button span {
            display: none;
        }
        .setting-card {
            padding: 1.5rem;
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
</style>
