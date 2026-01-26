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
    let activeTab = "Eklentiler";

    // --- Workshop Items ---
    let plugins = writable([]);
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
                    // Separate plugins from other items
                    const allPlugins = data.plugins || [];
                    const _plugins = [];

                    allPlugins.forEach((p) => {
                        const type = (p.category || "").toLowerCase();
                        const u = (p.download_url || "").toLowerCase();
                        if (
                            !u.endsWith(".png") &&
                            !u.endsWith(".jpg") &&
                            !u.endsWith(".jpeg") &&
                            !u.endsWith(".gif") &&
                            !u.endsWith(".svg") &&
                            !u.endsWith(".webp") &&
                            type !== "ana-sayfa" &&
                            type !== "home"
                        ) {
                            _plugins.push(p);
                        }
                    });

                    plugins.set(_plugins);
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

        if (type === "plugin") {
            // Store active workshop plugins in localStorage
            const activePlugins = JSON.parse(localStorage.getItem('activeWorkshopPlugins') || '[]');
            if (!activePlugins.find(p => p.id === item.id)) {
                activePlugins.push({
                    id: item.id,
                    name: item.name,
                    url: item.download_url,
                    category: item.category
                });
                localStorage.setItem('activeWorkshopPlugins', JSON.stringify(activePlugins));
            }
            alert(
                "Eklenti buluttan uygulandı! Bir sonraki aramanızda etkinleşecek.",
            );
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
            document.body.classList.add("settings-active");
            return () => document.body.classList.remove("settings-active");
        }
    });

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

    // Since we're not downloading files anymore, uninstall removes from active items
    async function uninstallItem(id, type) {
        if (
            !confirm(
                "Bu eklentiyi devre dışı bırakmak istediğinize emin misiniz?",
            )
        )
            return;

        try {
            if (type === "plugin") {
                // Remove from active workshop plugins
                const activePlugins = JSON.parse(localStorage.getItem('activeWorkshopPlugins') || '[]');
                const filteredPlugins = activePlugins.filter(p => p.id !== id);
                localStorage.setItem('activeWorkshopPlugins', JSON.stringify(filteredPlugins));
            }
            
            alert("Başarıyla devre dışı bırakıldı.");
        } catch (e) {
            alert("Hata: " + e.message);
        }
    }

    function formatPluginName(kebabCaseName) {
        if (!kebabCaseName) return "";
        return kebabCaseName
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
    }
</script>

<svelte:head>
    <title>Eklentiler - Stelve</title>
</svelte:head>

<div class="settings-page" transition:fade={{ duration: 300 }}>
    <header class="settings-header">
        <div class="header-left">
            <a href="/settings" class="back-button" aria-label="Ayarlar">
                <i class="fas fa-arrow-left"></i>
                <span>Ayarlar</span>
            </a>
        </div>
        <h1 class="settings-title">Eklentiler</h1>
        <div class="header-right"></div>
    </header>

    <div class="settings-content-wrapper">
        <aside class="settings-sidebar">
            <nav aria-label="Eklentiler Menüsü">
                <ul>
                    <li>
                        <button
                            class:active={activeTab === "Eklentiler"}
                            on:click={() => (activeTab = "Eklentiler")}
                        >
                            <i class="fas fa-puzzle-piece"></i>
                            <span>Workshop Eklentileri</span>
                        </button>
                    </li>
                    <li>
                        <button
                            class:active={activeTab === "Yüklü"}
                            on:click={() => (activeTab = "Yüklü")}
                        >
                            <i class="fas fa-download"></i>
                            <span>Yüklü Eklentiler</span>
                        </button>
                    </li>
                    <li>
                        <button
                            on:click={() => goto('/settings/themes')}
                        >
                            <i class="fas fa-paint-brush"></i>
                            <span>Temalar</span>
                        </button>
                    </li>
                </ul>
            </nav>
        </aside>

        <main class="settings-main-content">
            {#if activeTab === "Eklentiler"}
                <section in:slide={{ duration: 300 }}>
                    <h2 class="section-heading">Workshop Eklentileri</h2>
                    
                    {#if $isLoadingWorkshop}
                        <div class="loading-container">
                            <div class="spinner"></div>
                            <p>Eklentiler yükleniyor...</p>
                        </div>
                    {:else if $workshopError}
                        <div class="error-container">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>{$workshopError}</p>
                        </div>
                    {:else}
                        <div class="workshop-grid">
                            {#each $plugins as plugin}
                                <div class="workshop-item">
                                    <div class="item-header">
                                        <h3>{plugin.name}</h3>
                                        <span class="item-category">{plugin.category || "Genel"}</span>
                                    </div>
                                    <div class="item-content">
                                        <p>{plugin.description || "Açıklama yok"}</p>
                                        <div class="item-meta">
                                            <span class="item-author">
                                                <i class="fas fa-user"></i>
                                                {plugin.author || "Bilinmeyen"}
                                            </span>
                                            {#if plugin.version}
                                                <span class="item-version">
                                                    <i class="fas fa-tag"></i>
                                                    v{plugin.version}
                                                </span>
                                            {/if}
                                        </div>
                                    </div>
                                    <div class="item-actions">
                                        <button
                                            class="btn btn-primary"
                                            on:click={() => installItem(plugin, "plugin")}
                                            disabled={installingId === plugin.id}
                                        >
                                            {#if installingId === plugin.id}
                                                <i class="fas fa-spinner fa-spin"></i>
                                                Kuruluyor...
                                            {:else}
                                                <i class="fas fa-download"></i>
                                                Eklentiyi Kur
                                            {/if}
                                        </button>
                                        {#if plugin.download_url}
                                            <a
                                                href={plugin.download_url}
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
            {:else if activeTab === "Yüklü"}
                <section in:slide={{ duration: 300 }}>
                    <h2 class="section-heading">Yüklü Eklentiler</h2>
                    
                    {#if installedPluginsList.length === 0}
                        <div class="empty-state">
                            <i class="fas fa-puzzle-piece"></i>
                            <h3>Henüz yüklü eklenti yok</h3>
                            <p>Workshop'tan eklentileri kurarak başlayın.</p>
                            <a href="/settings/plugins" class="btn btn-primary">
                                <i class="fas fa-download"></i>
                                Eklentileri Keşfet
                            </a>
                        </div>
                    {:else}
                        <div class="installed-grid">
                            {#each installedPluginsList as plugin}
                                <div class="installed-item">
                                    <div class="item-header">
                                        <h3>{plugin.name}</h3>
                                        <span class="item-status active">Aktif</span>
                                    </div>
                                    <div class="item-content">
                                        <p>{plugin.description || "Açıklama yok"}</p>
                                        <div class="item-meta">
                                            <span class="item-author">
                                                <i class="fas fa-user"></i>
                                                {plugin.author || "Bilinmeyen"}
                                            </span>
                                            {#if plugin.version}
                                                <span class="item-version">
                                                    <i class="fas fa-tag"></i>
                                                    v{plugin.version}
                                                </span>
                                            {/if}
                                        </div>
                                    </div>
                                    <div class="item-actions">
                                        <button
                                            class="btn btn-danger"
                                            on:click={() => uninstallItem(plugin.id, "plugin")}
                                        >
                                            <i class="fas fa-trash"></i>
                                            Kaldır
                                        </button>
                                        {#if plugin.download_url}
                                            <a
                                                href={plugin.download_url}
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

    .settings-main-content {
        flex: 1;
        padding: 2rem;
        overflow-y: auto;
        order: 1;
    }

    .settings-sidebar {
        width: 280px;
        background: var(--background-secondary);
        border-right: 1px solid var(--border-color);
        border-left: none;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        order: 1;
    }

    .settings-main-content {
        flex: 1;
        padding: 2rem;
        overflow-y: auto;
        order: 2;
        max-width: none;
        width: 100%;
    }

    .settings-sidebar nav ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .settings-sidebar button {
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

    .settings-sidebar button:hover {
        background: var(--hover-background);
        transform: translateX(4px);
    }

    .settings-sidebar button.active {
        background: var(--primary-color);
        color: white;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .settings-sidebar button i {
        width: 20px;
        text-align: center;
    }

    .section-heading {
        font-size: 1.75rem;
        font-weight: 700;
        margin: 0 0 2rem 0;
        color: var(--text-color);
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

    /* Responsive Design */
    @media (max-width: 768px) {
        .settings-content-wrapper {
            flex-direction: column;
        }

        .settings-sidebar {
            width: 100%;
            border-right: none;
            border-bottom: 1px solid var(--border-color);
            padding: 1rem;
            order: 1;
        }

        .settings-main-content {
            padding: 1rem;
            order: 2;
        }

        .settings-header {
            padding: 1rem 1.5rem;
        }

        .settings-title {
            font-size: 1.5rem;
        }

        .workshop-grid,
        .installed-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
        }

        .item-actions {
            flex-direction: column;
        }

        .item-actions button,
        .item-actions a {
            width: 100%;
            justify-content: center;
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
            padding: 0.75rem 0;
        }
        
        .settings-title {
            font-size: 1.1rem;
        }
        
        .plugin-item {
            padding: 0.75rem;
        }
        
        .plugin-header h3 {
            font-size: 0.95rem;
        }
        
        .plugin-description {
            font-size: 0.85rem;
        }
        
        .btn {
            padding: 0.5rem 1rem;
            font-size: 0.85rem;
        }
    }
</style>
