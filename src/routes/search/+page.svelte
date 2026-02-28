<script>
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { onMount, getContext } from "svelte";
    import { get, writable } from "svelte/store";

    function highlightParts(text, query) {
        if (!query || query.length < 2) return [{ text, bold: false }];
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(${escaped})`, "gi");
        const parts = [];
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex)
                parts.push({
                    text: text.slice(lastIndex, match.index),
                    bold: false,
                });
            parts.push({ text: match[0], bold: true });
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < text.length)
            parts.push({ text: text.slice(lastIndex), bold: false });
        return parts;
    }
    import {
        aiSummaryEnabled,
        selectedEngine,
        hybridProxyBaseUrl,
        hybridProxyEngines,
        hybridProxyLimitPerEngine,
        hybridProxyLimitTotal,
        hybridProxyTimeoutMs,
        hybridProxyCache,
        searchRegion,
        customLogo,
        enableSuggestions,
        bangsOpenNewTab,
    } from "$lib/stores.js"; // Import AI summary setting
    import { safeSearch, blockedSites } from "$lib/stores.js";
    import { t } from "$lib/i18n.js";
    import { fade, slide, fly } from "svelte/transition";
    import { browser } from "$app/environment";
    import { BANG_COMMANDS } from "$lib/bangs.js";

    // Get sidebar store from context
    const isSidebarOpen = getContext("sidebar");

    let searchQuery = $state("");
    let inputQuery = $state(""); // Separate state for the input field
    let isLoading = $state(false);
    let searchResults = writable([]);
    let specialResults = writable([]); // Results from plugins
    let error = writable(null); // Use writable store for error
    let activeSearchType = $state("web"); // 'web', 'images', 'videos', 'news' etc.
    let imageSize = $state("");
    let imageColor = $state("");
    let imageAspect = $state("");
    let imageType = $state("");
    let imagePalette = $state("");

    // News filters
    let newsSource = $state("");
    let newsStartDate = $state("");
    let newsEndDate = $state("");

    // Pagination state
    let offset = $state(0);
    let count = $state(20);
    let infoBoxResult = writable(null);
    let queryAiSummary = writable(null); // Store for the query AI summary

    function performSearch(query, skipSpelling = false) {
        if (!query) return;

        const parts = query.trim().split(/\s+/);
        const bang = parts[0].toLowerCase();
        if (bang.startsWith("!") && BANG_COMMANDS[bang]) {
            const searchQ = parts.slice(1).join(" ");
            const url = BANG_COMMANDS[bang].url + encodeURIComponent(searchQ);
            if ($bangsOpenNewTab) {
                window.open(url, "_blank");
            } else {
                window.location.href = url;
            }
            return;
        }

        const url = new URL(window.location.href);
        url.searchParams.set("i", query);
        url.searchParams.set("p", "1");
        if (skipSpelling) url.searchParams.set("spelling", "0");
        else url.searchParams.delete("spelling");
        goto(url.toString());
    }

    let count_val = $derived(
        $selectedEngine === "Hybrid Proxy" ? $hybridProxyLimitTotal : 20,
    );
    // count_val local state'e atanıyor
    $effect(() => {
        count = count_val;
    });

    // Fetch results from our backend API endpoint
    async function fetchSearchResults(query, type = "web") {
        const skipSpelling = $page.url.searchParams.get("spelling") === "0";
        if (!query) {
            searchResults.set([]);
            infoBoxResult.set(null);
            error.set(null);
            queryAiSummary.set(null); // Reset query summary
            return;
        }
        isLoading = true;
        error.set(null); // Reset error store
        infoBoxResult.set(null);
        queryAiSummary.set(null); // Reset query summary on new fetch
        console.log(`[Frontend] Fetching ${type} results for: ${query}`);

        try {
            // Construct the API URL for our backend endpoint
            const params = new URLSearchParams();
            params.set("i", query);
            params.set("t", type);
            params.set("engine", $selectedEngine);
            if (skipSpelling) params.set("spelling", "0");
            if ($selectedEngine === "Hybrid Proxy") {
                params.set("proxyBaseUrl", $hybridProxyBaseUrl);
                params.set("proxyEngines", $hybridProxyEngines);
                params.set(
                    "proxyLimitPerEngine",
                    String($hybridProxyLimitPerEngine),
                );
                params.set("proxyLimitTotal", String($hybridProxyLimitTotal));
                params.set("proxyTimeoutMs", String($hybridProxyTimeoutMs));
                params.set("proxyCache", $hybridProxyCache ? "1" : "0");
            }
            params.set("safe", $safeSearch ? "on" : "off");
            params.set("region", $searchRegion || "all");
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
            const pageIndex = Math.floor(offset / count);
            params.set("offset", String(pageIndex));
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

            // Handle bang command redirects (fallback if client logic missed it)
            if (data.redirect) {
                console.log("[Frontend] Redirecting to:", data.redirect);
                if ($bangsOpenNewTab) {
                    window.open(data.redirect, "_blank");
                } else {
                    window.location.href = data.redirect;
                }
                return;
            }

            if (data && data.ok === false) {
                throw new Error(data.error || `API isteği başarısız`);
            }

            const incoming = data.searchResults || [];
            if (incoming.length < count) {
                hasMoreResults.set(false);
            } else {
                hasMoreResults.set(true);
            }

            // For pagination, we always REPLACE results, never append
            searchResults.set(incoming);
            infoBoxResult.set(data.infoBoxResult || null);
            queryAiSummary.set(data.queryAiSummary || null); // Set the query AI summary store

            // Arama yapıldığında yazım hatası kontrolü yap (Bunu mu demek istediniz banner'ı için)
            if (query && type === "web") {
                fetchSuggestions(query);
            }
        } catch (err) {
            console.error("[Frontend] Error fetching search results:", err);
            error.set(err.message); // Set error store
            searchResults.set([]);
            infoBoxResult.set(null);
            queryAiSummary.set(null); // Reset query summary on error
        } finally {
            isLoading = false;

            // Dispatch event for plugins to react
            if (browser) {
                specialResults.set([]); // Clear previous
                window.dispatchEvent(
                    new CustomEvent("artado_search", {
                        detail: {
                            query: query,
                            type: type,
                            addSpecialResult: (res) => {
                                specialResults.update((prev) => {
                                    // Prevent duplicates by ID
                                    if (prev.some((p) => p.id === res.id))
                                        return prev;
                                    return [res, ...prev];
                                });
                            },
                        },
                    }),
                );
            }
        }
    }

    async function loadPlugins() {
        if (!browser) return;

        try {
            // Load active workshop plugins from localStorage
            const activeWorkshopPlugins = JSON.parse(
                localStorage.getItem("activeWorkshopPlugins") || "[]",
            );

            // Load each active workshop plugin
            activeWorkshopPlugins.forEach((plugin) => {
                const script = document.createElement("script");
                script.src = plugin.url;
                script.async = true;
                script.onerror = () =>
                    console.error(
                        `Failed to load workshop plugin: ${plugin.name}`,
                    );
                document.head.appendChild(script);
            });

            // Also load any available workshop plugins (for discovery)
            const res = await fetch("/api/workshop/plugins");
            if (res.ok) {
                const data = await res.json();
                const plugins = data.plugins || [];

                // Only load plugins that have workshop URLs and are not already loaded
                plugins.forEach((p) => {
                    // Skip if already loaded as active plugin
                    if (
                        activeWorkshopPlugins.find(
                            (active) => active.id === p.id,
                        )
                    )
                        return;

                    const script = document.createElement("script");

                    // If it's a workshop plugin with URL, use it directly
                    if (p.download_url && p.download_url.startsWith("http")) {
                        script.src = p.download_url;
                        script.async = true;
                        script.onerror = () =>
                            console.error(
                                `Failed to load workshop plugin: ${p.name}`,
                            );
                        document.head.appendChild(script);
                    }
                });
            }
        } catch (e) {
            console.error("Failed to load plugins:", e);
        }
    }

    onMount(() => {
        loadPlugins();

        if (browser) {
            window.addEventListener("click", clickOutsideSuggestions);
            return () => {
                window.removeEventListener("click", clickOutsideSuggestions);
            };
        }
    });

    // Pagination State
    let hasMoreResults = writable(true); // Track if we can go further

    async function goToPage(pageNum) {
        if (isLoading || pageNum < 1) return;

        // Calculate new offset
        if (pageNum > 12) return; // Limit to 12 pages

        // Calculate new offset
        const newOffset = (pageNum - 1) * count;
        if (newOffset === offset) return; // Same page

        offset = newOffset;

        // Persist page in URL
        const current = get(page);
        const url = new URL(current.url);
        url.searchParams.set("p", String(pageNum));
        url.searchParams.delete("offset"); // Cleanup
        goto(url.pathname + "?" + url.searchParams.toString(), {
            replaceState: false,
            keepFocus: true,
            noScroll: true,
        });

        // Scroll to top
        if (browser) window.scrollTo({ top: 0, behavior: "smooth" });

        await fetchSearchResults(searchQuery, activeSearchType);
    }

    let currentPage = $derived(Math.floor(offset / count) + 1);

    // Generate page numbers window (e.g. [1, 2, 3, 4, 5])
    let paginationPages = $derived(
        (() => {
            let pages = [];
            // Show 5 pages window centered on current if possible
            let start = Math.max(1, currentPage - 2);
            let end = Math.min(12, start + 4);

            // Adjust start if end is 12
            if (end === 12) {
                start = Math.max(1, 12 - 4);
            }

            // If we are at page 1, show 1,2,3,4,5
            if (currentPage <= 3) {
                start = 1;
                end = Math.min(12, 5);
            }

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }
            return pages;
        })(),
    );

    // Reactive statement to fetch results when the URL query parameter changes
    $effect(() => {
        const queryParam = $page.url.searchParams.get("i");
        const typeParam = $page.url.searchParams.get("t") || "web";
        const pParam = $page.url.searchParams.get("p");
        const offsetParamRaw = $page.url.searchParams.get("offset") || "0";

        let offsetParam;
        if (pParam) {
            const p = parseInt(pParam, 10) || 1;
            offsetParam = Math.max(0, p - 1);
        } else {
            offsetParam = parseInt(offsetParamRaw, 10) || 0;
        }

        if (queryParam !== searchQuery || typeParam !== activeSearchType) {
            searchQuery = queryParam || "";
            activeSearchType = typeParam;
            inputQuery = searchQuery;
            offset = offsetParam * count; // init from URL
            fetchSearchResults(searchQuery, activeSearchType);
        } else {
            const newOffset = offsetParam * count;
            if (newOffset !== offset) {
                offset = newOffset;
                fetchSearchResults(searchQuery, activeSearchType);
            }
        }
    });

    function handleSearchSubmit(type = activeSearchType) {
        if (!inputQuery.trim()) return;
        goto(
            `/search?i=${encodeURIComponent(inputQuery.trim())}&t=${type}&p=1`,
        );
    }

    function handleKeyPress(event) {
        if (event.key === "Enter") {
            clearTimeout(suggestTimeout);
            showSuggestions = false;
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
    let openMenuUrl = $state(null); // Track via URL instead of index for stability

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
    let filteredResults = $derived(
        $searchResults.filter((result) => {
            if (activeSearchType !== "web") return true; // Only block web results for now
            const domain = getDomain(result.url);
            return !$blockedSites.includes(domain);
        }),
    );

    // --- Autosuggest Logic ---
    let suggestions = $state([]);
    let spellCorrection = $state(null);
    let showSuggestions = $state(false);
    let suggestTimeout;
    let focusedSuggestionIndex = $state(-1);

    async function fetchSuggestions(q) {
        if (!$enableSuggestions || !q || q.length < 2) {
            suggestions = [];
            spellCorrection = null;
            return;
        }
        try {
            const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
            if (res.ok) {
                const data = await res.json();
                // Yeni format: { suggestions: [...], spellCorrection: {...} | null }
                if (Array.isArray(data)) {
                    suggestions = data;
                    spellCorrection = null;
                } else {
                    suggestions = data.suggestions || [];
                    spellCorrection = data.spellCorrection || null;
                }
            } else {
                suggestions = [];
                spellCorrection = null;
            }
        } catch (e) {
            console.error("[SEARCH] Suggestion fetch error", e);
            suggestions = [];
            spellCorrection = null;
        }
    }

    function handleInput(event) {
        const val = event.target.value;
        console.log("⌨️ [SEARCH] handleInput:", val);
        inputQuery = val;
        focusedSuggestionIndex = -1; // Reset focus on input
        clearTimeout(suggestTimeout);

        const isBang = val.trim().startsWith("!");
        if (isBang) {
            // Instant client-side bang suggestions
            const qLower = val.trim().toLowerCase();
            suggestions = Object.keys(BANG_COMMANDS)
                .filter((bang) => bang.startsWith(qLower))
                .map((bang) => ({
                    text: bang,
                    description: BANG_COMMANDS[bang].name,
                    isBang: true,
                }));
            showSuggestions = suggestions.length > 0;
            return;
        }

        if (val.trim().length >= 2) {
            console.log("⏰ [SEARCH] Setting timeout for suggestions...");
            suggestTimeout = setTimeout(() => {
                fetchSuggestions(val);
                showSuggestions = true;
                console.log("👁️ [SEARCH] showSuggestions set to true");
            }, 300);
        } else {
            showSuggestions = false;
            console.log("👁️ [SEARCH] showSuggestions set to false (too short)");
        }
    }

    function handleKeyDown(event) {
        if (event.key === "Enter") {
            clearTimeout(suggestTimeout);
            if (showSuggestions && focusedSuggestionIndex > -1) {
                event.preventDefault();
                selectSuggestion(suggestions[focusedSuggestionIndex]);
            } else {
                showSuggestions = false;
                handleSearchSubmit();
            }
            return;
        }

        if (!showSuggestions || suggestions.length === 0) return;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            focusedSuggestionIndex =
                (focusedSuggestionIndex + 1) % suggestions.length;
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            focusedSuggestionIndex =
                (focusedSuggestionIndex - 1 + suggestions.length) %
                suggestions.length;
        } else if (event.key === "Escape") {
            showSuggestions = false;
        }
    }

    function handleBlur() {
        // Small timeout to allow click to fire
        setTimeout(() => {
            showSuggestions = false;
        }, 200);
    }

    function selectSuggestion(s) {
        inputQuery = s.text;
        showSuggestions = false;
        handleSearchSubmit();
    }

    function clickOutsideSuggestions() {
        showSuggestions = false;
    }
</script>

<svelte:window onclick={clickOutsideSuggestions} />

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
            <img
                src={$customLogo}
                alt="Artado Logo"
                class="header-logo"
                onerror={(e) => (e.target.style.display = "none")}
            />
        </a>
        <div class="search-bar-container" onclick={(e) => e.stopPropagation()}>
            <div
                class="input-wrapper"
                style="flex:1; position: relative; display: flex;"
            >
                <input
                    type="text"
                    value={inputQuery}
                    oninput={handleInput}
                    onkeydown={handleKeyDown}
                    onfocus={() => {
                        if (inputQuery.length > 1 && suggestions.length > 0)
                            showSuggestions = true;
                    }}
                    placeholder="Artado'da ara..."
                    aria-label="Arama"
                    class="search-input"
                    autocomplete="off"
                />
                {#if showSuggestions && (suggestions.length > 0 || spellCorrection)}
                    <div
                        class="suggestions-dropdown"
                        transition:fly={{ y: 20, duration: 400, delay: 0 }}
                    >
                        {#if spellCorrection}
                            <button
                                class="did-you-mean-row"
                                onclick={() =>
                                    selectSuggestion(spellCorrection.corrected)}
                            >
                                <i class="fas fa-spell-check"></i>
                                <span
                                    >Bunu mu demek istediniz: <strong
                                        >{spellCorrection.corrected}</strong
                                    >?</span
                                >
                            </button>
                        {/if}
                        {#if suggestions.length > 0}
                            <div class="suggestions-header">
                                <i class="fas fa-magic"></i> Öneriler
                            </div>
                            {#each suggestions.slice(0, 7) as s, i}
                                <button
                                    class="suggestion-item"
                                    class:focused={i === focusedSuggestionIndex}
                                    onclick={() => selectSuggestion(s)}
                                >
                                    <div class="suggestion-icon-wrapper">
                                        {#if s.isBang}
                                            <i
                                                class="fas fa-bolt"
                                                style="color: var(--primary-color);"
                                            ></i>
                                        {:else}
                                            <i class="fas fa-search"></i>
                                        {/if}
                                    </div>
                                    <div
                                        class="suggestion-text-content"
                                        style="display: flex; flex-direction: column;"
                                    >
                                        <span
                                            >{#each highlightParts(s.text, inputQuery) as part}{#if part.bold}<b
                                                        >{part.text}</b
                                                    >{:else}{part.text}{/if}{/each}</span
                                        >
                                        {#if s.description}
                                            <span
                                                style="font-size: 0.75rem; opacity: 0.6;"
                                                >{s.description}</span
                                            >
                                        {/if}
                                    </div>
                                    <i class="fas fa-arrow-up suggestion-arrow"
                                    ></i>
                                </button>
                            {/each}
                        {/if}
                    </div>
                {/if}
            </div>
            {#if inputQuery}
                <button
                    class="clear-button-header"
                    onclick={() => {
                        inputQuery = "";
                        suggestions = [];
                        showSuggestions = false;
                        document.querySelector(".search-input-header")?.focus();
                    }}
                    aria-label="Aramayı temizle"
                >
                    <i class="fas fa-times"></i>
                </button>
            {/if}
            <button
                class="search-button-header"
                onclick={() => handleSearchSubmit()}
                aria-label="Ara"
            >
                <i class="fas fa-search"></i>
            </button>
        </div>
        <div class="header-actions">
            <button
                class="icon-button settings-button-header"
                aria-label={$t("settings")}
                onclick={toggleSidebar}
            >
                <i class="fas fa-sliders-h"></i>
            </button>
        </div>
    </header>

    <!-- Search Type Tabs -->
    <nav class="search-type-nav">
        <div class="search-type-nav-inner">
            <button
                class:active={activeSearchType === "web"}
                onclick={() => changeSearchType("web")}
            >
                <i class="fas fa-search"></i> Tümü
            </button>
            <button
                class:active={activeSearchType === "images"}
                onclick={() => changeSearchType("images")}
            >
                <i class="fas fa-image"></i> Görseller
            </button>
            <button
                class:active={activeSearchType === "videos"}
                onclick={() => changeSearchType("videos")}
            >
                <i class="fas fa-video"></i> Videolar
            </button>
            <button
                class:active={activeSearchType === "news"}
                onclick={() => changeSearchType("news")}
            >
                <i class="fas fa-newspaper"></i> Haberler
            </button>
        </div>
    </nav>

    {#if activeSearchType === "images"}
        <!-- Filters removed as per user request -->
    {:else if activeSearchType === "news"}
        <!-- Filters removed as per user request -->
    {/if}

    <!-- 
    PREVIOUS FILTERS COMMENTED OUT / REMOVED 
    (Kept structure if we want to re-enable or conditionally show for 'web' only if relevant)
    -->

    <div class="search-main-content">
        <main class="results-container" aria-live="polite">
            {#if isLoading}
                <div class="loading-container" in:fade={{ duration: 200 }}>
                    <div class="loading-spinner"></div>
                    <p>{$t("loading") || "Sonuçlar yükleniyor..."}</p>
                </div>
            {:else if $error}
                <div class="error-container" in:fade={{ duration: 200 }}>
                    <p class="error-text">
                        Sonuçlar yüklenirken hata oluştu: {$error}
                    </p>
                    <button
                        class="refresh-btn"
                        onclick={() =>
                            fetchSearchResults(searchQuery, activeSearchType)}
                        disabled={isLoading}
                    >
                        <i class="fas fa-sync-alt"></i> Tekrar Dene
                    </button>
                </div>
            {:else}
                <div class="search-results-list">
                    <!-- Global Special Results (Plugins) -->
                    {#if $specialResults && $specialResults.length > 0}
                        <div
                            class="special-results-container"
                            style="margin-bottom: 20px;"
                        >
                            {#each $specialResults as res (res.id)}
                                <div
                                    class="special-result-item"
                                    style={res.style}
                                >
                                    <div
                                        class="special-badge"
                                        style="display: inline-flex; align-items: center; gap: 5px; background: var(--hover-background); padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; margin-bottom: 5px; border: 1px solid var(--border-color);"
                                    >
                                        <i class={res.icon || "fas fa-magic"}
                                        ></i>
                                        <span>{res.plugin}</span>
                                    </div>
                                    <h4
                                        style="margin: 0 0 5px 0; font-size: 1.1rem;"
                                    >
                                        {res.title}
                                    </h4>
                                    <div
                                        class="special-content"
                                        style="font-size: 0.9rem; line-height: 1.5; color: var(--text-color);"
                                    >
                                        {@html res.content}
                                    </div>
                                    {#if res.type === "links" && res.links}
                                        <div
                                            class="special-links"
                                            style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;"
                                        >
                                            {#each res.links as link}
                                                <a
                                                    href={link.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style="padding: 5px 12px; background: var(--primary-color); color: white; border-radius: 20px; text-decoration: none; font-size: 0.8rem; font-weight: 500; transition: opacity 0.2s;"
                                                >
                                                    {link.name}
                                                </a>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/if}

                    <!-- === WEB & SCHOLAR RESULTS === -->
                    {#if activeSearchType === "web"}
                        {#if filteredResults.length > 0}
                            <div class="results-list web-results">
                                <!-- Spell Correction Banner -->
                                {#if spellCorrection}
                                    <div
                                        class="did-you-mean-banner"
                                        in:slide={{ duration: 300 }}
                                    >
                                        <i class="fas fa-spell-check"></i>
                                        <span
                                            >Bunu mu demek istediniz:
                                            <button
                                                class="did-you-mean-link"
                                                onclick={() => {
                                                    const corrected =
                                                        spellCorrection.corrected;
                                                    searchQuery = corrected;
                                                    inputQuery = corrected;
                                                    performSearch(corrected);
                                                    spellCorrection = null;
                                                }}
                                                aria-label="Düzeltilmiş sorgu ile ara: {spellCorrection.corrected}"
                                                ><strong
                                                    >{spellCorrection.corrected}</strong
                                                ></button
                                            >?
                                            <button
                                                class="original-search-link"
                                                onclick={() => {
                                                    const original =
                                                        spellCorrection.original;
                                                    searchQuery = original;
                                                    inputQuery = original;
                                                    performSearch(
                                                        original,
                                                        true,
                                                    );
                                                    spellCorrection = null;
                                                }}
                                                aria-label="Orijinal sorgu ile ara: {spellCorrection.original}"
                                            >
                                                (Yine de bunu ara: {spellCorrection.original})</button
                                            >
                                        </span>
                                    </div>
                                {/if}

                                <!-- Results Loop -->
                                {#each filteredResults as result (result.url)}
                                    <div class="result-item-card">
                                        <div class="result-header">
                                            <img
                                                src={result.icon ||
                                                    "/favicon.ico"}
                                                alt=""
                                                class="favicon"
                                                loading="lazy"
                                                onerror={(e) => {
                                                    e.target.style.display =
                                                        "none";
                                                }}
                                            />
                                            <span class="result-domain"
                                                >{getDomain(result.url)}</span
                                            >
                                            {#if Array.isArray(result.sources) && result.sources.length > 1}
                                                <span class="result-age">
                                                    - {result.sources
                                                        .map(
                                                            (s) =>
                                                                String(s)
                                                                    .charAt(0)
                                                                    .toUpperCase() +
                                                                String(s).slice(
                                                                    1,
                                                                ),
                                                        )
                                                        .join(" + ")}
                                                </span>
                                            {/if}
                                            {#if result.age}
                                                <span class="result-age">
                                                    - {formatAge(
                                                        result.age,
                                                    )}</span
                                                >
                                            {/if}

                                            <div class="result-menu-container">
                                                <button
                                                    class="more-options"
                                                    aria-label="Daha fazla seçenek"
                                                    onclick={(e) =>
                                                        toggleMenu(
                                                            result.url,
                                                            e,
                                                        )}
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
                                                            onclick={() =>
                                                                blockSite(
                                                                    result.url,
                                                                )}
                                                        >
                                                            <i
                                                                class="fas fa-ban"
                                                            ></i> Bu siteyi engelle
                                                        </button>
                                                        <button
                                                            onclick={() => {
                                                                navigator.clipboard.writeText(
                                                                    result.url,
                                                                );
                                                                closeMenu();
                                                            }}
                                                        >
                                                            <i
                                                                class="fas fa-copy"
                                                            ></i> Bağlantıyı kopyala
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
                                            {result.description ||
                                                "Açıklama yok."}
                                        </p>
                                    </div>
                                {/each}
                            </div>
                        {:else if searchQuery}
                            <div class="no-results">
                                <p>
                                    "<strong>{searchQuery}</strong>" için sonuç
                                    bulunamadı.
                                </p>
                            </div>
                        {/if}

                        <!-- === IMAGE RESULTS === -->
                    {:else if activeSearchType === "images"}
                        {#if $searchResults.length > 0}
                            <div class="results-grid image-results">
                                {#each $searchResults as result, i (result.thumbnail + i)}
                                    <div class="image-result-item">
                                        <div class="image-wrapper">
                                            <img
                                                src={result.thumbnail}
                                                alt={result.title || "Görsel"}
                                                loading="lazy"
                                                onerror={(e) => {
                                                    e.target.style.display =
                                                        "none";
                                                    e.target.parentElement.classList.add(
                                                        "no-image",
                                                    );
                                                }}
                                            />
                                            <div class="image-overlay">
                                                <a
                                                    href={result.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="overlay-btn"
                                                    title="Siteye Git"
                                                    aria-label="Siteye Git"
                                                >
                                                    <i
                                                        class="fas fa-external-link-alt"
                                                        aria-hidden="true"
                                                    ></i>
                                                </a>
                                                <a
                                                    href={result.thumbnail}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="overlay-btn"
                                                    title="Tam Boyut"
                                                    aria-label="Tam Boyut"
                                                >
                                                    <i
                                                        class="fas fa-expand"
                                                        aria-hidden="true"
                                                    ></i>
                                                </a>
                                            </div>
                                        </div>
                                        <a
                                            href={result.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="image-info"
                                        >
                                            <span class="image-title"
                                                >{result.title}</span
                                            >
                                            <span class="image-source">
                                                {#if result.sourceIcon}<img
                                                        src={result.sourceIcon}
                                                        alt=""
                                                        class="source-icon"
                                                    />{/if}
                                                {getDomain(result.source)}
                                            </span>
                                        </a>
                                    </div>
                                {/each}
                            </div>
                        {:else if searchQuery}
                            <div class="no-results">
                                <p>
                                    '{searchQuery}' için görsel sonucu
                                    bulunamadı.
                                </p>
                            </div>
                        {/if}

                        <!-- === VIDEO RESULTS === -->
                    {:else if activeSearchType === "videos"}
                        {#if $searchResults.length > 0}
                            <div class="results-grid video-results-grid">
                                {#each $searchResults as result (result.url)}
                                    <div
                                        class="result-item-card video-card-modern"
                                    >
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
                                                    onerror={(e) => {
                                                        e.target.style.visibility =
                                                            "hidden";
                                                    }}
                                                />
                                                <div class="play-overlay">
                                                    <i class="fas fa-play"></i>
                                                </div>
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
                                            <h3
                                                class="result-title video-title"
                                            >
                                                <a
                                                    href={result.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    >{result.title}</a
                                                >
                                            </h3>
                                            <div class="video-meta-row">
                                                <span class="video-publisher"
                                                    >{result.publisher ||
                                                        getDomain(
                                                            result.url,
                                                        )}</span
                                                >
                                                {#if result.age}<span
                                                        class="separator"
                                                        >•</span
                                                    >
                                                    <span class="video-age"
                                                        >{formatAge(
                                                            result.age,
                                                        )}</span
                                                    >{/if}
                                            </div>
                                            <p
                                                class="result-description video-description"
                                            >
                                                {result.description || ""}
                                            </p>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {:else if searchQuery}
                            <div class="no-results">
                                <p>
                                    '{searchQuery}' için video sonucu
                                    bulunamadı.
                                </p>
                            </div>
                        {/if}

                        <!-- === NEWS RESULTS === -->
                    {:else if activeSearchType === "news"}
                        {#if $searchResults.length > 0}
                            <div class="results-list news-results">
                                {#each $searchResults as result (result.url)}
                                    <div
                                        class="result-item-card news-item-modern"
                                    >
                                        <div class="news-content">
                                            <div class="news-header-meta">
                                                {#if result.icon}<img
                                                        src={result.icon}
                                                        alt=""
                                                        class="news-source-icon"
                                                    />{/if}
                                                <span class="news-source"
                                                    >{result.source ||
                                                        getDomain(
                                                            result.url,
                                                        )}</span
                                                >
                                                {#if result.age}<span
                                                        class="separator"
                                                        >•</span
                                                    >
                                                    <span class="news-age"
                                                        >{result.age}</span
                                                    >{/if}
                                            </div>
                                            <h3 class="result-title news-title">
                                                <a
                                                    href={result.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    >{result.title}</a
                                                >
                                            </h3>
                                            {#if result.description}
                                                <p
                                                    class="result-description news-desc"
                                                >
                                                    {result.description}
                                                </p>
                                            {/if}
                                        </div>
                                        {#if result.thumbnail}
                                            <div class="news-thumbnail-wrapper">
                                                <img
                                                    src={result.thumbnail}
                                                    alt=""
                                                    class="news-thumbnail"
                                                    loading="lazy"
                                                    onerror={(e) => {
                                                        e.target.style.display =
                                                            "none";
                                                    }}
                                                />
                                            </div>
                                        {/if}
                                    </div>
                                {/each}
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
                            <button
                                class="refresh-btn"
                                onclick={() =>
                                    fetchSearchResults(
                                        searchQuery,
                                        activeSearchType,
                                    )}
                                disabled={isLoading}
                            >
                                <i class="fas fa-sync-alt" aria-hidden="true"
                                ></i>
                                Yenile
                            </button>
                        </div>
                    {/if}
                </div>

                <!-- Pagination Controls -->
                {#if $searchResults.length > 0 && !isLoading}
                    <div class="pagination-container">
                        <!-- Prev Button -->
                        <button
                            class="pagination-btn nav-btn"
                            disabled={currentPage <= 1 || isLoading}
                            onclick={() => goToPage(currentPage - 1)}
                            aria-label="Önceki sayfa"
                        >
                            <i
                                class="fas fa-chevron-left"
                                style="margin-right: 5px;"
                            ></i> Önceki
                        </button>

                        <!-- Page Numbers -->
                        {#each paginationPages.slice(0, 12) as page}
                            <button
                                class="pagination-btn"
                                class:active={page === currentPage}
                                onclick={() => goToPage(page)}
                                disabled={isLoading}
                            >
                                {page}
                            </button>
                        {/each}

                        <!-- Next Button -->
                        <button
                            class="pagination-btn nav-btn"
                            disabled={!$hasMoreResults ||
                                isLoading ||
                                currentPage >= 12}
                            onclick={() => goToPage(currentPage + 1)}
                            aria-label="Sonraki sayfa"
                        >
                            Sonraki <i
                                class="fas fa-chevron-right"
                                style="margin-left: 5px;"
                            ></i>
                        </button>
                    </div>
                {/if}
            {/if}
        </main>

        <!-- === Infobox Area === -->
        {#if activeSearchType === "web" && $infoBoxResult && !isLoading && !$error}
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
                                onerror={(e) => {
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
                                    onerror={(e) => {
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
                                    onerror={(e) => {
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
                                    onerror={(e) =>
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
        width: 100%;
        box-sizing: border-box;
        background-color: var(--background-color);
    }

    /* Header styles */
    .search-header {
        display: flex;
        align-items: center;
        justify-content: flex-start;
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
        flex: 1;
        display: flex;
        align-items: center;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 0 0.8rem;
        max-width: 650px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        transition: all 0.2s ease;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
    }
    .search-bar-container:focus-within {
        border-color: rgba(255, 255, 255, 0.15);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        background: rgba(255, 255, 255, 0.08);
    }

    /* Autosuggest Styles (Premium) */
    .suggestions-dropdown {
        position: absolute;
        top: calc(100% + 15px);
        left: 0;
        right: 0;
        background: var(--card-background);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        backdrop-filter: blur(20px) saturate(180%);
        border: 1px solid var(--border-color);
        box-shadow:
            0 20px 40px rgba(0, 0, 0, 0.4),
            0 0 0 1px rgba(var(--primary-color-rgb), 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        z-index: 2000;
        overflow: hidden;
        padding: 8px;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        transform-origin: top center;
        max-height: 400px;
        min-height: auto;
    }

    .suggestions-header {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--text-color-secondary);
        padding: 6px 12px;
        text-transform: uppercase;
        letter-spacing: 1.2px;
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
    }

    .suggestion-item {
        display: flex;
        align-items: center;
        width: 100%;
        padding: 10px 14px;
        background: transparent;
        border: none;
        text-align: left;
        color: var(--text-color);
        cursor: pointer;
        font-size: 0.9rem;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 10px;
        gap: 12px;
        position: relative;
        margin-bottom: 2px;
        font-weight: 400;
    }

    .suggestion-item:last-child {
        margin-bottom: 0;
    }

    .suggestion-item::before {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.1),
            rgba(255, 255, 255, 0.05)
        );
        border-radius: 10px;
        opacity: 0;
        transition: opacity 0.2s ease;
        z-index: -1;
    }

    .suggestion-item:hover {
        background: var(--hover-background);
        color: var(--text-color);
        transform: translateX(0px);
    }

    .suggestion-item.focused {
        background: var(--hover-background);
        color: var(--text-color);
        transform: translateX(0px);
    }

    .suggestion-item:hover::before {
        opacity: 1;
        border-radius: 10px;
    }

    .suggestion-item.focused::before {
        opacity: 1;
        background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.15),
            rgba(255, 255, 255, 0.08)
        );
        border-radius: 10px;
    }

    .suggestion-icon-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: var(--hover-background);
        border-radius: 8px;
        color: var(--text-color-secondary);
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        flex-shrink: 0;
        font-size: 0.9rem;
    }

    .suggestion-item:hover .suggestion-icon-wrapper {
        background: var(--hover-background);
        color: var(--text-color);
        transform: scale(1.1);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .suggestion-item.focused .suggestion-icon-wrapper {
        background: var(--hover-background);
        color: var(--text-color);
        transform: scale(1.15);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
    }

    .suggestion-arrow {
        margin-left: auto;
        opacity: 0;
        transform: translateX(-5px) rotate(-45deg);
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        font-size: 0.75rem;
        color: var(--text-color-secondary);
    }

    .suggestion-item:hover .suggestion-arrow {
        opacity: 0.8;
        transform: translateX(0) rotate(-45deg);
        color: var(--text-color);
    }

    .suggestion-item.focused .suggestion-arrow {
        opacity: 1;
        transform: translateX(0) rotate(-45deg);
        color: var(--primary-color);
    }

    .search-input {
        flex-grow: 1;
        border: none;
        outline: none;
        padding: 0.6rem 0.5rem;
        font-size: 1rem;
        background: transparent;
        color: var(--text-color);
    }

    .search-input:focus-visible {
        outline: none;
        box-shadow: none;
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

    /* Search Type Navigation */
    .search-type-nav {
        display: flex;
        border-bottom: 1px solid var(--border-color);
        background-color: var(--background-color);
        position: sticky;
        top: 61px;
        z-index: 999;
        padding: 0;
        max-width: none;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
    }

    .search-type-nav-inner {
        display: flex;
        justify-content: flex-start;
        gap: 0.5rem;
        max-width: 1100px;
        width: 100%;
        padding: 0 1.5rem;
        overflow-x: auto;
        white-space: nowrap;
        scrollbar-width: none;
        -ms-overflow-style: none;
    }

    .search-type-nav-inner::-webkit-scrollbar {
        display: none;
    }

    .search-type-nav button {
        background: transparent;
        border: none;
        color: var(--text-color-secondary);
        cursor: pointer;
        padding: 0.9rem 1.2rem;
        font-size: 0.9rem;
        font-weight: 500;
        border-bottom: 3px solid transparent;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        display: inline-flex;
        align-items: center;
        gap: 0.6rem;
        flex-shrink: 0;
        margin-bottom: -1px;
        opacity: 0.8;
    }

    .search-type-nav button i {
        font-size: 0.85rem;
    }

    .search-type-nav button:hover {
        color: var(--text-color);
        opacity: 1;
        background-color: var(--hover-background);
    }

    .search-type-nav button.active {
        color: var(--primary-color);
        border-bottom-color: var(--primary-color);
        font-weight: 600;
        opacity: 1;
    }

    /* Main Content Area Layout */
    .search-main-content {
        display: flex;
        flex-wrap: wrap;
        width: 100%;
        box-sizing: border-box;
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

    /* Load More Styles */
    .load-more-container {
        display: flex;
        justify-content: center;
        margin: 2rem 0 4rem;
        width: 100%;
    }

    .load-more-btn {
        background: var(--card-background);
        border: 1px solid var(--border-color);
        color: var(--text-color);
        padding: 0.8rem 2rem;
        border-radius: 50px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        gap: 0.8rem;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    }

    .load-more-btn:hover {
        background: var(--primary-color);
        color: white;
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(var(--primary-color-rgb), 0.3);
        border-color: var(--primary-color);
    }

    .load-more-btn:active {
        transform: scale(0.98);
    }

    .load-more-spinner {
        color: var(--text-color-secondary);
        display: flex;
        align-items: center;
        gap: 0.8rem;
        font-weight: 500;
    }
    /* Menu Container */
    /* Special Plugin Result Styling */
    .special-plugin-card {
        border: 2px solid rgba(var(--primary-color-rgb), 0.3) !important;
        background: linear-gradient(
            135deg,
            var(--card-background),
            rgba(var(--primary-color-rgb), 0.05)
        ) !important;
        position: relative;
        overflow: hidden;
    }
    .special-badge {
        position: absolute;
        top: 0.8rem;
        right: 0.8rem;
        background: var(--primary-color);
        color: white;
        padding: 0.25rem 0.6rem;
        border-radius: 50px;
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        box-shadow: 0 4px 10px rgba(var(--primary-color-rgb), 0.3);
    }
    .plugin-content {
        margin-top: 1rem;
        padding: 0.5rem 0;
    }

    .result-menu-container {
        position: relative;
        margin-left: auto;
        display: flex;
        align-items: center;
    }

    .menu-dot-btn {
        background: none;
        border: none;
        color: var(--text-color-secondary);
        cursor: pointer;
        padding: 8px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s;
    }

    .menu-dot-btn:hover {
        background-color: var(--hover-background);
        color: var(--primary-color);
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

    /* --- Enhanced Image Results --- */
    .image-results {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1rem;
    }

    .image-result-item {
        background: var(--card-background);
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid var(--border-color);
        transition:
            transform 0.2s,
            box-shadow 0.2s;
        display: flex;
        flex-direction: column;
    }

    .image-result-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    }

    .image-wrapper {
        position: relative;
        padding-top: 75%; /* 4:3 Aspect Ratio Container */
        background: #f0f0f0;
        overflow: hidden;
    }

    .image-wrapper img {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s;
    }

    .image-result-item:hover .image-wrapper img {
        transform: scale(1.05);
    }

    .image-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
        padding: 1rem 0.5rem 0.5rem;
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .image-result-item:hover .image-overlay {
        opacity: 1;
    }

    .overlay-btn {
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(4px);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
    }
    .overlay-btn:hover {
        background: rgba(255, 255, 255, 0.4);
    }

    .image-info {
        padding: 0.8rem;
        text-decoration: none;
        display: flex;
        flex-direction: column;
        background: var(--card-background);
        z-index: 1;
    }

    .image-title {
        font-size: 0.9rem;
        color: var(--text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-weight: 500;
        margin-bottom: 0.3rem;
    }

    .image-source {
        font-size: 0.8rem;
        color: var(--text-color-secondary);
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }

    .source-icon {
        width: 14px;
        height: 14px;
        border-radius: 2px;
    }

    /* --- Video Results List Layout (YouTube-style) --- */
    .video-results-grid {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .video-card-modern {
        display: flex;
        flex-direction: row;
        padding: 0;
        gap: 1rem;
        background: var(--card-background);
        border: 1px solid transparent;
        border-radius: 12px;
        overflow: hidden;
        transition: background-color 0.2s;
    }

    .video-card-modern:hover {
        background-color: var(--hover-background);
    }

    .video-thumbnail-container {
        position: relative;
        width: 260px; /* Fixed width for desktop list view */
        height: 146px; /* 16:9 aspect ratio approx */
        flex-shrink: 0;
        background: #000;
        overflow: hidden;
        border-radius: 8px;
    }

    .video-thumbnail {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0.95;
        transition: opacity 0.2s;
    }

    .video-card-modern:hover .video-thumbnail {
        opacity: 1;
    }

    .play-overlay {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 40px;
        height: 40px;
        background: rgba(0, 0, 0, 0.6);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 1.1rem;
        opacity: 0.8;
        transition: all 0.2s;
    }

    .video-card-modern:hover .play-overlay {
        background: var(--primary-color);
        opacity: 1;
        transform: translate(-50%, -50%) scale(1.1);
    }

    .video-duration {
        position: absolute;
        bottom: 8px;
        right: 8px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 500;
    }

    .video-details {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .video-title a {
        font-size: 1rem;
        font-weight: 600;
        color: var(--text-color);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-decoration: none;
        line-height: 1.3;
    }

    .video-card-modern:hover .video-title a {
        color: var(--primary-color);
        text-decoration: underline;
    }

    .video-meta-row {
        font-size: 0.8rem;
        color: var(--text-color-secondary);
        display: flex;
        align-items: center;
        flex-wrap: wrap;
    }

    .separator {
        margin: 0 0.4rem;
    }

    .video-description {
        font-size: 0.85rem;
        color: var(--text-color-secondary);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        margin-top: 0.4rem;
        line-height: 1.4;
    }

    /* --- News Results Modern --- */
    .news-item-modern {
        display: flex;
        flex-direction: row;
        gap: 1.5rem;
        padding: 1.2rem;
        align-items: flex-start;
    }

    .news-content {
        flex: 1;
        min-width: 0;
    }

    .news-header-meta {
        display: flex;
        align-items: center;
        font-size: 0.8rem;
        color: var(--text-color-secondary);
        margin-bottom: 0.5rem;
    }

    .news-source-icon {
        width: 16px;
        height: 16px;
        margin-right: 0.5rem;
        border-radius: 2px;
    }

    .news-source {
        font-weight: 500;
        color: var(--text-color);
    }

    .news-title a {
        font-size: 1.1rem;
        font-weight: 500;
        color: var(--primary-color);
        text-decoration: none;
        line-height: 1.3;
        display: block;
        margin-bottom: 0.5rem;
    }

    .news-title a:hover {
        text-decoration: underline;
    }

    .news-desc {
        font-size: 0.9rem;
        line-height: 1.5;
        color: var(--text-color-secondary);
    }

    .news-thumbnail-wrapper {
        flex-shrink: 0;
        width: 120px;
        height: 120px;
        border-radius: 8px;
        overflow: hidden;
        background: var(--background-color-secondary);
    }

    .news-thumbnail {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    @media (max-width: 600px) {
        .news-item-modern {
            flex-direction: column-reverse;
            gap: 1rem;
        }
        .news-thumbnail-wrapper {
            width: 100%;
            height: 180px;
            margin-bottom: 0.5rem;
        }
    }

    /* Pagination Styles */
    .pagination-container {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.5rem;
        margin: 2rem 0 4rem;
        flex-wrap: wrap;
    }

    .pagination-btn {
        background: var(--card-background);
        border: 1px solid var(--border-color);
        color: var(--text-color);
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s;
        text-decoration: none;
        user-select: none;
    }

    .pagination-btn:hover:not(:disabled) {
        background: var(--hover-background);
        color: var(--primary-color);
        border-color: var(--primary-color);
    }

    .pagination-btn.active {
        background: var(--primary-color);
        color: white;
        border-color: var(--primary-color);
        font-weight: 700;
        cursor: default;
    }

    .pagination-btn.nav-btn {
        width: auto;
        padding: 0 1rem;
        border-radius: 20px;
    }

    .pagination-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background: var(--disabled-background);
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
        .search-main-content {
            margin-left: 1rem;
            margin-right: 1rem;
        }
    }
    @media (max-width: 1024px) {
        .infobox-container {
            width: 250px;
            top: calc(61px + 48px + 1rem); /* Adjust top for smaller padding */
        }
        .search-main-content {
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
        .search-main-content {
            flex-direction: column;
            padding: 0;
            max-width: none;
            margin: 0;
            width: 100vw;
            overflow-x: hidden;
        }
        .results-container {
            max-width: 100%;
            order: 1;
            padding: 0 12px;
            width: 100%;
            box-sizing: border-box;
        }
        .infobox-container {
            display: none;
        }
        .search-header {
            position: sticky;
            top: 0;
            left: 0;
            width: 100%;
            padding: 0.8rem 12px;
            margin: 0;
            box-sizing: border-box;
            gap: 0.8rem;
            background: var(--background-color);
            border-bottom: 1px solid var(--border-color);
            border-radius: 0;
        }
        .search-input {
            font-size: 1rem;
        }
        .search-button-header,
        .clear-button-header {
            font-size: 1.1rem;
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
            padding: 0.8rem; /* Reduce padding significantly */
        }
        .result-title {
            font-size: 1rem; /* Reduce title size */
            line-height: 1.3;
        }
        .result-domain {
            font-size: 0.75rem;
        }
        .result-description {
            font-size: 0.85rem;
        }
        .news-thumbnail-wrapper {
            width: 80px;
            height: 80px;
        }
        .video-card-modern {
            flex-direction: column; /* Stack on mobile */
            gap: 0.5rem;
        }
        .video-thumbnail-container {
            width: 100%;
            height: auto;
            aspect-ratio: 16/9;
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
        background-color: var(--background-color-secondary);
        border: 1px solid var(--border-color);
        border-radius: 20px;
    }
    .image-filter-input,
    .news-filter-input {
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
    .loading-container {
        text-align: center;
        margin-top: 3rem;
        padding: 2rem;
        color: var(--text-color-secondary);
        border-radius: 12px;
        background-color: var(--card-background);
        border: 1px solid var(--border-color);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--border-color);
        border-top: 3px solid var(--primary-color);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 1rem auto;
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    .loading-container p {
        margin: 0;
        font-size: 1rem;
        font-weight: 500;
    }

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

    .refresh-btn {
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
        transition: all 0.2s ease;
    }

    .refresh-btn:hover:not(:disabled) {
        background-color: var(--primary-color-hover);
        transform: translateY(-1px);
    }

    .refresh-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
    }

    .refresh-btn i {
        font-size: 0.8rem;
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

    .ai-box-title {
        font-weight: 600;
        font-size: 0.9rem;
        color: var(--text-primary-color);
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
    .video-description {
        font-size: 0.85rem;
        /* Limit lines shown */
        display: -webkit-box;
        -webkit-line-clamp: 3;
        line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    /* === Infobox Styles === */
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

    /* --- Did You Mean Styles (Reverted to Blue Banner) --- */
    .did-you-mean-banner {
        background: rgba(26, 115, 232, 0.05);
        border: 1px solid rgba(26, 115, 232, 0.1);
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 1.5rem;
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 1.1rem;
        color: var(--text-color);
    }

    .did-you-mean-banner i {
        color: #1a73e8;
        font-size: 1.2rem;
    }

    .did-you-mean-link {
        background: none;
        border: none;
        padding: 0;
        margin: 0;
        color: #1a73e8;
        font-size: inherit;
        font-family: inherit;
        cursor: pointer;
        text-decoration: none;
    }

    .did-you-mean-link:hover {
        text-decoration: underline;
    }

    .did-you-mean-link strong {
        font-weight: 600;
        font-style: italic;
    }

    .original-search-link {
        background: none;
        border: none;
        padding: 0;
        margin-left: 8px;
        color: var(--text-color-secondary);
        font-size: 0.85rem;
        cursor: pointer;
        opacity: 0.8;
    }

    .original-search-link:hover {
        text-decoration: underline;
        opacity: 1;
    }

    .original-link {
        color: inherit;
        text-decoration: underline;
        opacity: 0.9;
    }

    .original-link:hover {
        opacity: 1;
    }

    /* Suggestion Dropdown did-you-mean row */
    .did-you-mean-row {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 10px 14px;
        background: rgba(26, 115, 232, 0.08);
        border: none;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        text-align: left;
        color: var(--text-color);
        cursor: pointer;
        font-size: 0.88rem;
        margin-bottom: 6px;
        transition: background 0.2s ease;
    }

    .did-you-mean-row:hover {
        background: rgba(26, 115, 232, 0.18);
    }

    .did-you-mean-row i {
        color: #1a73e8;
        font-size: 0.9rem;
    }

    .did-you-mean-row strong {
        color: #1a73e8;
    }
    /* --- Search Results Mobile Design --- */
    @media (max-width: 768px) {
        .search-results-page {
            width: 100%;
            min-height: 100vh;
            background-color: var(--background-color);
            padding: 0 12px;
            box-sizing: border-box;
        }

        .search-header {
            flex-direction: column;
            position: relative;
            left: -12px;
            width: calc(100% + 24px);
            padding: 1rem 12px;
            gap: 1rem;
            box-sizing: border-box;
            margin-top: 0;
            margin-bottom: 0;
        }

        .search-bar-container {
            max-width: 100%;
            width: 100%;
        }

        .header-actions {
            width: 100%;
            display: flex;
            justify-content: center;
        }

        .settings-button-header {
            padding: 0.8rem;
            font-size: 1.4rem;
            min-width: 44px;
            min-height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .search-type-nav {
            padding: 0 1rem;
            margin: 0;
        }

        .search-type-nav-inner {
            padding: 0 0.5rem;
        }

        .search-main-content {
            padding: 0;
            width: 100%;
            margin: 0;
        }

        .results-container {
            padding: 0;
            width: 100%;
            box-sizing: border-box;
            margin: 0;
        }
    }

    .logo-link {
        margin-bottom: 0.5rem;
    }

    .header-logo {
        height: 28px;
    }

    .search-bar-container {
        width: 100%;
    }

    @media (max-width: 768px) {
        .search-results-page {
            padding: 0 12px;
        }

        .results-container {
            padding: 10px 0;
        }
    }

    .result-item-card {
        padding: 1rem;
        margin-bottom: 1rem;
    }

    .result-title {
        font-size: 1.1rem;
    }

    .result-description {
        font-size: 0.9rem;
    }

    @media (max-width: 480px) {
        .search-header {
            padding: 0.5rem 12px;
        }

        .search-action-button {
            padding: 0 0.8rem;
        }
    }
</style>
