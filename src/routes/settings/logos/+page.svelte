<script>
    import { getContext, onMount } from "svelte";
    import { writable } from "svelte/store";
    import { fade, slide, fly } from "svelte/transition";
    import { customLogo } from "$lib/stores.js";

    // Get sidebar store from context
    const isSidebarOpen = getContext("sidebar");

    let logos = writable([]);
    let workshopError = writable(null);
    let isLoading = writable(true);

    async function fetchLogos() {
        isLoading.set(true);
        try {
            const response = await fetch("/api/workshop/themes");
            if (response.ok) {
                const data = await response.json();
                logos.set(data.themes || []);
                workshopError.set(null);
            } else {
                workshopError.set("Logolar yüklenemedi");
            }
        } catch (err) {
            console.error("Logolar yüklenirken hata:", err);
            workshopError.set("Bağlantı hatası: " + err.message);
        } finally {
            isLoading.set(false);
        }
    }

    function applyLogo(logo) {
        if (!logo.download_url) return;
        customLogo.set(logo.download_url);
        alert("Logo anında uygulandı!");
    }

    function toggleSidebar() {
        isSidebarOpen.update((open) => !open);
    }

    onMount(() => {
        fetchLogos();
    });
</script>

<svelte:head>
    <title>Workshop Logoları - Artado Search Ayarları</title>
</svelte:head>

<div class="settings-page">
    <header class="settings-header">
        <button class="menu-button" on:click={toggleSidebar} aria-label="Menüyü aç">
            <i class="fas fa-sliders-h"></i>
        </button>
        <h1>Workshop Logoları</h1>
        <p>Workshop'tan yüklenen logoları seçip uygulayın</p>
    </header>

    <main class="settings-main">
        <section class="settings-section">
            <div class="section-header">
                <h2>
                    <i class="fas fa-image"></i>
                    Workshop Logoları
                </h2>
                <p>Workshop'tan yüklenen logoları seçin ve anında uygulayın</p>
            </div>

            {#if $isLoading}
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Logolar yükleniyor...</p>
                </div>
            {:else if $workshopError}
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>{$workshopError}</p>
                    <button on:click={fetchLogos} class="retry-btn">
                        <i class="fas fa-redo"></i> Tekrar Dene
                    </button>
                </div>
            {:else if $logos.length === 0}
                <div class="empty-state">
                    <i class="fas fa-images"></i>
                    <p>Henüz logo yüklenmemiş</p>
                </div>
            {:else}
                <div class="logos-grid">
                    {#each $logos as logo (logo.id)}
                        <div class="logo-card" in:fade={{ duration: 300 }}>
                            <div class="logo-preview">
                                <img
                                    src={logo.download_url || "/placeholder.png"}
                                    alt={logo.name}
                                    on:error={(e) => (e.target.src = "/placeholder.png")}
                                />
                            </div>
                            <div class="logo-info">
                                <h3>{logo.name}</h3>
                                <p class="logo-author">
                                    <i class="fas fa-user"></i>
                                    {logo.author || 'Workshop'}
                                </p>
                                <p class="logo-description">
                                    {logo.description || 'Özel logo tasarımı'}
                                </p>
                                <div class="logo-actions">
                                    <button 
                                        class="apply-btn"
                                        on:click={() => applyLogo(logo)}
                                    >
                                        <i class="fas fa-check"></i>
                                        Seç
                                    </button>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </section>

       
    </main>
</div>

<style>
    .settings-page {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background-color: var(--background-color);
        color: var(--text-color);
        padding: 0;
    }

    .settings-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.5rem 2rem;
        border-bottom: 1px solid var(--border-color);
        background-color: var(--card-background);
    }

    .settings-header h1 {
        font-size: 1.8rem;
        margin: 0;
        color: var(--text-color);
        font-weight: 600;
    }

    .settings-header p {
        margin: 0;
        color: var(--text-color-secondary);
        font-size: 0.9rem;
    }

    .menu-button {
        background: none;
        border: none;
        color: var(--text-color-secondary);
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0.5rem;
        border-radius: 50%;
        transition: background-color 0.2s;
    }

    .menu-button:hover {
        color: var(--text-color);
        background-color: var(--hover-background);
    }

    .settings-main {
        flex: 1;
        padding: 2rem;
        max-width: 1200px;
        margin: 0 auto;
        width: 100%;
        box-sizing: border-box;
    }

    .settings-section {
        margin-bottom: 2rem;
        background-color: var(--card-background);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .section-header {
        margin-bottom: 1.5rem;
    }

    .section-header h2 {
        font-size: 1.3rem;
        margin: 0 0 0.5rem 0;
        color: var(--text-color);
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .section-header p {
        margin: 0;
        color: var(--text-color-secondary);
        font-size: 0.9rem;
    }

    .loading-state,
    .error-state,
    .empty-state {
        text-align: center;
        padding: 3rem;
        color: var(--text-color-secondary);
    }

    .loading-state i,
    .error-state i,
    .empty-state i {
        font-size: 2rem;
        margin-bottom: 1rem;
        display: block;
    }

    .error-state {
        color: #e57373;
    }

    .retry-btn {
        margin-top: 1rem;
        padding: 0.5rem 1rem;
        background-color: var(--primary-color);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.9rem;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        transition: background-color 0.2s;
    }

    .retry-btn:hover {
        background-color: var(--primary-color-hover);
    }

    .logos-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1.5rem;
    }

    .logo-card {
        background-color: var(--background-color);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        overflow: hidden;
        transition: transform 0.2s, box-shadow 0.2s;
    }

    .logo-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .logo-preview {
        width: 100%;
        height: 200px;
        background-color: var(--background-color-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }

    .logo-preview img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        transition: transform 0.2s;
    }

    .logo-card:hover .logo-preview img {
        transform: scale(1.05);
    }

    .logo-info {
        padding: 1rem;
    }

    .logo-info h3 {
        font-size: 1.1rem;
        margin: 0 0 0.5rem 0;
        color: var(--text-color);
        font-weight: 600;
    }

    .logo-author,
    .logo-description {
        font-size: 0.85rem;
        color: var(--text-color-secondary);
        margin: 0.25rem 0;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .logo-actions {
        margin-top: 1rem;
        display: flex;
        justify-content: flex-end;
    }

    .apply-btn {
        background-color: var(--primary-color);
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.9rem;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        transition: background-color 0.2s;
    }

    .apply-btn:hover {
        background-color: var(--primary-color-hover);
    }

    @media (max-width: 768px) {
        .settings-header {
            padding: 1rem;
        }

        .settings-header h1 {
            font-size: 1.5rem;
        }

        .settings-main {
            padding: 1rem;
        }

        .settings-section {
            padding: 1rem;
            margin-bottom: 1rem;
        }

        .logos-grid {
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 1rem;
        }

        .logo-preview {
            height: 150px;
        }
    }
</style>
