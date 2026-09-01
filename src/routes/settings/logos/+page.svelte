<script>
    import { getContext } from "svelte";
    import { fade, fly } from "svelte/transition";
    import { customLogo } from "$lib/stores.js";

    export let data;
    const isSidebarOpen = getContext("sidebar");

    const applyLogo = (logo) => {
        const url = logo.image_url || logo.download_url;
        if (url) {
            customLogo.set(url);
            localStorage.setItem("custom_logo", url);

            const toast = document.createElement("div");
            toast.className = "toast";
            toast.innerText = `✨ ${logo.name} uygulandı`;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2500);
        }
    };
</script>

<div class="page">
    <header class="header">
        <div class="header-left">
            <a href="/" class="back-btn" title="Ana Sayfaya Dön">
                <i class="fas fa-chevron-left"></i>
            </a>

            <div class="header-titles">
                <div class="main-title">
                    <i class="fas fa-home-config"></i>
                    <h1>Workshop Logoları</h1>
                </div>
                <p>{data.logos.length} tasarım hazır</p>
            </div>
        </div>

        <button
            class="nav-btn"
            onclick={() => isSidebarOpen.update((v) => !v)}
            title="Menü"
        >
            <i class="fas fa-ellipsis-v"></i>
        </button>
    </header>

    <main class="container">
        {#if data.logos.length === 0}
            <div class="empty" in:fade>
                <i class="fas fa-circle-notch fa-spin"></i>
                <p>Logolar yükleniyor veya bulunamadı...</p>
            </div>
        {:else}
            <div class="grid">
                {#each data.logos as logo, i (logo.id)}
                    <div
                        class="card"
                        in:fly={{ y: 20, delay: i * 40, duration: 400 }}
                    >
                        <div class="preview">
                            <img
                                src={logo.image_url}
                                alt={logo.name}
                                loading="lazy"
                            />
                            <div class="overlay">
                                <button
                                    class="apply-btn"
                                    onclick={() => applyLogo(logo)}
                                >
                                    Kullan
                                </button>
                            </div>
                        </div>
                        <div class="footer">
                            <div class="meta">
                                <h3>{logo.name}</h3>
                                <span>{logo.author || "Artado"}</span>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </main>
</div>

<style>
    .page {
        min-height: 100vh;
        background-color: var(--background-color);
        color: var(--text-color);
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 2rem;
        position: sticky;
        top: 0;
        z-index: 100;
        background: rgba(var(--card-background-rgb), 0.85);
        backdrop-filter: blur(15px);
        border-bottom: 1px solid var(--border-color);
    }

    .header-left {
        display: flex;
        align-items: center;
        gap: 1.5rem;
    }

    /* Geri Butonu Tasarımı */
    .back-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 35px;
        height: 35px;
        border-radius: 50%;
        color: var(--text-color);
        background: var(--hover-background);
        text-decoration: none;
        transition: all 0.2s;
        border: 1px solid var(--border-color);
    }
    .back-btn:hover {
        background: var(--primary-color);
        color: white;
        border-color: var(--primary-color);
        transform: translateX(-3px);
    }

    .main-title {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .header-titles h1 {
        font-size: 1.15rem;
        margin: 0;
        font-weight: 700;
    }
    .header-titles p {
        font-size: 0.75rem;
        opacity: 0.5;
        margin: 0;
    }

    /* Sağdaki Üç Nokta */
    .nav-btn {
        background: none;
        border: none;
        color: var(--text-color);
        width: 40px;
        height: 40px;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s;
        font-size: 1.1rem;
    }
    .nav-btn:hover {
        opacity: 1;
        color: var(--primary-color);
    }

    /* Grid & Kartlar */
    .container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 2rem;
    }
    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 1.5rem;
    }

    .card {
        background: var(--card-background);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        overflow: hidden;
        transition: all 0.3s ease;
    }
    .card:hover {
        transform: translateY(-5px);
        border-color: var(--primary-color);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
    }

    .preview {
        position: relative;
        height: 160px;
        background: white;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
    }
    .preview img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
    }

    .overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: 0.3s;
        backdrop-filter: blur(2px);
    }
    .card:hover .overlay {
        opacity: 1;
    }

    .apply-btn {
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 0.6rem 1.2rem;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
    }

    .footer {
        padding: 1rem;
    }
    .meta h3 {
        font-size: 0.9rem;
        margin: 0;
        font-weight: 600;
    }
    .meta span {
        font-size: 0.7rem;
        opacity: 0.5;
    }

    :global(.toast) {
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: white;
        padding: 0.6rem 1.5rem;
        border-radius: 50px;
        z-index: 1000;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    }
</style>
