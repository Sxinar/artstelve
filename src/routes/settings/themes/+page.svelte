<script lang="js">
    import { getContext, onMount } from "svelte";
    import { writable } from "svelte/store";
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";
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
    } from "$lib/stores.js";

    let notifications = false;
    let activeTab = "Temalar";

    // --- Workshop Items ---
    let themes = writable([]);
    let plugins = writable([]); // Plugins store'u tanımlandı
    let homeThemes = writable([]);
    let logos = writable([]);
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
                    
                    // Ana sayfa temaları ve logoları plugins dizisinden ayır
                    const allPlugins = data.plugins || [];
                    const _homeThemes = [];
                    const _logos = [];

                    allPlugins.forEach((p) => {
                        const type = (p.category || "").toLowerCase();
                        const u = (p.download_url || "").toLowerCase();
                        if (type === "home" || type === "ana_sayfa") {
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
                        }
                    });

                    plugins.set(allPlugins); // Tüm plugins (ana sayfa temaları dahil)
                    homeThemes.set(_homeThemes);
                    logos.set(_logos);
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

    async function applyWorkshopItem(item, type) {
        if (!item.download_url) return;

        if (type === "theme") {
            if (item.category === "home") {
                searchHomeDesign.set(item.download_url);
                alert("Ana sayfa teması seçildi!");
            } else {
                try {
                    console.log("[Themes] Starting theme application for:", item.name, "ID:", item.id);
                    console.log("[Themes] Download URL:", item.download_url);
                    
                    // Use server-side proxy to fetch CSS content
                    const response = await fetch(`/api/workshop/css?url=${encodeURIComponent(item.download_url)}`);
                    if (!response.ok) {
                        throw new Error(`CSS yüklenemedi: ${response.status}`);
                    }
                    const cssContent = await response.text();
                    console.log("[Themes] CSS content length:", cssContent.length);
                    console.log("[Themes] CSS content preview:", cssContent.substring(0, 200));
                    
                    // Extract theme class name from CSS content
                    let themeClass = null;
                    try {
                        console.log("[Themes] Attempting CSS extraction...");
                        const themeClassMatch = cssContent.match(/body\.(\w+)\s*\{/);
                        console.log("[Themes] Theme class match result:", themeClassMatch);
                        themeClass = themeClassMatch ? themeClassMatch[1] : null;
                        console.log("[Themes] Extracted theme class:", themeClass);
                    } catch (error) {
                        console.error("[Themes] Error extracting theme class:", error);
                        console.error("[Themes] Error details:", error.message, error.stack);
                    }
                    
                    // Remove all existing workshop theme classes
                    console.log("[Themes] Removing existing theme classes...");
                    const existingStyles = document.querySelectorAll('style[id^="workshop-theme-"]');
                    console.log("[Themes] Found existing styles:", existingStyles.length);
                    
                    existingStyles.forEach((style, index) => {
                        console.log(`[Themes] Processing style ${index}:`, style.id);
                        try {
                            if (style.textContent) {
                                console.log(`[Themes] Style ${index} content length:`, style.textContent.length);
                                const classMatch = style.textContent.match(/body\.(\w+)\s*\{/);
                                console.log(`[Themes] Style ${index} class match:`, classMatch);
                                if (classMatch && classMatch[1]) {
                                    console.log(`[Themes] Removing class:`, classMatch[1]);
                                    document.body.classList.remove(classMatch[1]);
                                }
                            } else {
                                console.log(`[Themes] Style ${index} has no textContent`);
                            }
                        } catch (error) {
                            console.error("[Themes] Error removing theme class:", error);
                            console.error("[Themes] Error details:", error.message, error.stack);
                        }
                    });
                    
                    // Apply the CSS by creating a style element
                    const styleId = `workshop-theme-${item.id}`;
                    console.log("[Themes] Creating style element with ID:", styleId);
                    let styleElement = document.getElementById(styleId);
                    
                    if (styleElement) {
                        console.log("[Themes] Updating existing style element");
                        styleElement.textContent = cssContent;
                    } else {
                        console.log("[Themes] Creating new style element");
                        styleElement = document.createElement('style');
                        styleElement.id = styleId;
                        styleElement.textContent = cssContent;
                        document.head.appendChild(styleElement);
                    }
                    
                    // Apply the theme class to body if found
                    if (themeClass) {
                        console.log("[Themes] Applying body class:", themeClass);
                        document.body.classList.add(themeClass);
                        console.log("[Themes] Body classes after adding:", document.body.classList.toString());
                    } else {
                        console.log("[Themes] No theme class found to apply");
                    }
                    
                    // Set theme identifier
                    selectedTheme.set(item.id);
                    alert(`"${item.name}" teması başarıyla uygulandı!`);
                } catch (error) {
                    console.error('Tema yüklenirken hata:', error);
                    console.error('Tema yükleme hatası detayları:', error.message, error.stack);
                    alert(`Tema yüklenemedi: ${error.message}`);
                }
            }
        }
    }

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
        if (browser) {
            fetchWorkshopItems();
            fetchInstalledThemes();
            document.body.classList.add("settings-active");
            
            // Reload active workshop themes
            reloadActiveThemes();
            
            return () => {
                document.body.classList.remove("settings-active");
            };
        }
    });

    // Function to reload active workshop themes
    async function reloadActiveThemes() {
        try {
            const response = await fetch("/api/workshop/items");
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const themes = data.themes || [];
                    const activeThemeId = $selectedTheme;
                    
                    // Only proceed if activeThemeId is a valid string
                    if (!activeThemeId || typeof activeThemeId !== 'string') {
                        console.log("[Themes] No valid active theme to reload");
                        return;
                    }
                    
                    // Find and reload the active theme
                    const activeTheme = themes.find(t => t.id === activeThemeId && t.category !== "home");
                    if (activeTheme && activeTheme.download_url) {
                        try {
                            // Use server-side proxy to fetch CSS content
                            const cssResponse = await fetch(`/api/workshop/css?url=${encodeURIComponent(activeTheme.download_url)}`);
                            if (cssResponse.ok) {
                                const cssContent = await cssResponse.text();
                                
                                // Extract theme class name from CSS content
                                let themeClass = null;
                                try {
                                    const themeClassMatch = cssContent.match(/body\.(\w+)\s*\{/);
                                    themeClass = themeClassMatch ? themeClassMatch[1] : null;
                                } catch (error) {
                                    console.error("[Themes] Error extracting theme class during reload:", error);
                                }
                                
                                const styleId = `workshop-theme-${activeTheme.id}`;
                                let styleElement = document.getElementById(styleId);
                                
                                if (styleElement) {
                                    styleElement.textContent = cssContent;
                                } else {
                                    styleElement = document.createElement('style');
                                    styleElement.id = styleId;
                                    styleElement.textContent = cssContent;
                                    document.head.appendChild(styleElement);
                                }
                                
                                // Apply the theme class to body if found
                                if (themeClass) {
                                    document.body.classList.add(themeClass);
                                    console.log(`[Themes] Re-applied body class: ${themeClass}`);
                                }
                            }
                        } catch (error) {
                            console.error('Aktif tema yeniden yüklenemedi:', error);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Workshop temaları yüklenemedi:', error);
        }
    }

    let installedGeneralThemes = [];
    let installedHomeThemes = [];
    
    // Get active themes from stores instead of local files
    function getActiveThemes() {
        const activeThemes = [];
        const currentThemes = $themes;
        const currentPlugins = $plugins; // Plugins store'unu kullan
        
        console.log("[Themes] Debug - selectedTheme:", $selectedTheme, "Type:", typeof $selectedTheme);
        console.log("[Themes] Debug - searchHomeDesign:", $searchHomeDesign, "Type:", typeof $searchHomeDesign);
        console.log("[Themes] Debug - currentThemes:", currentThemes);
        console.log("[Themes] Debug - currentPlugins:", currentPlugins);
        
        // Add currently selected theme if it's a workshop theme
        const selectedThemeValue = $selectedTheme;
        if (selectedThemeValue && typeof selectedThemeValue === 'string') {
            try {
                const isWorkshopTheme = selectedThemeValue.startsWith('http://') || selectedThemeValue.startsWith('https://');
                if (isWorkshopTheme) {
                    // Find this theme in workshop themes
                    const workshopTheme = currentThemes.find(t => t.download_url === selectedThemeValue);
                    if (workshopTheme) {
                        activeThemes.push({
                            ...workshopTheme,
                            id: workshopTheme.download_url,
                            category: 'general'
                        });
                        console.log("[Themes] Added site theme:", workshopTheme.name);
                    }
                }
            } catch (error) {
                console.error("[Themes] Error checking selectedTheme:", error, "Value:", selectedThemeValue);
            }
        }
        
        // Add currently selected home theme if it's a workshop theme
        const searchHomeDesignValue = $searchHomeDesign;
        if (searchHomeDesignValue && typeof searchHomeDesignValue === 'string') {
            try {
                const isWorkshopHomeTheme = searchHomeDesignValue.startsWith('http://') || searchHomeDesignValue.startsWith('https://');
                if (isWorkshopHomeTheme) {
                    // Find this theme in workshop plugins (ana sayfa temaları plugins içinde gelir)
                    const workshopHomeTheme = currentPlugins.find(t => t.download_url === searchHomeDesignValue && (t.category === 'home' || t.category === 'ana_sayfa'));
                    if (workshopHomeTheme) {
                        activeThemes.push({
                            ...workshopHomeTheme,
                            id: workshopHomeTheme.download_url,
                            category: 'home'
                        });
                        console.log("[Themes] Added home theme:", workshopHomeTheme.name);
                    }
                }
            } catch (error) {
                console.error("[Themes] Error checking searchHomeDesign:", error, "Value:", searchHomeDesignValue);
            }
        }
        
        console.log("[Themes] Active themes:", activeThemes);
        return activeThemes;
    }
    
    // Update installed themes when workshop themes or active themes change
    $: {
        const activeThemes = getActiveThemes();
        installedGeneralThemes = activeThemes.filter(t => t.category !== 'home');
        installedHomeThemes = activeThemes.filter(t => t.category === 'home');
    }

    // Since we're not downloading files anymore, uninstall removes from active items
    async function uninstallItem(id, type) {
        if (
            !confirm(
                "Bu temanın seçimini kaldırmak istediğinize emin misiniz?",
            )
        )
            return;

        try {
            if (type === "theme") {
                // Remove CSS style element if it exists
                const styleElement = document.getElementById(`workshop-theme-${id}`);
                if (styleElement) {
                    try {
                        // Extract theme class from CSS before removing
                        const cssContent = styleElement.textContent;
                        if (cssContent) {
                            const classMatch = cssContent.match(/body\.(\w+)\s*\{/);
                            if (classMatch && classMatch[1]) {
                                document.body.classList.remove(classMatch[1]);
                                console.log(`[Themes] Removed body class: ${classMatch[1]}`);
                            }
                        }
                    } catch (error) {
                        console.error("[Themes] Error extracting theme class during uninstall:", error);
                    }
                    styleElement.remove();
                }
                
                // If the theme being disabled is currently selected, reset to default
                if ($selectedTheme === id) {
                    selectedTheme.set("klasik");
                }
                if ($searchHomeDesign === id) {
                    searchHomeDesign.set("klasik");
                }
            }
            
            alert("Tema seçimi başarıyla kaldırıldı.");
        } catch (e) {
            alert("Hata: " + e.message);
        }
    }

    function formatThemeName(kebabCaseName) {
        if (!kebabCaseName) return "";
        return kebabCaseName
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
    }

    function resetCustomLogo() {
        customLogo.set("/logo.png");
    }
</script>

<svelte:head>
    <title>Temalar - Stelve</title>
</svelte:head>

<div class="settings-page" transition:fade={{ duration: 300 }}>
    <header class="settings-header">
        <div class="header-left">
            <a href="/settings" class="back-button" aria-label="Ayarlar">
                <i class="fas fa-arrow-left"></i>
                <span>Ayarlar</span>
            </a>
        </div>
        <h1 class="settings-title">Temalar</h1>
        <div class="header-right"></div>
    </header>

    <div class="settings-content-wrapper">
        <aside class="settings-sidebar">
            <nav aria-label="Temalar Menüsü">
                <ul>
                    <li>
                        <button
                            class:active={activeTab === "Temalar"}
                            on:click={() => (activeTab = "Temalar")}
                        >
                            <i class="fas fa-paint-brush"></i>
                            <span>Temalar</span>
                        </button>
                    </li>
                    <li>
                        <button
                            class:active={activeTab === "Ana Sayfa"}
                            on:click={() => (activeTab = "Ana Sayfa")}
                        >
                            <i class="fas fa-home"></i>
                            <span>Ana Sayfa Temaları</span>
                        </button>
                    </li>
                    <li>
                        <button
                            class:active={activeTab === "Logolar"}
                            on:click={() => (activeTab = "Logolar")}
                        >
                            <i class="fas fa-image"></i>
                            <span>Logolar</span>
                        </button>
                    </li>
                    <li>
                        <button
                            class:active={activeTab === "Yüklü"}
                            on:click={() => (activeTab = "Yüklü")}
                        >
                            <i class="fas fa-download"></i>
                            <span>Yüklü Temalar</span>
                        </button>
                    </li>
                    <li>
                        <button
                            class:active={activeTab === "Tema Modu"}
                            on:click={() => (activeTab = "Tema Modu")}
                        >
                            <i class="fas fa-adjust"></i>
                            <span>Tema Modu</span>
                        </button>
                    </li>
                </ul>
            </nav>
        </aside>

        <main class="settings-main-content">
            {#if activeTab === "Temalar"}
                <section in:slide={{ duration: 300 }}>
                    <h2 class="section-heading">Workshop Temaları</h2>
                    
                    {#if $isLoadingWorkshop}
                        <div class="setting-card">
                            <div style="text-align: center; padding: 2rem;">
                                <div class="spinner"></div>
                                <p>Temalar yükleniyor...</p>
                            </div>
                        </div>
                    {:else if $workshopError}
                        <div class="setting-card error-card">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>{$workshopError}</p>
                        </div>
                    {:else}
                        <div class="workshop-grid">
                            {#each $themes as theme}
                                <div class="setting-card workshop-item-card">
                                    <div class="item-header">
                                        <h3>{theme.name}</h3>
                                        <span class="item-category">{theme.category || "Genel"}</span>
                                    </div>
                                    <div class="item-content">
                                        <p>{theme.description || "Açıklama yok"}</p>
                                        <div class="item-meta">
                                            <span class="item-author">
                                                <i class="fas fa-user"></i>
                                                {theme.author || "Bilinmeyen"}
                                            </span>
                                            {#if theme.version}
                                                <span class="item-version">
                                                    <i class="fas fa-tag"></i>
                                                    v{theme.version}
                                                </span>
                                            {/if}
                                        </div>
                                    </div>
                                    <div class="item-actions">
                                        <button
                                            class="btn btn-primary"
                                            on:click={() => installItem(theme, "theme")}
                                            disabled={installingId === theme.id}
                                        >
                                            {#if installingId === theme.id}
                                                <i class="fas fa-spinner fa-spin"></i>
                                                Kuruluyor...
                                            {:else}
                                                <i class="fas fa-download"></i>
                                                Temayı Kur
                                            {/if}
                                        </button>
                                        {#if theme.download_url}
                                            <a
                                                href={theme.download_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="btn btn-outline"
                                            >
                                                <i class="fas fa-external-link-alt"></i>
                                                Önizle
                                            </a>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </section>
            {:else if activeTab === "Ana Sayfa"}
                <section in:slide={{ duration: 300 }}>
                    <h2 class="section-heading">Ana Sayfa Temaları</h2>
                    
                    {#if $isLoadingWorkshop}
                        <div class="loading-container">
                            <div class="spinner"></div>
                            <p>Ana sayfa temaları yükleniyor...</p>
                        </div>
                    {:else if $workshopError}
                        <div class="error-container">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>{$workshopError}</p>
                        </div>
                    {:else}
                        <div class="workshop-grid">
                            {#each $homeThemes as theme}
                                <div class="workshop-item">
                                    <div class="item-header">
                                        <h3>{theme.name}</h3>
                                        <span class="item-category">Ana Sayfa</span>
                                    </div>
                                    <div class="item-content">
                                        <p>{theme.description || "Açıklama yok"}</p>
                                        <div class="item-meta">
                                            <span class="item-author">
                                                <i class="fas fa-user"></i>
                                                {theme.author || "Bilinmeyen"}
                                            </span>
                                            {#if theme.version}
                                                <span class="item-version">
                                                    <i class="fas fa-tag"></i>
                                                    v{theme.version}
                                                </span>
                                            {/if}
                                        </div>
                                    </div>
                                    <div class="item-actions">
                                        <button
                                            class="btn btn-primary"
                                            on:click={() => installItem(theme, "theme")}
                                            disabled={installingId === theme.id}
                                        >
                                            {#if installingId === theme.id}
                                                <i class="fas fa-spinner fa-spin"></i>
                                                Seçiliyor...
                                            {:else}
                                                <i class="fas fa-check"></i>
                                                Temayı Seç
                                            {/if}
                                        </button>
                                        {#if theme.download_url}
                                            <a
                                                href={theme.download_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="btn btn-outline"
                                            >
                                                <i class="fas fa-external-link-alt"></i>
                                                Önizle
                                            </a>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </section>
            {:else if activeTab === "Logolar"}
                <section in:slide={{ duration: 300 }}>
                    <h2 class="section-heading">Logolar</h2>
                    
                    {#if $isLoadingWorkshop}
                        <div class="loading-container">
                            <div class="spinner"></div>
                            <p>Logolar yükleniyor...</p>
                        </div>
                    {:else if $workshopError}
                        <div class="error-container">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>{$workshopError}</p>
                        </div>
                    {:else}
                        <div class="logo-grid">
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
                    {/if}
                </section>

                <style>
                    .logo-option {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        border: 2px solid transparent;
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
                        box-shadow: 0 0 0 2px var(--primary-color);
                    }
                    .logo-preview {
                        height: 80px;
                        width: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-bottom: 0.5rem;
                        border-radius: 8px;
                        background: var(--background-image, #f5f5f5);
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
                    .logo-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                        gap: 1rem;
                        margin-top: 1rem;
                    }

                    /* Responsive Design */
                    @media (max-width: 768px) {
                        .settings-content-wrapper {
                            flex-direction: column;
                        }
                        
                        .settings-sidebar {
                            width: 100%;
                            border-right: none;
                            border-bottom: 1px solid var(--border-color, #e0e0e0);
                            padding: 1rem;
                        }
                        
                        .sidebar-header {
                            padding-bottom: 0.75rem;
                            margin-bottom: 1rem;
                        }
                        
                        .sidebar-header h2 {
                            font-size: 1.1rem;
                        }
                        
                        .sidebar-nav ul {
                            flex-direction: row;
                            overflow-x: auto;
                            padding-bottom: 0.5rem;
                            gap: 0.5rem;
                        }
                        
                        .sidebar-nav button {
                            padding: 0.5rem 1rem;
                            font-size: 0.85rem;
                            white-space: nowrap;
                            flex-shrink: 0;
                        }
                        
                        .sidebar-nav button i {
                            font-size: 0.9rem;
                        }
                        
                        .settings-main-content {
                            flex: 1;
                            padding: 2rem;
                            overflow-y: auto;
                            order: 1;
                            max-width: none;
                            width: 100%;
                        }
                        
                        .section-heading {
                            font-size: 1.5rem;
                        }
                        
                        .workshop-grid,
                        .installed-grid {
                            grid-template-columns: 1fr;
                            gap: 1rem;
                        }
                        
                        .workshop-item,
                        .installed-item {
                            padding: 1rem;
                        }
                        
                        .item-header {
                            gap: 0.75rem;
                        }
                        
                        .item-header h3 {
                            font-size: 1rem;
                        }
                        
                        .item-actions {
                            flex-direction: column;
                            gap: 0.5rem;
                        }
                        
                        .btn {
                            width: 100%;
                            justify-content: center;
                        }
                        
                        .logo-grid {
                            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                            gap: 0.75rem;
                        }
                        
                        .logo-preview {
                            height: 60px;
                        }
                        
                        .empty-state {
                            padding: 2rem 1rem;
                        }
                        
                        .subsection-heading {
                            font-size: 1.1rem;
                        }
                    }

                    @media (max-width: 480px) {
                        .settings-sidebar {
                            padding: 0.75rem;
                        }
                        
                        .sidebar-header {
                            gap: 0.5rem;
                        }
                        
                        .sidebar-header h2 {
                            font-size: 1rem;
                        }
                        
                        .sidebar-nav button {
                            padding: 0.4rem 0.75rem;
                            font-size: 0.8rem;
                        }
                        
                        .settings-main-content {
                            padding: 0.75rem;
                        }
                        
                        .section-heading {
                            font-size: 1.25rem;
                        }
                        
                        .workshop-item,
                        .installed-item {
                            padding: 0.75rem;
                        }
                        
                        .item-header h3 {
                            font-size: 0.95rem;
                        }
                        
                        .item-description {
                            font-size: 0.85rem;
                        }
                        
                        .logo-grid {
                            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                            gap: 0.5rem;
                        }
                        
                        .logo-preview {
                            height: 50px;
                        }
                        
                        .logo-name {
                            font-size: 0.7rem;
                        }
                        
                        .btn {
                            padding: 0.5rem 1rem;
                            font-size: 0.85rem;
                        }
                    }
                </style>
            {:else if activeTab === "Yüklü"}
                <section in:slide={{ duration: 300 }}>
                    <h2 class="section-heading">Yüklü Temalar</h2>
                    
                    {#if installedGeneralThemes.length === 0 && installedHomeThemes.length === 0}
                        <div class="empty-state">
                            <i class="fas fa-paint-brush"></i>
                            <h3>Henüz seçili tema yok</h3>
                            <p>Workshop'tan temaları seçerek başlayın.</p>
                            <a href="/settings/themes" class="btn btn-primary">
                                <i class="fas fa-check"></i>
                                Temaları Keşfet
                            </a>
                        </div>
                    {:else}
                        {#if installedGeneralThemes.length > 0}
                            <h3 class="subsection-heading">Site Temaları</h3>
                            <div class="installed-grid">
                                {#each installedGeneralThemes as theme}
                                    <div class="installed-item">
                                        <div class="item-header">
                                            <h3>{theme.name}</h3>
                                            <span class="item-status active">Aktif</span>
                                        </div>
                                        <div class="item-content">
                                            <p>{theme.description || "Açıklama yok"}</p>
                                            <div class="item-meta">
                                                <span class="item-author">
                                                    <i class="fas fa-user"></i>
                                                    {theme.author || "Bilinmeyen"}
                                                </span>
                                                {#if theme.version}
                                                    <span class="item-version">
                                                        <i class="fas fa-tag"></i>
                                                        v{theme.version}
                                                    </span>
                                                {/if}
                                            </div>
                                        </div>
                                        <div class="item-actions">
                                            <button
                                                class="btn btn-danger"
                                                on:click={() => uninstallItem(theme.id, "theme")}
                                            >
                                                <i class="fas fa-times"></i>
                                                Seçimi Kaldır
                                            </button>
                                            {#if theme.download_url}
                                                <a
                                                    href={theme.download_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="btn btn-outline"
                                                >
                                                    <i class="fas fa-external-link-alt"></i>
                                                    Önizle
                                                </a>
                                            {/if}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/if}

                        {#if installedHomeThemes.length > 0}
                            <h3 class="subsection-heading">Ana Sayfa Temaları</h3>
                            <div class="installed-grid">
                                {#each installedHomeThemes as theme}
                                    <div class="installed-item">
                                        <div class="item-header">
                                            <h3>{theme.name}</h3>
                                            <span class="item-status active">Aktif</span>
                                        </div>
                                        <div class="item-content">
                                            <p>{theme.description || "Açıklama yok"}</p>
                                            <div class="item-meta">
                                                <span class="item-author">
                                                    <i class="fas fa-user"></i>
                                                    {theme.author || "Bilinmeyen"}
                                                </span>
                                                {#if theme.version}
                                                    <span class="item-version">
                                                        <i class="fas fa-tag"></i>
                                                        v{theme.version}
                                                    </span>
                                                {/if}
                                            </div>
                                        </div>
                                        <div class="item-actions">
                                            <button
                                                class="btn btn-danger"
                                                on:click={() => uninstallItem(theme.id, "theme")}
                                            >
                                                <i class="fas fa-times"></i>
                                                Seçimi Kaldır
                                            </button>
                                            {#if theme.download_url}
                                                <a
                                                    href={theme.download_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="btn btn-outline"
                                                >
                                                    <i class="fas fa-external-link-alt"></i>
                                                    Önizle
                                                </a>
                                            {/if}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    {/if}
                </section>
            {:else if activeTab === "Tema Modu"}
                <section in:slide={{ duration: 300 }}>
                    <h2 class="section-heading">Tema Modu</h2>
                    
                    <div class="setting-card">
                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>Tema Modu</h3>
                                <p>Karanlık veya aydınlık mod seçin.</p>
                            </div>
                            <div class="select-wrapper">
                                <select bind:value={$themeMode}>
                                    <option value="system">Sistem</option>
                                    <option value="light">Aydınlık</option>
                                    <option value="dark">Karanlık</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </section>
            {/if}
        </main>
    </div>
</div>

<style>
    /* Modern Settings Styles */
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
        background: transparent;
        position: sticky;
        top: 0;
        z-index: 100;
        backdrop-filter: none;
    }

    .header-left,
    .header-right {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .back-button {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        color: var(--text-color);
        text-decoration: none;
        padding: 0.75rem 1.25rem;
        border-radius: 0.75rem;
        background: var(--card-background);
        border: 1px solid var(--border-color);
        transition: all 0.3s ease;
        font-weight: 500;
    }

    .back-button:hover {
        background: var(--primary-color);
        color: white;
        border-color: var(--primary-color);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .settings-title {
        font-size: 2rem;
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

    .settings-content-wrapper {
        display: flex;
        min-height: calc(100vh - 80px);
    }

    .settings-sidebar {
        width: 280px;
        background: var(--background-secondary);
        border-left: 1px solid var(--border-color);
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .settings-main-content {
        flex: 1;
        padding: 2rem;
        overflow-y: auto;
        order: 1;
        max-width: none;
        width: 100%;
    }

    .settings-sidebar ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .settings-sidebar li button {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.875rem 1rem;
        background: transparent;
        border: none;
        border-radius: 0.75rem;
        color: var(--text-color);
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s ease;
        text-align: left;
    }

    .settings-sidebar li button:hover {
        background: var(--hover-background);
        transform: translateX(4px);
    }

    .settings-sidebar li button.active {
        background: var(--primary-color);
        color: white;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .settings-sidebar li button i {
        width: 20px;
        text-align: center;
    }

    .section-heading {
        font-size: 1.75rem;
        font-weight: 700;
        margin: 0 0 2rem 0;
        color: var(--text-color);
    }

    .setting-card {
        background: var(--card-background);
        border: 1px solid var(--border-color);
        border-radius: 1rem;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        transition: all 0.3s ease;
    }

    .setting-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
    }

    .setting-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
    }

    .setting-info h3 {
        font-size: 1.1rem;
        font-weight: 600;
        margin: 0 0 0.5rem 0;
        color: var(--text-color);
    }

    .setting-info p {
        font-size: 0.9rem;
        color: var(--text-secondary);
        margin: 0;
        line-height: 1.5;
    }

    .select-wrapper {
        position: relative;
        min-width: 200px;
    }

    .select-wrapper select {
        width: 100%;
        padding: 0.75rem 2.5rem 0.75rem 1rem;
        background: var(--input-background);
        border: 1px solid var(--border-color);
        border-radius: 0.5rem;
        color: var(--text-color);
        font-size: 0.9rem;
        cursor: pointer;
        appearance: none;
        transition: all 0.3s ease;
    }

    .select-wrapper select:hover {
        border-color: var(--primary-color);
    }

    .select-wrapper select:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
    }

    .workshop-grid,
    .installed-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1.5rem;
        margin-top: 1rem;
    }

    .workshop-item,
    .installed-item {
        background: var(--card-background);
        border: 1px solid var(--border-color);
        border-radius: 1rem;
        padding: 1.5rem;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
    }

    .workshop-item:hover,
    .installed-item:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
        border-color: var(--primary-color);
    }

    .workshop-item-card {
        background: var(--card-background);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 1.5rem;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
    }

    .workshop-item-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        border-color: var(--primary-color);
    }

    .item-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1rem;
    }

    .item-title {
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--text-color);
        margin: 0;
        line-height: 1.3;
    }

    .item-meta {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.8rem;
        color: var(--text-secondary);
        margin-top: 0.5rem;
    }

    .item-meta span {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .item-description {
        font-size: 0.9rem;
        color: var(--text-secondary);
        line-height: 1.5;
        margin-bottom: 1rem;
    }

    .item-actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
    }

    .item-actions button,
    .item-actions a {
        padding: 0.625rem 1.25rem;
        border-radius: 0.5rem;
        font-size: 0.85rem;
        font-weight: 500;
        text-decoration: none;
        transition: all 0.3s ease;
        cursor: pointer;
        border: 1px solid transparent;
    }

    .item-actions button {
        background: var(--primary-color);
        color: white;
        border-color: var(--primary-color);
    }

    .item-actions button:hover {
        background: var(--primary-hover);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .item-actions a {
        background: var(--card-background);
        color: var(--text-color);
        border-color: var(--border-color);
    }

    .item-actions a:hover {
        background: var(--hover-background);
        border-color: var(--primary-color);
        color: var(--primary-color);
    }

    .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;
        color: var(--text-secondary);
    }

    .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--border-color);
        border-top: 3px solid var(--primary-color);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .error-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;
        color: var(--danger-color);
        text-align: center;
    }

    .error-container i {
        font-size: 3rem;
        margin-bottom: 1rem;
    }

    .empty-state {
        text-align: center;
        padding: 4rem 2rem;
        color: var(--text-secondary);
    }

    .empty-state i {
        font-size: 3rem;
        margin-bottom: 1rem;
        opacity: 0.5;
    }

    .empty-state h3 {
        font-size: 1.25rem;
        color: var(--text-color);
        margin: 0 0 0.5rem 0;
    }

    .empty-state p {
        margin: 0;
        line-height: 1.5;
    }

    .select-wrapper {
        position: relative;
        min-width: 200px;
    }

    .select-wrapper select {
        width: 100%;
        padding: 0.75rem 2.5rem 0.75rem 1rem;
        background: var(--input-background);
        border: 1px solid var(--border-color);
        border-radius: 0.5rem;
        color: var(--text-color);
        font-size: 0.9rem;
        cursor: pointer;
        appearance: none;
        transition: all 0.3s ease;
    }

    .select-wrapper select:hover {
        border-color: var(--primary-color);
    }

    .select-wrapper select:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
    }

    .workshop-grid,
    .installed-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1.5rem;
        margin-top: 1rem;
    }

    .workshop-item,
    .installed-item {
        background: var(--card-background);
        border: 1px solid var(--border-color);
        border-radius: 1rem;
        padding: 1.5rem;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
    }

    .workshop-item:hover,
    .installed-item:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
        border-color: var(--primary-color);
    }

    .item-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1rem;
    }

    .item-title {
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--text-color);
        margin: 0;
        line-height: 1.3;
    }

    .item-meta {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.8rem;
        color: var(--text-secondary);
        margin-top: 0.5rem;
    }

    .item-meta span {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .item-description {
        font-size: 0.9rem;
        color: var(--text-secondary);
        line-height: 1.5;
        margin-bottom: 1rem;
    }

    .item-actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
    }

    .item-actions button,
    .item-actions a {
        padding: 0.625rem 1.25rem;
        border-radius: 0.5rem;
        font-size: 0.85rem;
        font-weight: 500;
        text-decoration: none;
        transition: all 0.3s ease;
        cursor: pointer;
        border: 1px solid transparent;
    }

        .item-actions button {
        background: var(--primary-color);
        color: white;
        border-color: var(--primary-color);
    }

    .item-actions button:hover {
        background: var(--primary-hover);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .item-actions a {
        background: var(--card-background);
        color: var(--text-color);
        border-color: var(--border-color);
    }

    .item-actions a:hover {
        background: var(--hover-background);
        border-color: var(--primary-color);
        color: var(--primary-color);
    }

        .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;
        color: var(--text-secondary);
    }

    .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--border-color);
        border-top: 3px solid var(--primary-color);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .error-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;
        color: var(--danger-color);
        text-align: center;
    }

    .error-container i {
        font-size: 3rem;
        margin-bottom: 1rem;
    }

    .empty-state {
        text-align: center;
        padding: 4rem 2rem;
        color: var(--text-secondary);
    }

    .empty-state i {
        font-size: 3rem;
        margin-bottom: 1rem;
        opacity: 0.5;
    }

    .empty-state h3 {
        font-size: 1.25rem;
        color: var(--text-color);
        margin: 0 0 0.5rem 0;
    }

    .empty-state p {
        margin: 0 0 1.5rem 0;
    }

    @media (max-width: 1024px) {
        .workshop-grid,
        .installed-grid {
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 1.25rem;
        }
    }

    @media (max-width: 768px) {
        .settings-page {
            padding: 0;
            margin: 0;
            width: 100%;
            min-height: 100vh;
            background-color: var(--background-color);
            box-sizing: border-box;
        }
        
        .settings-content-wrapper {
            flex-direction: column;
            width: 100%;
            min-height: calc(100vh - 80px);
        }

        .settings-sidebar {
            width: 100%;
            border-left: none;
            border-bottom: 1px solid var(--border-color);
            padding: 1rem;
            order: 1;
            background: var(--card-background);
            position: sticky;
            top: 0;
            z-index: 50;
        }

            .settings-main-content {
        padding: 1rem;
        order: 2;
        width: 100%;
        max-width: none;
    }

    .settings-header {
        padding: 1rem 1.5rem;
        margin: 0.5rem 1rem;
        background: var(--card-background);
        border-bottom: 1px solid var(--border-color);
        border-radius: 12px;
        width: calc(100% - 1rem);
        box-sizing: border-box;
    }

    .settings-title {
        font-size: 1.5rem;
    }

    .workshop-grid,
    .installed-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
    }

    .workshop-item,
    .installed-item {
        padding: 1.25rem;
    }

    .item-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
    }

    .item-actions {
        flex-direction: column;
        gap: 0.5rem;
    }

    .item-actions button,
    .item-actions a {
        width: 100%;
        justify-content: center;
        padding: 0.75rem 1rem;
    }

    .item-meta {
        flex-direction: row;
        flex-wrap: wrap;
        gap: 1rem;
    }

    .setting-row {
        flex-direction: column;
        gap: 0.5rem;
        align-items: stretch;
    }

    .setting-card {
        padding: 1rem;
    }

    .section-heading {
        font-size: 1.5rem;
        margin-bottom: 1.5rem;
    }
}

@media (max-width: 480px) {
        .settings-page {
            padding: 0;
            margin: 0;
            width: 100%;
            min-height: 100vh;
            background-color: var(--background-color);
        }
        
        .settings-header {
        padding: 0.75rem 1rem;
        margin: 0.25rem 0.5rem;
        width: calc(100% - 0.5rem);
    }

    .back-button {
        padding: 0.5rem 0.75rem;
        font-size: 0.9rem;
    }

    .back-button span {
        display: none;
    }

    .settings-title {
        font-size: 1.25rem;
    }

    .section-heading {
        font-size: 1.25rem;
        margin-bottom: 1rem;
    }

    .setting-card {
        padding: 0.75rem;
    }

    .workshop-item,
    .installed-item {
        padding: 1rem;
        border-radius: 0.75rem;
    }

    .item-header h3 {
        font-size: 1rem;
        line-height: 1.4;
    }

    .item-category,
    .item-status {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
    }

    .item-content p {
        font-size: 0.85rem;
        line-height: 1.4;
    }

    .item-meta {
        font-size: 0.75rem;
        gap: 0.75rem;
    }

    .item-actions button,
    .item-actions a {
        padding: 0.625rem 0.875rem;
        font-size: 0.8rem;
    }
    
    .settings-sidebar {
        padding: 0.75rem;
    }

    .settings-sidebar button {
        padding: 0.75rem;
        font-size: 0.85rem;
    }

    .settings-sidebar button span {
        font-size: 0.8rem;
    }
    
    .settings-main-content {
        padding: 0.75rem;
    }

    .theme-preview {
        height: 120px;
        border-radius: 0.5rem;
    }

    .color-swatch {
        width: 24px;
        height: 24px;
    }

    .empty-state {
        padding: 2rem 1rem;
    }

    .empty-state i {
        font-size: 2rem;
    }

    .empty-state h3 {
        font-size: 1.1rem;
    }

    .empty-state p {
        font-size: 0.9rem;
    }
}
</style>
