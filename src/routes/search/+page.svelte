<script>
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { onMount, getContext } from "svelte";
    import { writable } from "svelte/store";
    import { selectedEngine, proxySearchEnabled, proxyCustomUrl, proxyResultCount } from "$lib/stores.js"; 
    import { safeSearch, blockedSites } from "$lib/stores.js";
    import { searchHistory } from "$lib/searchHistory.js";
    import { t } from "$lib/i18n.js";
    import { fade, slide } from "svelte/transition";

    // Get sidebar store from context
    const isSidebarOpen = getContext("sidebar");

    let searchQuery = "";
    let inputQuery = ""; // Separate state for the input field
    let isLoading = false;
    let searchResults = writable([]);
    let error = writable(null); // Use writable store for error
    let activeSearchType = "web"; // 'web', 'images', 'videos', 'news' etc.
    let imageSize = "";
    let imageColor = "";
    let imageAspect = "";
    let imageType = "";
    let imagePalette = "";

    // News filters
    let newsSource = "";
    let newsStartDate = "";
    let newsEndDate = "";

    // Pagination state
    let offset = 0;
    let count = 20;
    let infoBoxResult = writable(null);
    

    // Fetch results from our backend API endpoint
    async function fetchSearchResults(query, type = "web") {
        if (!query) {
            searchResults.set([]);
            infoBoxResult.set(null);
            error.set(null);
            return;
        }
        isLoading = true;
        error.set(null); // Reset error store
        infoBoxResult.set(null);
        console.log(`[Frontend] Fetching ${type} results for: ${query}`);

        try {
            // Construct the API URL for our backend endpoint
            const params = new URLSearchParams();
            params.set("i", query);
            params.set("t", type);
            params.set("engine", $selectedEngine);
            params.set("safe", $safeSearch ? "on" : "off");
            if (type === "web") {
                params.set("proxy", $proxySearchEnabled ? "on" : "off");
                params.set("proxyCount", String($proxyResultCount || 20));
                if ($proxyCustomUrl) params.set("proxyUrl", $proxyCustomUrl);
            }
            if (type === "images") {
                if (imageSize) params.set("size", imageSize);
                if (imageColor) params.set("color", imageColor);
                if (imageAspect) params.set("aspect", imageAspect);
                if (imageType) params.set("type", imageType);
                if (imagePalette) params.set("palette", imagePalette);
            }
            if (type === "news") {
                if (newsSource) params.set("source", newsSource);
                if (newsStartDate) params.set("startDate", newsStartDate);
                if (newsEndDate) params.set("endDate", newsEndDate);
            }
            params.set("offset", String(offset));
            params.set("count", String(count));
            const apiUrl = `/api/search?${params.toString()}`;

            const response = await fetch(apiUrl); // Fetch from our own API

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = {
                        error: `API isteği başarısız: ${response.status}`,
                        details: await response.text(),
                    };
                }
                console.error("[Frontend] API Error:", errorData);
                throw new Error(
                    errorData.error ||
                        `API isteği başarısız: ${response.status}`,
                );
            }

            // Data is already processed by the backend
            const data = await response.json();
            console.log("[Frontend] API Response:", data);
            if (data && data.ok === false) {
                throw new Error(data.error || `API isteği başarısız`);
            }

            const incoming = data.searchResults || [];
            if (offset > 0) {
                // append for pagination
                searchResults.update((prev) => [...prev, ...incoming]);
            } else {
                searchResults.set(incoming);
            }
            infoBoxResult.set(data.infoBoxResult || null);
        } catch (err) {
            console.error("[Frontend] Error fetching search results:", err);
            error.set(err.message); // Set error store
            searchResults.set([]);
            infoBoxResult.set(null);
        } finally {
            isLoading = false;
        }
    }

    // Reactive statement to fetch results when the URL query parameter changes
    $: {
        const queryParam = $page.url.searchParams.get("i");
        const typeParam = $page.url.searchParams.get("t") || "web";
        if (queryParam !== searchQuery || typeParam !== activeSearchType) {
            searchQuery = queryParam || "";
            activeSearchType = typeParam;
            inputQuery = searchQuery;
            offset = 0; // reset pagination on type or query change
            fetchSearchResults(searchQuery, activeSearchType);
        }
    }

    function handleSearchSubmit(type = activeSearchType) {
        if (!inputQuery.trim()) return;
        searchHistory.addSearch(inputQuery.trim(), $selectedEngine, type);
        goto(`/search?i=${encodeURIComponent(inputQuery.trim())}&t=${type}`);
    }

    function handleKeyPress(event) {
        if (event.key === "Enter") {
            handleSearchSubmit();
        }
    }

    function changeSearchType(newType) {
        if (newType !== activeSearchType) {
            // reset filters and offset when changing type
            imageSize =
                imageColor =
                imageAspect =
                imageType =
                imagePalette =
                    "";
            newsSource = newsStartDate = newsEndDate = "";
            offset = 0;
            handleSearchSubmit(newType);
        }
    }

    function loadMore() {
        offset += count;
        fetchSearchResults(searchQuery, activeSearchType);
    }

    function getDomain(url) {
        if (!url) return "";
        try {
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                if (url.includes(".")) {
                    return url.replace(/^www\./, "");
                }
                return url;
            }
            return new URL(url).hostname.replace(/^www\./, "");
        } catch (e) {
            console.warn(
                `[Frontend] Failed to parse domain from URL: ${url}`,
                e,
            );
            return url;
        }
    }

    function toggleSidebar() {
        isSidebarOpen.update((open) => !open);
    }

    function formatDuration(duration) {
        // This function might be redundant if backend formats it,
        // but keep it for now in case backend format changes or fails.
        if (!duration || !duration.startsWith("PT")) return duration; // Return original if not expected format
        try {
            let time = duration.substring(2);
            let hours = "";
            let minutes = "0";
            let seconds = "0";
            if (time.includes("H")) [hours, time] = time.split("H");
            if (time.includes("M")) [minutes, time] = time.split("M");
            if (time.includes("S")) seconds = time.split("S")[0];
            seconds = seconds.padStart(2, "0");
            minutes = minutes.padStart(2, "0");
            return hours
                ? `${hours}:${minutes}:${seconds}`
                : `${minutes}:${seconds}`;
        } catch (e) {
            return duration;
        } // Return original on error
    }

    function formatAge(ageString) {
        // Keep this simple helper as backend just passes the string for now
        return ageString || "";
    }

    // --- Blocking & Menu Logic ---
    let openMenuUrl = null; // Track via URL instead of index for stability

    function toggleMenu(url, event) {
        event.stopPropagation();
        event.preventDefault();
        openMenuUrl = openMenuUrl === url ? null : url;
    }

    function closeMenu() {
        openMenuUrl = null;
    }

    function blockSite(siteUrl) {
        const domain = getDomain(siteUrl);
        if (domain) {
            blockedSites.update((sites) => [...sites, domain]);
            openMenuUrl = null;
        }
    }

    // Close menu when clicking outside
    function handleOutsideClick(event) {
        if (openMenuUrl && !event.target.closest(".result-menu-container")) {
            closeMenu();
        }
    }

    // Filter results
    $: filteredResults = $searchResults.filter((result) => {
        if (activeSearchType !== "web") return true; // Only block web results for now
        const domain = getDomain(result.url);
        return !$blockedSites.includes(domain);
    });
</script>

<svelte:window on:click={handleOutsideClick} />

<svelte:head>
    <title
        >{searchQuery
            ? `${searchQuery} - Artado Search`
            : "Artado Search"}</title
    >
</svelte:head>

<div class="search-results-page">
    <header class="search-header">
        <a href="/" class="logo-link" aria-label="Ana Sayfa">
            <img src="/logo.png" alt="Artado Logo" class="header-logo" />
        </a>
        <div class="search-bar-container">
            <input
                type="text"
                bind:value={inputQuery}
                on:keypress={handleKeyPress}
                placeholder={$t("searchPlaceholder")}
                aria-label="Arama"
                class="search-input-header"
            />
            {#if inputQuery}
                <button
                    class="clear-button-header"
                    on:click={() => {
                        inputQuery = "";
                        document.querySelector(".search-input-header")?.focus();
                    }}
                    aria-label="Aramayı temizle"
                >
                    <i class="fas fa-times"></i>
                </button>
            {/if}
            <button
                class="search-button-header"
                on:click={() => handleSearchSubmit()}
                aria-label="Ara"
            >
                <i class="fas fa-search"></i>
            </button>
        </div>
        <div class="header-actions">
            <button
                class="icon-button settings-button-header"
                aria-label={$t("settings")}
                on:click={toggleSidebar}
            >
                <i class="fas fa-sliders-h"></i>
            </button>
        </div>
    </header>

    <!-- Search Type Tabs -->
    <nav class="search-type-nav" aria-label="Arama türleri">
        <div class="search-type-nav-inner">
            <button
                class:active={activeSearchType === "web"}
                on:click={() => changeSearchType("web")}
            >
                <i class="fas fa-search" aria-hidden="true"></i>
                {$t("all")}
            </button>
            <button
                class:active={activeSearchType === "images"}
                on:click={() => changeSearchType("images")}
            >
                <i class="fas fa-image" aria-hidden="true"></i>
                {$t("images")}
            </button>
            <button
                class:active={activeSearchType === "videos"}
                on:click={() => changeSearchType("videos")}
            >
                <i class="fas fa-video" aria-hidden="true"></i>
                {$t("videos")}
            </button>
            <button
                class:active={activeSearchType === "news"}
                on:click={() => changeSearchType("news")}
            >
                <i class="fas fa-newspaper" aria-hidden="true"></i>
                {$t("news")}
            </button>
            <!-- Add more types like News if needed -->
        </div>
    </nav>

    {#if activeSearchType === "images"}
        <div class="image-filters" role="region" aria-label="Görsel filtreleri">
            <div class="select-wrapper">
                <select
                    bind:value={imageSize}
                    on:change={() => {
                        offset = 0;
                        handleSearchSubmit("images");
                    }}
                    aria-label="Boyut"
                >
                    <option value="">Boyut: Tümü</option>
                    <option value="small">Küçük</option>
                    <option value="medium">Orta</option>
                    <option value="large">Büyük</option>
                </select>
                <i class="fas fa-chevron-down dropdown-icon" aria-hidden="true"
                ></i>
            </div>
            <div class="select-wrapper">
                <select
                    bind:value={imageColor}
                    on:change={() => {
                        offset = 0;
                        handleSearchSubmit("images");
                    }}
                    aria-label="Renk"
                >
                    <option value="">Renk: Tümü</option>
                    <option value="color">Renkli</option>
                    <option value="monochrome">Siyah-Beyaz</option>
                    <option value="red">Kırmızı</option>
                    <option value="orange">Turuncu</option>
                    <option value="yellow">Sarı</option>
                    <option value="green">Yeşil</option>
                    <option value="blue">Mavi</option>
                    <option value="purple">Mor</option>
                    <option value="pink">Pembe</option>
                    <option value="brown">Kahverengi</option>
                    <option value="black">Siyah</option>
                    <option value="white">Beyaz</option>
                </select>
                <i class="fas fa-chevron-down dropdown-icon" aria-hidden="true"
                ></i>
            </div>
            <div class="select-wrapper">
                <select
                    bind:value={imageAspect}
                    on:change={() => {
                        offset = 0;
                        handleSearchSubmit("images");
                    }}
                    aria-label="En/Boy Oranı"
                >
                    <option value="">Oran: Tümü</option>
                    <option value="square">Kare</option>
                    <option value="wide">Geniş</option>
                    <option value="tall">Yüksek</option>
                </select>
                <i class="fas fa-chevron-down dropdown-icon" aria-hidden="true"
                ></i>
            </div>
            <div class="select-wrapper">
                <select
                    bind:value={imageType}
                    on:change={() => {
                        offset = 0;
                        handleSearchSubmit("images");
                    }}
                    aria-label="Tür"
                >
                    <option value="">Tür: Tümü</option>
                    <option value="photo">Fotoğraf</option>
                    <option value="vector">Vektör</option>
                    <option value="clipart">Clipart</option>
                </select>
                <i class="fas fa-chevron-down dropdown-icon" aria-hidden="true"
                ></i>
            </div>
            <div class="select-wrapper">
                <select
                    bind:value={imagePalette}
                    on:change={() => {
                        offset = 0;
                        handleSearchSubmit("images");
                    }}
                    aria-label="Palet"
                >
                    <option value="">Palet: Tümü</option>
                    <option value="warm">Sıcak</option>
                    <option value="cool">Soğuk</option>
                    <option value="pastel">Pastel</option>
                    <option value="vibrant">Canlı</option>
                </select>
                <i class="fas fa-chevron-down dropdown-icon" aria-hidden="true"
                ></i>
            </div>
        </div>
    {/if}

    {#if activeSearchType === "news"}
        <div class="news-filters" role="region" aria-label="Haber filtreleri">
            <input
                class="news-filter-input"
                type="text"
                placeholder="Kaynak (domain veya isim)"
                bind:value={newsSource}
                on:change={() => {
                    offset = 0;
                    handleSearchSubmit("news");
                }}
            />
            <input
                class="news-filter-input"
                type="date"
                bind:value={newsStartDate}
                on:change={() => {
                    offset = 0;
                    handleSearchSubmit("news");
                }}
            />
            <input
                class="news-filter-input"
                type="date"
                bind:value={newsEndDate}
                on:change={() => {
                    offset = 0;
                    handleSearchSubmit("news");
                }}
            />
        </div>
    {/if}
    {#if activeSearchType === "images"}
        <div class="image-filters" role="region" aria-label="Görsel filtreleri">
            <div class="select-wrapper">
                <select
                    bind:value={imageSize}
                    on:change={() => handleSearchSubmit("images")}
                    aria-label="Boyut"
                >
                    <option value="">Boyut: Tümü</option>
                    <option value="small">Küçük</option>
                    <option value="medium">Orta</option>
                    <option value="large">Büyük</option>
                </select>
                <i class="fas fa-chevron-down dropdown-icon" aria-hidden="true"
                ></i>
            </div>
            <div class="select-wrapper">
                <select
                    bind:value={imageColor}
                    on:change={() => handleSearchSubmit("images")}
                    aria-label="Renk"
                >
                    <option value="">Renk: Tümü</option>
                    <option value="color">Renkli</option>
                    <option value="monochrome">Siyah-Beyaz</option>
                    <option value="red">Kırmızı</option>
                    <option value="green">Yeşil</option>
                    <option value="blue">Mavi</option>
                </select>
                <i class="fas fa-chevron-down dropdown-icon" aria-hidden="true"
                ></i>
            </div>
            <div class="select-wrapper">
                <select
                    bind:value={imageAspect}
                    on:change={() => handleSearchSubmit("images")}
                    aria-label="En/Boy Oranı"
                >
                    <option value="">Oran: Tümü</option>
                    <option value="square">Kare</option>
                    <option value="wide">Geniş</option>
                    <option value="tall">Yüksek</option>
                </select>
                <i class="fas fa-chevron-down dropdown-icon" aria-hidden="true"
                ></i>
            </div>
        </div>
    {/if}

    <div class="main-content-area">
        <main class="results-container" aria-live="polite">
            {#if isLoading}
                <div
                    class="loading-skeleton-container"
                    in:fade={{ duration: 200 }}
                >
                    <!-- Skeleton Items -->
                    {#each Array(5) as _, i}
                        <div class="skeleton-card">
                            <div class="skeleton-header">
                                <div class="skeleton-icon"></div>
                                <div class="skeleton-domain"></div>
                            </div>
                            <div class="skeleton-title"></div>
                            <div class="skeleton-desc"></div>
                        </div>
                    {/each}
                </div>
            {:else if $error}
                <div class="error-message" role="alert">
                    <i class="fas fa-exclamation-triangle" aria-hidden="true"
                    ></i>
                    Sonuçlar yüklenirken hata oluştu: {$error}
                </div>

                <!-- === WEB RESULTS === -->
            {:else if activeSearchType === "web"}
                {#if filteredResults.length > 0}
                    <div class="results-list web-results">
                        {#each filteredResults as result (result.url)}
                            <div class="result-item-card">
                                <div class="result-header">
                                    <img
                                        src={result.icon || "/favicon.ico"}
                                        alt=""
                                        class="favicon"
                                        loading="lazy"
                                        on:error={(e) => {
                                            e.target.style.visibility =
                                                "hidden";
                                        }}
                                    />
                                    <span class="result-domain"
                                        >{getDomain(result.url)}</span
                                    >
                                    {#if result.age}
                                        <span class="result-age">
                                            - {formatAge(result.age)}</span
                                        >
                                    {/if}

                                    <div class="result-menu-container">
                                        <button
                                            class="more-options"
                                            aria-label="Daha fazla seçenek"
                                            on:click={(e) =>
                                                toggleMenu(result.url, e)}
                                        >
                                            <i
                                                class="fas fa-ellipsis-v"
                                                aria-hidden="true"
                                            ></i>
                                        </button>
                                        {#if openMenuUrl === result.url}
                                            <div
                                                class="dropdown-menu"
                                                transition:fade={{
                                                    duration: 100,
                                                }}
                                            >
                                                <button
                                                    on:click={() =>
                                                        blockSite(result.url)}
                                                >
                                                    <i class="fas fa-ban"></i> Bu
                                                    siteyi engelle
                                                </button>
                                                <button
                                                    on:click={() => {
                                                        navigator.clipboard.writeText(
                                                            result.url,
                                                        );
                                                        closeMenu();
                                                    }}
                                                >
                                                    <i class="fas fa-copy"></i> Bağlantıyı
                                                    kopyala
                                                </button>
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                                <h3 class="result-title">
                                    <a
                                        href={result.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        >{result.title}</a
                                    >
                                </h3>
                                <p class="result-description">
                                    {@html result.description ||
                                        "Açıklama yok."}
                                </p>
                            </div>
                        {/each}
                    </div>
                    <p class="results-count">
                        Yaklaşık {filteredResults.length} sonuç bulundu.
                    </p>
                {:else if searchQuery}
                    <!-- Fallback if all results are blocked -->
                    <div class="no-results">
                        <p>
                            "<strong>{searchQuery}</strong>" için sonuç
                            bulunamadı (bazı sonuçlar engellenmiş olabilir).
                        </p>
                    </div>
                {:else}
                    <div class="no-results">
                        <p>
                            "<strong>{searchQuery}</strong>" için web sonucu
                            bulunamadı.
                        </p>
                    </div>
                {/if}

                <!-- === IMAGE RESULTS === -->
            {:else if activeSearchType === "images"}
                {#if $searchResults.length > 0}
                    <div class="results-grid image-results">
                        {#each $searchResults as result, i (result.thumbnail + i)}
                            <a
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="image-result-item"
                            >
                                <img
                                    src={result.thumbnail}
                                    alt={result.title || "Görsel"}
                                    loading="lazy"
                                    on:error={(e) => {
                                        e.target.style.display = "none";
                                        e.target.parentElement.classList.add(
                                            "no-image",
                                        );
                                    }}
                                />
                                <div class="image-info">
                                    <span class="image-title"
                                        >{result.title}</span
                                    >
                                    <span class="image-source"
                                        >{getDomain(result.source)}</span
                                    >
                                </div>
                            </a>
                        {/each}
                    </div>
                    <p class="results-count">
                        {$searchResults.length} görsel bulundu.
                    </p>
                    <div class="load-more-wrapper">
                        <button
                            class="button button-secondary"
                            on:click={loadMore}>Daha fazla yükle</button
                        >
                    </div>
                {:else if searchQuery}
                    <div class="no-results">
                        <p>'{searchQuery}' için görsel sonucu bulunamadı.</p>
                    </div>
                {/if}

                <!-- === VIDEO RESULTS === -->
            {:else if activeSearchType === "videos"}
                {#if $searchResults.length > 0}
                    <div class="results-list video-results">
                        {#each $searchResults as result (result.url)}
                            <div class="result-item-card video-item-card">
                                <div class="video-thumbnail-container">
                                    <a
                                        href={result.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={result.title}
                                    >
                                        <img
                                            src={result.thumbnail}
                                            alt=""
                                            class="video-thumbnail"
                                            loading="lazy"
                                            on:error={(e) => {
                                                e.target.style.visibility =
                                                    "hidden";
                                            }}
                                        />
                                        {#if result.duration}
                                            <span class="video-duration"
                                                >{formatDuration(
                                                    result.duration,
                                                )}</span
                                            >
                                        {/if}
                                    </a>
                                </div>
                                <div class="video-details">
                                    <h3 class="result-title video-title">
                                        <a
                                            href={result.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            >{result.title}</a
                                        >
                                    </h3>
                                    <div class="video-meta">
                                        {#if result.publisher}
                                            <span class="video-publisher"
                                                >{result.publisher}</span
                                            >
                                        {/if}
                                        {#if result.age}
                                            <span class="video-age"
                                                >{formatAge(result.age)}</span
                                            >
                                        {/if}
                                    </div>
                                    <p
                                        class="result-description video-description"
                                    >
                                        {result.description || "Açıklama yok."}
                                    </p>
                                </div>
                            </div>
                        {/each}
                    </div>
                    <p class="results-count">
                        {$searchResults.length} video bulundu.
                    </p>
                    <div class="load-more-wrapper">
                        <button
                            class="button button-secondary"
                            on:click={loadMore}>Daha fazla yükle</button
                        >
                    </div>
                {:else if searchQuery}
                    <div class="no-results">
                        <p>'{searchQuery}' için video sonucu bulunamadı.</p>
                    </div>
                {/if}

                <!-- === NEWS RESULTS === -->
            {:else if activeSearchType === "news"}
                {#if $searchResults.length > 0}
                    <div class="results-list news-results">
                        {#each $searchResults as result (result.url)}
                            <div class="result-item-card news-item-card">
                                <h3 class="result-title">
                                    <a
                                        href={result.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        >{result.title}</a
                                    >
                                </h3>
                                <div class="news-meta">
                                    {#if result.source}<span class="news-source"
                                            >{result.source}</span
                                        >{/if}
                                    {#if result.age}<span class="news-age"
                                            >{result.age}</span
                                        >{/if}
                                </div>
                                {#if result.thumbnail}
                                    <img
                                        src={result.thumbnail}
                                        alt=""
                                        class="news-thumbnail"
                                        loading="lazy"
                                        on:error={(e) => {
                                            e.target.style.display = "none";
                                        }}
                                    />
                                {/if}
                                {#if result.description}<p
                                        class="result-description"
                                    >
                                        {result.description}
                                    </p>{/if}
                            </div>
                        {/each}
                    </div>
                    <p class="results-count">
                        {$searchResults.length} haber bulundu.
                    </p>
                    <div class="load-more-wrapper">
                        <button
                            class="button button-secondary"
                            on:click={loadMore}>Daha fazla yükle</button
                        >
                    </div>
                {:else if searchQuery}
                    <div class="no-results">
                        <p>'{searchQuery}' için haber bulunamadı.</p>
                    </div>
                {/if}

                <!-- Fallback for other types or initial state -->
            {:else if !isLoading && !$error && !searchQuery}
                <div class="no-results">
                    <p>Arama yapmak için yukarıdaki kutuyu kullanın.</p>
                </div>
            {:else if !isLoading && !$error}
                <div class="no-results">
                    <p>
                        '{searchQuery}' için ({activeSearchType}) sonucu
                        bulunamadı veya bu tür desteklenmiyor.
                    </p>
                </div>
            {/if}
        </main>

        <!-- === Infobox Area === -->
        {#if $infoBoxResult && !isLoading && !$error}
            <aside class="infobox-container">
                <!-- Wikipedia Özet Kutusu (Öncelikli gösterilir) -->
                {#if $infoBoxResult.wikipediaInfo}
                    <div class="infobox-card wikipedia-box">
                        <h4>
                            <i class="fas fa-book-open wiki-icon"></i>
                            {$infoBoxResult.wikipediaInfo.title || "Wikipedia"}
                        </h4>
                        {#if $infoBoxResult.wikipediaInfo.thumbnail}
                            <img
                                src={$infoBoxResult.wikipediaInfo.thumbnail}
                                alt={$infoBoxResult.wikipediaInfo.title || ""}
                                class="infobox-image"
                                loading="lazy"
                                on:error={(e) => {
                                    e.target.style.display = "none";
                                }}
                            />
                        {/if}
                        {#if $infoBoxResult.wikipediaInfo.extract}
                            <p class="wiki-extract">
                                {$infoBoxResult.wikipediaInfo.extract}
                            </p>
                        {/if}
                        {#if $infoBoxResult.wikipediaInfo.url}
                            <a
                                href={$infoBoxResult.wikipediaInfo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="wiki-link"
                            >
                                <i class="fas fa-external-link-alt"></i> Wikipedia'da
                                devamını oku
                            </a>
                        {/if}
                    </div>
                {/if}

                <!-- Diğer Infobox Tipleri (Sadece Wikipedia yoksa gösterilir) -->
                {#if !$infoBoxResult.wikipediaInfo}
                    {#if $infoBoxResult.type === "calculator"}
                        <div class="infobox-card calculator-box">
                            <h4>Hesap Makinesi</h4>
                            <p class="calc-query">{$infoBoxResult.query}</p>
                            <p class="calc-result">= {$infoBoxResult.result}</p>
                        </div>
                    {:else if $infoBoxResult.type === "location" && $infoBoxResult.data}
                        <div class="infobox-card location-box">
                            <h4>
                                {$infoBoxResult.data.name || "Konum Bilgisi"}
                            </h4>
                            {#if $infoBoxResult.data.profile?.img}
                                <img
                                    src={$infoBoxResult.data.profile.img}
                                    alt={$infoBoxResult.data.name || ""}
                                    class="infobox-image"
                                    loading="lazy"
                                    on:error={(e) => {
                                        e.target.style.display = "none";
                                    }}
                                />
                            {/if}
                            {#if $infoBoxResult.data.description}
                                <p>{$infoBoxResult.data.description}</p>
                            {/if}
                            {#if $infoBoxResult.data.address?.streetAddress}
                                <p class="address">
                                    {$infoBoxResult.data.address.streetAddress}, {$infoBoxResult
                                        .data.address.addressLocality || ""}
                                </p>
                            {/if}
                            {#if $infoBoxResult.data.url}
                                <a
                                    href={$infoBoxResult.data.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    >Daha fazla bilgi</a
                                >
                            {/if}
                        </div>
                    {:else if $infoBoxResult.type === "generic_infobox"}
                        <div class="infobox-card">
                            <h4>{$infoBoxResult.title || "Site Bilgisi"}</h4>

                            {#if $infoBoxResult.profile?.img}
                                <img
                                    src={$infoBoxResult.profile.img}
                                    alt={$infoBoxResult.title || "Logo"}
                                    class="infobox-image"
                                    loading="lazy"
                                    on:error={(e) => {
                                        console.warn(
                                            "Infobox image failed to load:",
                                            e.target.src,
                                        );
                                        e.target.style.display = "none";
                                    }}
                                />
                            {/if}

                            {#if $infoBoxResult.description}
                                <p>{$infoBoxResult.description}</p>
                            {:else}
                                <p class="text-secondary">
                                    Açıklama bulunamadı.
                                </p>
                            {/if}

                            {#if $infoBoxResult.url}
                                <a
                                    href={$infoBoxResult.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    >Siteye Git <i
                                        class="fas fa-external-link-alt"
                                    ></i></a
                                >
                            {/if}
                        </div>
                    {:else}
                        <!-- Fallback for other known/unknown infobox types -->
                        <div class="infobox-card">
                            <h4>
                                {$infoBoxResult.title ||
                                    $infoBoxResult.type ||
                                    "Bilgi"}
                            </h4>
                            {#if $infoBoxResult.description || $infoBoxResult.result}
                                <p>
                                    {$infoBoxResult.description ||
                                        $infoBoxResult.result}
                                </p>
                            {/if}
                            <!-- Try to show image even in fallback if it exists -->
                            {#if $infoBoxResult.profile?.img}
                                <img
                                    src={$infoBoxResult.profile.img}
                                    alt="Info"
                                    class="infobox-image"
                                    style="max-width: 100px; display: block; margin-top: 10px;"
                                    on:error={(e) =>
                                        (e.target.style.display = "none")}
                                />
                            {/if}
                            {#if $infoBoxResult.url}<a
                                    href={$infoBoxResult.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    >Daha fazla bilgi</a
                                >{/if}
                        </div>
                    {/if}
                {/if}
                <!-- End of check for !$infoBoxResult.wikipediaInfo -->
            </aside>
        {/if}
    </div>
</div>

<style>
    /* Global page styles */
    .search-results-page {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background-color: var(--background-color);
    }

    /* Header styles */
    .search-header {
        display: flex;
        align-items: center;
        padding: 0.8rem 1.5rem;
        border-bottom: 1px solid var(--border-color);
        background-color: var(--card-background);
        position: sticky;
        top: 0;
        z-index: 1000;
        gap: 1.2rem;
    }
    .logo-link {
        flex-shrink: 0;
        display: flex;
        align-items: center;
    }
    .header-logo {
        height: 30px;
        width: auto;
    }

    .search-bar-container {
        flex-grow: 1;
        display: flex;
        align-items: center;
        background-color: var(--input-background);
        border-radius: 25px;
        border: 1px solid var(--border-color);
        padding: 0 0.5rem 0 1rem;
        max-width: 700px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        transition:
            border-color 0.2s,
            box-shadow 0.2s;
    }
    .search-bar-container:focus-within {
        border-color: var(--primary-color);
        box-shadow:
            0 0 0 1px var(--primary-color),
            0 2px 5px rgba(0, 0, 0, 0.08); /* Enhanced focus */
    }

    .search-input-header {
        flex-grow: 1;
        border: none;
        outline: none;
        padding: 0.6rem 0.5rem;
        font-size: 1rem;
        background: transparent;
        color: var(--text-color);
    }

    .clear-button-header {
        background: none;
        border: none;
        color: var(--text-color-secondary);
        cursor: pointer;
        font-size: 1.1rem;
        padding: 0 0.5rem;
        line-height: 1;
    }
    .clear-button-header:hover {
        color: var(--text-color);
    }

    .search-button-header {
        background: none;
        border: none;
        color: var(--primary-color);
        cursor: pointer;
        font-size: 1.1rem;
        padding: 0 0.8rem 0 0.3rem;
        margin-left: 0.2rem;
        line-height: 1;
    }
    .search-button-header:hover {
        opacity: 0.8;
    }

    .header-actions {
        margin-left: auto;
        flex-shrink: 0;
    }
    .icon-button {
        /* Settings button */
        background: none;
        border: none;
        color: var(--text-color-secondary);
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0.3rem;
        border-radius: 50%;
        transition: background-color 0.2s;
    }
    .icon-button:hover {
        color: var(--text-color);
        background-color: var(--hover-background);
    }
    .settings-button-header {
        font-size: 1.3rem; /* Make slightly larger */
        padding: 0.6rem; /* Adjust padding */
    }
    .settings-button-header:hover {
        /* Inherits hover */
    }

    /* Search Type Navigation */
    .search-type-nav {
        display: flex;
        border-bottom: 1px solid var(--border-color);
        background-color: var(--background-color);
        position: sticky;
        top: 61px;
        z-index: 999;
        /* Ensure full width, no padding/max-width here */
        padding: 0;
        max-width: none;
    }

    /* Inner container for alignment and scrolling */
    .search-type-nav-inner {
        display: flex;
        justify-content: flex-start; /* Ensure left alignment */
        gap: 1.5rem;
        max-width: 1100px; /* Align with main content max-width */
        width: 100%;
        padding: 0 1.5rem; /* Keep horizontal padding */
        /* Horizontal scroll styles */
        overflow-x: auto;
        white-space: nowrap;
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
    .search-type-nav-inner::-webkit-scrollbar {
        display: none;
    }

    /* Button styles */
    .search-type-nav button {
        background: none;
        border: none;
        color: var(--text-color-secondary);
        cursor: pointer;
        padding: 0.8rem 0.2rem; /* Keep vertical padding */
        font-size: 0.95rem;
        border-bottom: 3px solid transparent; /* Thicker transparent border for spacing */
        transition:
            color 0.2s,
            border-color 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        flex-shrink: 0;
        margin-bottom: -1px; /* Overlap the main border slightly */
    }
    .search-type-nav button:hover {
        color: var(--text-color);
    }
    .search-type-nav button.active {
        color: var(--primary-color);
        border-bottom-color: var(--primary-color);
        font-weight: 600;
    }

    /* ... rest of styles ... */

    /* Adjust responsive breakpoints for inner container */
    @media (max-width: 1200px) {
        .search-type-nav-inner {
            padding: 0 1rem; /* Adjust padding */
        }
        /* ... other styles ... */
    }
    @media (max-width: 768px) {
        .search-type-nav-inner {
            max-width: none; /* Remove max-width for scrolling */
            padding: 0 1rem 0.3rem 1rem; /* Adjust padding */
            gap: 0.8rem;
        }
        .search-type-nav {
            /* Adjust sticky top if needed */
            top: calc(var(--header-height-small, 50px) + 1px);
        }
        /* ... other styles ... */
    }

    /* Main Content Area Layout */
    .main-content-area {
        display: flex;
        flex-wrap: wrap;
        padding: 1.5rem; /* Add padding around content */
        gap: 2rem;
        align-items: flex-start;
        max-width: 1100px;
        margin: 1rem 0 0 1.5rem; /* Align left with padding */
    }

    .results-container {
        flex: 1;
        min-width: 0; /* Allow shrinking */
        max-width: 700px;
        margin-bottom: 2rem;
    }

    /* Card polish */

    /* Menu Container */
    .result-menu-container {
        position: relative;
        margin-left: auto;
    }

    .dropdown-menu {
        position: absolute;
        right: 0;
        top: 100%;
        background: var(--card-background);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        z-index: 10;
        min-width: 180px;
        padding: 0.5rem 0;
    }
    .dropdown-menu button {
        display: flex;
        align-items: center;
        width: 100%;
        padding: 0.6rem 1rem;
        border: none;
        background: none;
        text-align: left;
        cursor: pointer;
        color: var(--text-color);
        font-size: 0.9rem;
        gap: 0.8rem;
    }
    .dropdown-menu button:hover {
        background: var(--hover-background);
        color: var(--primary-color);
    }

    .result-item-card:hover {
        transform: translateY(-1px);
    }
    .results-list {
        gap: 1.1rem;
    }
    .result-title {
        letter-spacing: 0.1px;
    }
    .result-description {
        color: var(--text-color-secondary);
    }

    .image-results {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 1rem;
    }
    .image-result-item {
        display: block;
        background: var(--card-background);
        border-radius: 8px;
        overflow: hidden;
        text-decoration: none;
        transition:
            transform 0.2s,
            box-shadow 0.2s;
        border: 1px solid var(--border-color);
    }
    .image-result-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    .image-result-item img {
        width: 100%;
        height: 150px;
        object-fit: cover;
        display: block;
        background-color: #eee;
    }
    .image-info {
        padding: 0.5rem;
        background: rgba(0, 0, 0, 0.02);
    }
    .image-title {
        display: block;
        font-size: 0.85rem;
        color: var(--text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-weight: 500;
    }
    .image-source {
        display: block;
        font-size: 0.75rem;
        color: var(--text-color-secondary);
        margin-top: 0.2rem;
    }

    /* Load more area */
    .load-more-wrapper {
        display: flex;
        justify-content: center;
        margin-top: 0.8rem;
    }

    .infobox-container {
        width: 300px;
        flex-shrink: 0;
        margin-top: 0;
        position: sticky;
        /* Adjust top based on header + nav height */
        top: calc(61px + 48px + 1.5rem); /* Header + Nav + Top Padding */
        align-self: flex-start;
    }

    /* Responsive adjustments */
    @media (max-width: 1200px) {
        /* Adjust alignment margin */
        .main-content-area {
            margin-left: 1rem;
            margin-right: 1rem;
        }
    }
    @media (max-width: 1024px) {
        .infobox-container {
            width: 250px;
            top: calc(61px + 48px + 1rem); /* Adjust top for smaller padding */
        }
        .main-content-area {
            /* margin needs to be adjusted for smaller screens */
            margin: 1rem 0 0 0; /* Remove side margin for full bleed */
        }
        .search-header,
        .search-type-nav {
            padding-left: 1rem;
            padding-right: 1rem;
        }
    }
    @media (max-width: 768px) {
        .main-content-area {
            flex-direction: column;
            padding: 1rem;
        }
        .results-container {
            max-width: 100%;
            order: 1;
        }
        .infobox-container {
            width: 100%;
            position: static;
            order: 2;
            margin-top: 1rem;
        }
        .search-header {
            padding: 0.6rem 1rem; /* Adjust padding */
            gap: 0.8rem; /* Reduce gap */
            /* Hide logo on very small screens? Example: */
            /* @media (max-width: 480px) { & .logo-link { display: none; } } */
        }
        .search-input-header {
            font-size: 0.95rem; /* Slightly smaller font */
        }
        .search-button-header,
        .clear-button-header {
            font-size: 1rem; /* Adjust icon size */
        }
        .settings-button-header {
            font-size: 1.2rem; /* Adjust icon size */
            padding: 0.5rem;
        }

        .search-type-nav {
            top: calc(
                var(--header-height-small, 50px) + 1px
            ); /* Adjust sticky top based on smaller header */
            gap: 0.8rem; /* Reduce gap */
            padding: 0 1rem 0.3rem 1rem; /* Add bottom padding for scrollbar */
            /* Add horizontal scroll */
            overflow-x: auto;
            white-space: nowrap;
            /* Hide scrollbar visually if desired */
            -ms-overflow-style: none; /* IE and Edge */
            scrollbar-width: none; /* Firefox */
        }
        .search-type-nav::-webkit-scrollbar {
            /* Chrome, Safari, Opera */
            display: none;
        }

        .search-type-nav button {
            font-size: 0.9rem;
            padding: 0.6rem 0.4rem; /* Adjust padding */
            flex-shrink: 0; /* Prevent shrinking */
        }
        .results-list {
            gap: 0.8rem; /* Reduce gap between results */
        }
        .result-item-card {
            padding: 0.8rem 1rem; /* Reduce padding */
        }
        .result-title {
            font-size: 1.1rem; /* Reduce title size */
        }
        .video-item-card {
            flex-direction: column; /* Stack video thumbnail and details */
        }
        .video-thumbnail-container {
            width: 100%; /* Full width thumbnail */
            max-width: 250px; /* Optional max width */
        }
    }
    /* Filter Styles */
    .image-filters,
    .news-filters {
        display: flex;
        gap: 0.8rem;
        flex-wrap: wrap;
        padding: 0.5rem 1.5rem;
        margin-bottom: 1rem;
        background-color: var(
            --background-color-secondary
        ); /* Or a slight contrast */
    }

    .select-wrapper {
        position: relative;
        display: inline-block;
    }

    .select-wrapper select {
        appearance: none;
        -webkit-appearance: none;
        background-color: var(--card-background);
        border: 1px solid var(--border-color);
        border-radius: 20px;
        padding: 0.5rem 2rem 0.5rem 1rem;
        font-size: 0.9rem;
        color: var(--text-color);
        cursor: pointer;
        transition:
            border-color 0.2s,
            background-color 0.2s;
    }

    .select-wrapper select:hover {
        background-color: var(--hover-background);
    }

    .select-wrapper select:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.2);
    }

    .dropdown-icon {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        font-size: 0.8rem;
        color: var(--text-color-secondary);
    }

    .news-filter-input {
        background-color: var(--card-background);
        border: 1px solid var(--border-color);
        border-radius: 20px;
        padding: 0.5rem 1rem;
        font-size: 0.9rem;
        color: var(--text-color);
        outline: none;
    }
    .news-filter-input:focus {
        border-color: var(--primary-color);
    }
    /* Image grid adjustments for smaller screens */
    @media (max-width: 600px) {
        .image-results {
            grid-template-columns: repeat(
                auto-fill,
                minmax(120px, 1fr)
            ); /* Fewer/smaller columns */
            gap: 0.5rem;
        }
        .image-result-item img {
            height: 120px; /* Adjust height */
        }
    }
    @media (max-width: 400px) {
        .image-results {
            grid-template-columns: repeat(
                auto-fill,
                minmax(100px, 1fr)
            ); /* Even smaller */
        }
        .image-result-item img {
            height: 100px;
        }
    }

    /* Loading, Error, No Results States */
    .loading-indicator,
    .error-message,
    .no-results {
        text-align: center;
        margin-top: 3rem;
        padding: 1.5rem;
        color: var(--text-color-secondary);
        border-radius: 8px;
        background-color: var(--card-background);
        border: 1px solid var(--border-color);
    }
    .loading-indicator i,
    .error-message i {
        margin-right: 0.5rem;
    }
    .error-message {
        color: #e57373;
        background-color: rgba(229, 115, 115, 0.1);
        border: 1px solid rgba(229, 115, 115, 0.3);
        text-align: left;
    }
    .no-results p {
        margin-bottom: 0.5rem;
    }
    .no-results p:last-child {
        margin-bottom: 0;
    }

    /* Enhanced Result Item Card */
    .result-item-card {
        background-color: var(--card-background);
        border: 1px solid rgba(127, 127, 127, 0.15);
        border-radius: 12px;
        padding: 1.2rem 1.4rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        transition: all 0.3s ease;
        overflow: hidden;
        position: relative;
    }
    .result-item-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
        border-color: rgba(127, 127, 127, 0.25);
    }
    .result-item-card::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(
            90deg,
            var(--primary-color),
            rgba(var(--primary-color-rgb), 0.3)
        );
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    .result-item-card:hover::before {
        opacity: 1;
    }

    /* Web/Video Result List Layout */
    .results-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    /* News result card improvements */
    .news-item-card {
        display: grid;
        grid-template-columns: 1fr 120px;
        gap: 0.8rem;
        align-items: start;
    }
    .news-item-card .news-thumbnail {
        width: 120px;
        height: 80px;
        object-fit: cover;
        border-radius: 6px;
        background-color: var(--border-color);
    }
    .news-item-card .result-title {
        margin-bottom: 0.4rem;
    }
    .news-item-card .result-description {
        margin-top: 0.3rem;
    }
    .news-meta {
        display: flex;
        gap: 0.8rem;
        align-items: center;
        font-size: 0.85rem;
        color: var(--text-color-secondary);
    }
    .news-source {
        font-weight: 500;
    }
    .news-age {
        opacity: 0.9;
    }

    /* Result Header (Web/Video) */
    .result-header {
        display: flex;
        align-items: center;
        margin-bottom: 0.4rem;
        gap: 0.5rem;
        line-height: 1.2; /* Prevent jumpiness */
    }
    .favicon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        vertical-align: middle;
    }
    .result-domain {
        font-size: 0.85rem;
        color: var(--text-color-secondary);
        flex-grow: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .result-age,
    .video-age {
        font-size: 0.8rem;
        color: var(--text-color-secondary);
        flex-shrink: 0;
        white-space: nowrap;
    }
    .more-options {
        background: none;
        border: none;
        color: var(--text-color-secondary);
        cursor: pointer;
        font-size: 1rem;
        padding: 0.2rem 0.3rem;
        line-height: 1;
        flex-shrink: 0;
        border-radius: 50%;
        transition: background-color 0.2s;
    }
    .more-options:hover {
        color: var(--text-color);
        background-color: var(--hover-background);
    }

    /* Enhanced Result Title */
    .result-title {
        font-size: 1.25rem;
        margin-bottom: 0.4rem;
        margin-top: 0;
        line-height: 1.4;
        font-weight: 500;
    }
    .result-title a {
        color: var(--link-color);
        text-decoration: none;
        font-weight: 400; /* Standard weight like Google */
        word-break: break-word;
    }
    .result-title a:hover {
        text-decoration: underline;
    }
    .result-title a:visited {
        color: var(--link-visited-color);
    }

    /* Enhanced Result Description */
    .result-description {
        font-size: 0.95rem;
        color: var(--text-color-secondary);
        line-height: 1.6;
        margin-top: 0.2rem;
    }

    /* AI Query Summary Box (at the top) */
    .ai-query-summary-box {
        margin-bottom: 1.5rem; /* Space below the summary box */
        padding: 0; /* Remove padding from card base */
        border: none; /* Optional: remove border if desired */
        background-color: transparent; /* Optional: make background transparent */
        box-shadow: none; /* Optional: remove shadow */
    }
    .ai-query-summary-box .ai-summary,
    .ai-query-summary-box .ai-error {
        border-radius: 6px; /* Add back border-radius */
        border-width: 1px; /* Use 1px border */
        border-style: solid;
    }
    .ai-query-summary-box .ai-summary {
        border-color: rgba(
            var(--primary-color-rgb),
            0.3
        ); /* Border color for summary */
    }
    .ai-query-summary-box .ai-error {
        border-color: rgba(
            var(--danger-color-rgb, 220, 53, 69),
            0.3
        ); /* Border color for error */
    }
    .ai-query-summary-box .ai-icon {
        margin-top: 0.1em;
    } /* Slightly adjust icon */

    /* --- Enhanced AI Query Summary Box Styles --- */
    .ai-query-summary-box.enhanced-ai-box {
        margin-bottom: 1.5rem;
        padding: 1rem; /* Add padding inside the box */
        border-radius: 8px; /* Slightly more rounded corners */
        border: 1px solid rgba(var(--primary-color-rgb), 0.2);
        background-color: rgba(
            var(--primary-color-rgb),
            0.05
        ); /* Light primary background */
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        border-left: 4px solid rgba(var(--primary-color-rgb), 0.5);
    }

    .ai-query-summary-box.error-ai-box {
        border-color: rgba(var(--danger-color-rgb, 220, 53, 69), 0.2);
        background-color: rgba(var(--danger-color-rgb, 220, 53, 69), 0.05);
        border-left-color: rgba(var(--danger-color-rgb, 220, 53, 69), 0.5);
    }

    .ai-box-header {
        display: flex;
        align-items: center;
        margin-bottom: 0.75rem;
        color: var(--text-secondary-color);
    }

    .ai-box-header .ai-icon {
        margin-right: 0.5rem;
        font-size: 1.1em;
        color: rgba(var(--primary-color-rgb), 0.7);
    }
    .error-ai-box .ai-box-header .ai-icon {
        color: rgba(var(--danger-color-rgb, 220, 53, 69), 0.7);
    }

    .ai-box-title {
        font-weight: 600;
        font-size: 0.9rem;
        color: var(--text-primary-color);
    }

    .ai-query-summary-box .ai-summary,
    .ai-query-summary-box .ai-error {
        margin: 0; /* Remove default paragraph margin */
        padding: 0; /* Remove padding */
        border: none; /* Remove previous border */
        font-size: 0.95rem;
        line-height: 1.6;
        color: var(--text-primary-color);
    }
    .ai-query-summary-box .ai-error {
        color: var(--danger-color, #dc3545);
    }

    /* Enhanced Results Count */
    .results-count {
        text-align: center;
        font-size: 0.9rem;
        color: var(--text-color-secondary);
        margin-top: 2.5rem;
        margin-bottom: 1.5rem;
        padding: 0.8rem 1.2rem;
        background-color: var(--card-background);
        border-radius: 8px;
        border: 1px solid var(--border-color);
        display: inline-block;
    }

    /* === Image Results Grid === */
    .image-results {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 0.8rem;
    }
    .image-result-item {
        display: block;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        overflow: hidden;
        text-decoration: none;
        background-color: var(--card-background);
        color: var(--text-color);
        position: relative;
        transition:
            transform 0.2s ease-in-out,
            box-shadow 0.2s ease-in-out;
    }
    .image-result-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
    }

    .image-result-item img {
        display: block;
        width: 100%;
        height: 150px;
        object-fit: cover;
        background-color: var(--border-color); /* Placeholder bg */
        border-bottom: 1px solid var(--border-color);
    }
    .image-info {
        padding: 0.5rem 0.7rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .image-title {
        display: block;
        font-size: 0.85rem;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 0.1rem;
    }
    .image-source {
        display: block;
        font-size: 0.75rem;
        color: var(--text-color-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* === Video Results List === */
    .video-item-card {
        /* Inherits base card styles */
        display: flex;
        gap: 1rem;
        align-items: flex-start;
    }
    .video-thumbnail-container {
        flex-shrink: 0;
        width: 180px; /* Larger thumbnail */
        position: relative;
    }
    .video-thumbnail-container a {
        display: block;
    }
    .video-thumbnail {
        display: block;
        width: 100%;
        height: auto;
        aspect-ratio: 16 / 9; /* Maintain aspect ratio */
        border-radius: 4px;
        background-color: var(--border-color);
        object-fit: cover; /* Cover the area */
    }
    .video-duration {
        position: absolute;
        bottom: 5px;
        right: 5px;
        background-color: rgba(0, 0, 0, 0.75);
        color: white;
        font-size: 0.75rem;
        padding: 2px 5px;
        border-radius: 3px;
    }

    .video-details {
        flex-grow: 1;
        min-width: 0; /* Allow shrinking */
    }
    .video-title {
        font-size: 1.1rem; /* Slightly smaller than web */
    }
    .video-meta {
        display: flex;
        gap: 0.8rem;
        flex-wrap: wrap;
        margin-bottom: 0.4rem;
        font-size: 0.85rem;
        color: var(--text-color-secondary);
    }
    .video-publisher {
        /* Styles inherited from .video-meta */
    }
    .video-description {
        font-size: 0.85rem;
        /* Limit lines shown */
        display: -webkit-box;
        -webkit-line-clamp: 3; /* Show 3 lines for video */
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    /* === Infobox Styles === */
    .infobox-container {
        /* Container styles defined above (width, position) */
    }
    .infobox-card {
        background-color: var(--card-background);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 1.2rem;
        margin-bottom: 1rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .infobox-card h4 {
        margin-top: 0;
        margin-bottom: 0.8rem;
        font-size: 1.1rem;
        color: var(--text-color);
        font-weight: 600;
    }
    .infobox-card p {
        font-size: 0.9rem;
        color: var(--text-color-secondary);
        margin-bottom: 0.5rem;
        line-height: 1.5;
    }
    .infobox-card a {
        color: var(--primary-color);
        text-decoration: none;
        font-size: 0.9rem;
        word-break: break-all; /* Break long URLs */
    }
    .infobox-card a:hover {
        text-decoration: underline;
    }

    .infobox-image {
        max-width: 100%;
        height: auto;
        border-radius: 4px;
        margin-bottom: 1rem; /* More space below image */
        display: block;
        background-color: var(--border-color);
    }

    /* Calculator Infobox */
    .calculator-box .calc-query {
        font-size: 1rem;
        color: var(--text-color-secondary);
        margin-bottom: 0.2rem;
        word-wrap: break-word;
    }
    .calculator-box .calc-result {
        font-size: 1.8rem; /* Larger result */
        font-weight: 600;
        color: var(--text-color);
        margin-top: 0;
        word-wrap: break-word;
    }

    /* Location Infobox */
    .location-box .address {
        font-style: normal; /* Remove italic */
        font-size: 0.9rem;
        color: var(--text-color-secondary);
        margin-top: 0.5rem;
    }

    /* Generic/Fallback Infobox */
    .infobox-card strong {
        color: var(--text-color);
    }

    /* Skeleton Loading & Animation Enhancements */
    .loading-skeleton-container {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        padding-top: 1rem;
    }

    .skeleton-card {
        padding: 1rem;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: var(--card-background);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .skeleton-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.8rem;
    }

    .skeleton-icon {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background-color: var(--hover-background);
        animation: pulse 1.5s infinite;
    }

    .skeleton-domain {
        width: 120px;
        height: 14px;
        background-color: var(--hover-background);
        border-radius: 4px;
        animation: pulse 1.5s infinite;
    }

    .skeleton-title {
        width: 60%;
        height: 22px;
        background-color: var(--hover-background);
        border-radius: 4px;
        margin-bottom: 0.5rem;
        animation: pulse 1.5s infinite;
    }

    .skeleton-desc {
        width: 90%;
        height: 16px;
        background-color: var(--hover-background);
        border-radius: 4px;
        animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
        0% {
            opacity: 0.6;
        }
        50% {
            opacity: 0.3;
        }
        100% {
            opacity: 0.6;
        }
    }

    .enhanced-ai-box {
        border-top: 4px solid #8e24aa; /* Purple accent */
        background: linear-gradient(
            180deg,
            rgba(142, 36, 170, 0.03) 0%,
            var(--card-background) 100%
        );
        padding: 1.5rem;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(142, 36, 170, 0.08);
    }

    .ai-box-header {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        margin-bottom: 0.8rem;
        color: #8e24aa;
        font-weight: 600;
        font-size: 1.1rem;
    }

    .ai-icon {
        font-size: 1.2rem;
    }

    .result-item-card {
        transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            background-color 0.2s;
    }

    .result-item-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
        border-color: var(--primary-color-light);
    }
</style>
