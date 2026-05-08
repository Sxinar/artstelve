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
                        const category = (p.category || "").toLowerCase();

                        // Only include artado_eklenti category
                        if (category === "artado_eklenti") {
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

<div class="flex flex-col min-h-screen bg-[var(--background-color)] text-[var(--text-color)] font-sans" transition:fade={{ duration: 300 }}>
    <header class="flex items-center justify-between px-4 sm:px-12 py-4 sm:py-6 bg-transparent sticky top-0 z-[100] rounded-xl mx-2 sm:mx-4">
        <div class="flex items-center gap-4">
            <a href="/settings" class="flex items-center gap-3 text-[var(--text-color)] no-decoration px-5 py-3 rounded-xl bg-[var(--card-background)] border border-[var(--border-color)] transition-all duration-300 font-medium hover:bg-[var(--primary-color)] hover:text-white hover:border-[var(--primary-color)] hover:-translate-y-0.5 hover:shadow-lg" aria-label="Ayarlar">
                <i class="fas fa-arrow-left"></i>
                <span>Ayarlar</span>
            </a>
        </div>
        <h1 class="text-2xl sm:text-4xl font-bold m-0 bg-gradient-to-br from-[var(--primary-color)] to-[var(--accent-color)] bg-clip-text text-transparent">Eklentiler</h1>
        <div class="flex items-center gap-4"></div>
    </header>

    <div class="flex flex-col sm:flex-row min-h-[calc(100vh-80px)]">
        <aside class="w-full sm:w-[280px] bg-[var(--background-secondary)] border-r border-[var(--border-color)] border-l-0 px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-2 order-1">
            <nav aria-label="Eklentiler Menüsü">
                <ul class="list-none p-0 m-0">
                    <li>
                        <button
                            class:active={activeTab === "Eklentiler"}
                            onclick={() => (activeTab = "Eklentiler")}
                            class="w-full flex items-center gap-3 px-4 py-3.5 bg-transparent border-none rounded-xl text-[var(--text-color)] text-sm font-medium cursor-pointer transition-all duration-300 text-left hover:bg-[var(--hover-background)] hover:translate-x-1"
                        >
                            <i class="fas fa-puzzle-piece w-5 text-center"></i>
                            <span>Workshop Eklentileri</span>
                        </button>
                    </li>
                    <li>
                        <button
                            class:active={activeTab === "Yüklü"}
                            onclick={() => (activeTab = "Yüklü")}
                            class="w-full flex items-center gap-3 px-4 py-3.5 bg-transparent border-none rounded-xl text-[var(--text-color)] text-sm font-medium cursor-pointer transition-all duration-300 text-left hover:bg-[var(--hover-background)] hover:translate-x-1"
                        >
                            <i class="fas fa-download w-5 text-center"></i>
                            <span>Yüklü Eklentiler</span>
                        </button>
                    </li>
                    <li>
                        <button onclick={() => goto("/settings/themes")} class="w-full flex items-center gap-3 px-4 py-3.5 bg-transparent border-none rounded-xl text-[var(--text-color)] text-sm font-medium cursor-pointer transition-all duration-300 text-left hover:bg-[var(--hover-background)] hover:translate-x-1">
                            <i class="fas fa-paint-brush w-5 text-center"></i>
                            <span>Temalar</span>
                        </button>
                    </li>
                </ul>
            </nav>
        </aside>

        <main class="flex-1 p-4 sm:p-8 overflow-y-auto order-2 max-w-none w-full">
            {#if activeTab === "Eklentiler"}
                <section in:slide={{ duration: 300 }}>
                    <h2 class="text-xl sm:text-[1.75rem] font-bold m-0 mb-6 sm:mb-8 text-[var(--text-color)]">Workshop Eklentileri</h2>

                    {#if $isLoadingWorkshop}
                        <div class="bg-[var(--card-background)] border border-[var(--border-color)] rounded-2xl p-6 transition-all duration-300 relative overflow-hidden">
                            <div class="text-center p-8">
                                <div class="w-10 h-10 border-3 border-[var(--border-color)] border-t-[var(--primary-color)] rounded-full animate-spin mb-4 mx-auto"></div>
                                <p>Eklentiler yükleniyor...</p>
                            </div>
                        </div>
                    {:else if $workshopError}
                        <div class="bg-[var(--card-background)] border border-[var(--border-color)] rounded-2xl p-6 transition-all duration-300 relative overflow-hidden text-[var(--danger-color)] text-center">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>{$workshopError}</p>
                        </div>
                    {:else}
                        <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 mt-4">
                            {#each $plugins as plugin}
                                <div class="bg-[var(--card-background)] border border-[var(--border-color)] rounded-2xl p-6 transition-all duration-300 relative overflow-hidden hover:-translate-y-0.5 hover:shadow-lg hover:border-[var(--primary-color)]">
                                    <div class="flex justify-between items-start mb-4">
                                        <h3>{plugin.name}</h3>
                                        <span class="text-sm text-[var(--text-secondary)]"
                                            >{plugin.category || "Genel"}</span
                                        >
                                    </div>
                                    <div class="mb-4">
                                        <p>
                                            {plugin.description ||
                                                "Açıklama yok"}
                                        </p>
                                        <div class="flex flex-col gap-1 text-xs text-[var(--text-secondary)] mt-2">
                                            <span class="flex items-center gap-1">
                                                <i class="fas fa-user"></i>
                                                {plugin.author || "Bilinmeyen"}
                                            </span>
                                            {#if plugin.version}
                                                <span class="flex items-center gap-1">
                                                    <i class="fas fa-tag"></i>
                                                    v{plugin.version}
                                                </span>
                                            {/if}
                                        </div>
                                    </div>
                                    <div class="flex gap-3 flex-wrap">
                                        <button
                                            class="px-5 py-2.5 rounded-lg text-sm font-medium text-decoration-none transition-all duration-300 cursor-pointer border border-transparent bg-[var(--primary-color)] text-white border-[var(--primary-color)] hover:bg-[var(--primary-hover)] hover:-translate-y-0.5 hover:shadow-lg"
                                            onclick={() =>
                                                installItem(plugin, "plugin")}
                                            disabled={installingId ===
                                                plugin.id}
                                        >
                                            {#if installingId === plugin.id}
                                                <i
                                                    class="fas fa-spinner fa-spin"
                                                ></i>
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
                                                class="px-5 py-2.5 rounded-lg text-sm font-medium text-decoration-none transition-all duration-300 cursor-pointer border border-transparent bg-[var(--card-background)] text-[var(--text-color)] border-[var(--border-color)] hover:bg-[var(--hover-background)] hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]"
                                            >
                                                <i
                                                    class="fas fa-external-link-alt"
                                                ></i>
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
                    <h2 class="text-[1.75rem] font-bold m-0 mb-8 text-[var(--text-color)]">Yüklü Eklentiler</h2>

                    {#if installedPluginsList.length === 0}
                        <div class="bg-[var(--card-background)] border border-[var(--border-color)] rounded-2xl p-6 transition-all duration-300 relative overflow-hidden">
                            <div class="text-center p-16 text-[var(--text-secondary)]">
                                <i class="fas fa-puzzle-piece text-5xl mb-4 opacity-50"></i>
                                <h3 class="text-xl text-[var(--text-color)] m-0 mb-2">Henüz yüklü eklenti yok</h3>
                                <p>
                                    Workshop'tan eklentileri kurarak başlayın.
                                </p>
                                <a
                                    href="/settings/plugins"
                                    class="px-5 py-2.5 rounded-lg text-sm font-medium text-decoration-none transition-all duration-300 cursor-pointer border border-transparent bg-[var(--primary-color)] text-white border-[var(--primary-color)] hover:bg-[var(--primary-hover)] hover:-translate-y-0.5 hover:shadow-lg"
                                >
                                    <i class="fas fa-download"></i>
                                    Eklentileri Keşfet
                                </a>
                            </div>
                        </div>
                    {:else}
                        <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 mt-4">
                            {#each installedPluginsList as plugin}
                                <div class="bg-[var(--card-background)] border border-[var(--border-color)] rounded-2xl p-6 transition-all duration-300 relative overflow-hidden hover:-translate-y-0.5 hover:shadow-lg hover:border-[var(--primary-color)]">
                                    <div class="flex justify-between items-start mb-4">
                                        <h3>{plugin.name}</h3>
                                        <span class="text-sm text-green-500"
                                            >Aktif</span
                                        >
                                    </div>
                                    <div class="mb-4">
                                        <p>
                                            {plugin.description ||
                                                "Açıklama yok"}
                                        </p>
                                        <div class="flex flex-col gap-1 text-xs text-[var(--text-secondary)] mt-2">
                                            <span class="flex items-center gap-1">
                                                <i class="fas fa-user"></i>
                                                {plugin.author || "Bilinmeyen"}
                                            </span>
                                            {#if plugin.version}
                                                <span class="flex items-center gap-1">
                                                    <i class="fas fa-tag"></i>
                                                    v{plugin.version}
                                                </span>
                                            {/if}
                                        </div>
                                    </div>
                                    <div class="flex gap-3 flex-wrap">
                                        <button
                                            class="px-5 py-2.5 rounded-lg text-sm font-medium text-decoration-none transition-all duration-300 cursor-pointer border border-transparent bg-red-500 text-white border-red-500 hover:bg-red-600 hover:-translate-y-0.5 hover:shadow-lg"
                                            onclick={() =>
                                                uninstallItem(
                                                    plugin.id,
                                                    "plugin",
                                                )}
                                        >
                                            <i class="fas fa-trash"></i>
                                            Kaldır
                                        </button>
                                        {#if plugin.download_url}
                                            <a
                                                href={plugin.download_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="px-5 py-2.5 rounded-lg text-sm font-medium text-decoration-none transition-all duration-300 cursor-pointer border border-transparent bg-[var(--card-background)] text-[var(--text-color)] border-[var(--border-color)] hover:bg-[var(--hover-background)] hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]"
                                            >
                                                <i
                                                    class="fas fa-external-link-alt"
                                                ></i>
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
