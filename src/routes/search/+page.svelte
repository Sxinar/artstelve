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
            params.set("region", $searchRegion || "TR");
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

<div class="flex flex-col min-h-screen w-full box-border bg-[var(--background-color)]">
    <header class="flex items-center justify-start px-3 py-3 sm:px-4 border-b border-[var(--border-color)] bg-[var(--card-background)] sticky top-0 z-[1000] gap-3 sm:gap-5">
        <a href="/" class="flex-shrink-0 flex items-center" aria-label="Ana Sayfa">
            <img
                src={$customLogo}
                alt="Artado Logo"
                class="h-7 w-auto sm:h-8"
                onerror={(e) => (e.target.style.display = "none")}
            />
        </a>
        <div class="flex-1 flex items-center bg-white/5 rounded-full border border-white/10 px-2 sm:px-3 max-w-[650px] shadow-sm transition-all duration-200 backdrop-blur-md" onclick={(e) => e.stopPropagation()}>
            <div
                class="flex-1 relative flex"
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
                    class="flex-grow border-none outline-none px-2 py-2 text-sm sm:text-base bg-transparent text-[var(--text-color)] focus-visible:outline-none focus-visible:shadow-none"
                    autocomplete="off"
                />
                {#if showSuggestions && (suggestions.length > 0 || spellCorrection)}
                    <div
                        class="absolute top-[calc(100%+15px)] left-0 right-0 bg-[var(--card-background)] backdrop-blur-lg saturate-[180%] border border-[var(--border-color)] shadow-[0_20px_40px_rgba(0,0,0,0.4),0_0_0_1px_rgba(var(--primary-color-rgb),0.1),inset_0_1px_0_rgba(255,255,255,0.1)] rounded-2xl z-[2000] overflow-hidden p-2 transition-all duration-250 ease-in-out origin-top max-h-[400px] min-h-auto"
                        transition:fly={{ y: 20, duration: 400, delay: 0 }}
                    >
                        {#if spellCorrection}
                            <button
                                class="flex items-center gap-3 px-4 py-3 bg-transparent border-none text-left text-[var(--text-color)] cursor-pointer text-base transition-all duration-200 rounded-xl"
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
                            <div class="text-xs font-bold text-[var(--text-color-secondary)] px-3 py-1.5 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                                <i class="fas fa-magic"></i> Öneriler
                            </div>
                            {#each suggestions.slice(0, 7) as s, i}
                                <button
                                    class="flex items-center w-full px-3.5 py-2.5 bg-transparent border-none text-left text-[var(--text-color)] cursor-pointer text-sm transition-all duration-200 rounded-xl gap-3 relative mb-0.5 font-normal hover:bg-[var(--hover-background)] hover:text-[var(--text-color)] hover:translate-x-0"
                                    class:focused={i === focusedSuggestionIndex}
                                    onclick={() => selectSuggestion(s)}
                                >
                                    <div class="flex items-center justify-center w-8 h-8 bg-[var(--hover-background)] rounded-lg text-[var(--text-color-secondary)] transition-all duration-250 ease-in-out flex-shrink-0 text-sm hover:bg-[var(--hover-background)] hover:text-[var(--text-color)] hover:scale-110 hover:shadow-lg">
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
                                        class="flex flex-col"
                                    >
                                        <span
                                            >{#each highlightParts(s.text, inputQuery) as part}{#if part.bold}<b
                                                        >{part.text}</b
                                                    >{:else}{part.text}{/if}{/each}</span
                                        >
                                        {#if s.description}
                                            <span
                                                class="text-sm text-[var(--text-color-secondary)] opacity-60"
                                                >{s.description}</span
                                            >
                                        {/if}
                                    </div>
                                    <i class="fas fa-arrow-up ml-auto opacity-0 -translate-x-1 -rotate-45 transition-all duration-250 ease-in-out text-xs text-[var(--text-color-secondary)] hover:opacity-80 hover:translate-x-0 hover:-rotate-45 hover:text-[var(--primary-color)]"
                                    ></i>
                                </button>
                            {/each}
                        {/if}
                    </div>
                {/if}
            </div>
            {#if inputQuery}
                <button
                    class="bg-none border-none text-[var(--text-color-secondary)] cursor-pointer text-lg px-2 leading-none hover:text-[var(--text-color)]"
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
                class="bg-none border-none text-[var(--primary-color)] cursor-pointer text-lg px-3 pl-1 ml-0.5 leading-none hover:opacity-80"
                onclick={() => handleSearchSubmit()}
                aria-label="Ara"
            >
                <i class="fas fa-search"></i>
            </button>
        </div>
        <div class="ml-auto flex-shrink-0">
            <button
                class="bg-none border-none text-[var(--text-color-secondary)] cursor-pointer text-xl px-1 rounded-full transition-colors duration-200 hover:text-[var(--text-color)] hover:bg-[var(--hover-background)] text-xl px-2.5"
                aria-label={$t("settings")}
                onclick={toggleSidebar}
            >
                <i class="fas fa-sliders-h"></i>
            </button>
        </div>
    </header>

    <!-- Search Type Tabs -->
    <nav class="flex border-b border-[var(--border-color)] bg-[var(--background-color)] sticky top-[61px] z-[999] px-0 max-w-none backdrop-blur-md">
        <div class="flex justify-start gap-2 max-w-[1100px] w-full px-6 overflow-x-auto whitespace-none scrollbar-none -ms-overflow-style-none">
            <button
                class="bg-transparent border-none text-[var(--text-color-secondary)] cursor-pointer px-3 sm:px-4 py-2.5 sm:py-3.5 text-xs sm:text-sm font-medium border-b-3 border-transparent transition-all duration-200 ease-in-out inline-flex items-center gap-2 flex-shrink-0 -mb-px opacity-80 hover:text-[var(--text-color)] hover:opacity-100 hover:bg-[var(--hover-background)]"
                class:active={activeSearchType === "web"}
                class:text-[var(--primary-color)]={activeSearchType === "web"}
                class:border-b-[var(--primary-color)]={activeSearchType === "web"}
                class:font-semibold={activeSearchType === "web"}
                class:opacity-100={activeSearchType === "web"}
                onclick={() => changeSearchType("web")}
            >
                <i class="fas fa-search"></i> Tümü
            </button>
            <button
                class="bg-transparent border-none text-[var(--text-color-secondary)] cursor-pointer px-3 sm:px-4 py-2.5 sm:py-3.5 text-xs sm:text-sm font-medium border-b-3 border-transparent transition-all duration-200 ease-in-out inline-flex items-center gap-2 flex-shrink-0 -mb-px opacity-80 hover:text-[var(--text-color)] hover:opacity-100 hover:bg-[var(--hover-background)]"
                class:active={activeSearchType === "images"}
                class:text-[var(--primary-color)]={activeSearchType === "images"}
                class:border-b-[var(--primary-color)]={activeSearchType === "images"}
                class:font-semibold={activeSearchType === "images"}
                class:opacity-100={activeSearchType === "images"}
                onclick={() => changeSearchType("images")}
            >
                <i class="fas fa-image"></i> Görseller
            </button>
            <button
                class="bg-transparent border-none text-[var(--text-color-secondary)] cursor-pointer px-3 sm:px-4 py-2.5 sm:py-3.5 text-xs sm:text-sm font-medium border-b-3 border-transparent transition-all duration-200 ease-in-out inline-flex items-center gap-2 flex-shrink-0 -mb-px opacity-80 hover:text-[var(--text-color)] hover:opacity-100 hover:bg-[var(--hover-background)]"
                class:active={activeSearchType === "videos"}
                class:text-[var(--primary-color)]={activeSearchType === "videos"}
                class:border-b-[var(--primary-color)]={activeSearchType === "videos"}
                class:font-semibold={activeSearchType === "videos"}
                class:opacity-100={activeSearchType === "videos"}
                onclick={() => changeSearchType("videos")}
            >
                <i class="fas fa-video"></i> Videolar
            </button>
            <button
                class="bg-transparent border-none text-[var(--text-color-secondary)] cursor-pointer px-3 sm:px-4 py-2.5 sm:py-3.5 text-xs sm:text-sm font-medium border-b-3 border-transparent transition-all duration-200 ease-in-out inline-flex items-center gap-2 flex-shrink-0 -mb-px opacity-80 hover:text-[var(--text-color)] hover:opacity-100 hover:bg-[var(--hover-background)]"
                class:active={activeSearchType === "news"}
                class:text-[var(--primary-color)]={activeSearchType === "news"}
                class:border-b-[var(--primary-color)]={activeSearchType === "news"}
                class:font-semibold={activeSearchType === "news"}
                class:opacity-100={activeSearchType === "news"}
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

    <div class="flex flex-wrap w-full box-border px-3 sm:px-6 gap-4 sm:gap-8 items-start max-w-[1100px] mx-2 sm:mx-4 mt-4 mb-8">
        <main class="flex-1 min-w-0 max-w-[700px] w-full mb-8" aria-live="polite">
            {#if isLoading}
                <div class="text-center mt-12 p-8 text-[var(--text-color-secondary)] rounded-xl bg-[var(--card-background)] border border-[var(--border-color)] shadow-sm" in:fade={{ duration: 200 }}>
                    <div class="w-10 h-10 border-3 border-[var(--border-color)] border-t-[var(--primary-color)] rounded-full animate-spin mx-auto mb-4"></div>
                    <p>{$t("loading") || "Sonuçlar yükleniyor..."}</p>
                </div>
            {:else if $error}
                <div class="text-center mt-12 p-6 text-[var(--text-color-secondary)] rounded-lg bg-[var(--card-background)] border border-[var(--border-color)]" in:fade={{ duration: 200 }}>
                    <p class="text-[#e57373] bg-[rgba(229,115,115,0.1)] border border-[rgba(229,115,115,0.3)] text-left p-4 rounded-lg">
                        Sonuçlar yüklenirken hata oluştu: {$error}
                    </p>
                    <button
                        class="mt-4 px-4 py-2 bg-[var(--primary-color)] text-white border-none rounded-md cursor-pointer text-sm inline-flex items-center gap-2 transition-all duration-200 hover:bg-[var(--primary-color-hover)] hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                        onclick={() =>
                            fetchSearchResults(searchQuery, activeSearchType)}
                        disabled={isLoading}
                    >
                        <i class="fas fa-sync-alt"></i> Tekrar Dene
                    </button>
                </div>
            {:else}
                <div class="flex flex-col gap-4">
                    <!-- Global Special Results (Plugins) -->
                    {#if $specialResults && $specialResults.length > 0}
                        <div
                            class="mb-5"
                        >
                            {#each $specialResults as res (res.id)}
                                <div
                                    class="bg-white rounded-lg shadow-md p-4"
                                    style={res.style}
                                >
                                    <div
                                        class="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full text-xs mb-1.5 border border-gray-200"
                                    >
                                        <i class={res.icon || "fas fa-magic"}
                                        ></i>
                                        <span>{res.plugin}</span>
                                    </div>
                                    <h4
                                        class="m-0 mb-1 text-lg"
                                    >
                                        {res.title}
                                    </h4>
                                    <div
                                        class="text-sm leading-6 text-[var(--text-color)]"
                                    >
                                        {@html res.content}
                                    </div>
                                    {#if res.type === "links" && res.links}
                                        <div
                                            class="flex gap-2.5 flex-wrap mt-2.5"
                                        >
                                            {#each res.links as link}
                                                <a
                                                    href={link.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="px-3 py-1.5 bg-[var(--primary-color)] text-white rounded-full text-decoration-none text-xs font-medium transition-opacity duration-200"
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
                            <div class="flex flex-col gap-4">
                                <!-- Spell Correction Banner -->
                                {#if spellCorrection}
                                    <div
                                        class="bg-[rgba(26,115,232,0.05)] border border-[rgba(26,115,232,0.1)] rounded-lg p-2 sm:p-3 mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3 text-sm sm:text-base text-[var(--text-color)]"
                                        in:slide={{ duration: 300 }}
                                    >
                                        <i class="fas fa-spell-check text-[#1a73e8] text-xl"></i>
                                        <span
                                            >Bunu mu demek istediniz:
                                            <button
                                                class="bg-none border-none p-0 m-0 text-[var(--primary-color)]"
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
                                                class="bg-none border-none p-0 m-0 text-[var(--text-color)] opacity-70 hover:opacity-100"
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
                                    <div class="bg-[var(--card-background)] border border-[rgba(127,127,127,0.15)] rounded-xl px-3 sm:px-5 py-4 sm:py-6 shadow-sm transition-all duration-300 overflow-hidden relative hover:-translate-y-0.5 hover:shadow-lg hover:border-[rgba(127,127,127,0.25)]">
                                        <div class="flex items-center mb-1 gap-1.5 sm:gap-2 leading-6">
                                            <img
                                                src={result.icon ||
                                                    "/favicon.ico"}
                                                alt=""
                                                class="w-4 h-4 flex-shrink-0 align-middle"
                                                loading="lazy"
                                                onerror={(e) => {
                                                    e.target.style.display =
                                                        "none";
                                                }}
                                            />
                                            <span class="text-[10px] sm:text-xs text-[var(--text-color-secondary)] flex-grow whitespace-nowrap overflow-hidden text-ellipsis"
                                                >{getDomain(result.url)}</span
                                            >
                                            {#if Array.isArray(result.sources) && result.sources.length > 1}
                                                <span class="text-xs text-[var(--text-color-secondary)] flex-shrink-0 whitespace-nowrap">
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
                                                <span class="text-xs text-[var(--text-color-secondary)] flex-shrink-0 whitespace-nowrap">
                                                    - {formatAge(
                                                        result.age,
                                                    )}</span
                                                >
                                            {/if}

                                            <div class="relative ml-auto flex items-center">
                                                <button
                                                    class="bg-none border-none text-[var(--text-color-secondary)] cursor-pointer text-base px-1 leading-1 flex-shrink-0 rounded-full transition-colors duration-200 hover:text-[var(--text-color)] hover:bg-[var(--hover-background)]"
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
                                                        class="absolute right-0 top-full bg-[var(--card-background)] border border-[var(--border-color)] rounded-lg shadow-lg z-10 min-w-[180px] p-1"
                                                        transition:fade={{
                                                            duration: 100,
                                                        }}
                                                    >
                                                        <button
                                                            class="flex items-center w-full px-4 py-1.5 border-none bg-none text-left cursor-pointer text-[var(--text-color)] text-sm gap-2 hover:bg-[var(--hover-background)] hover:text-[var(--primary-color)]"
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
                                                            class="flex items-center w-full px-4 py-1.5 border-none bg-none text-left cursor-pointer text-[var(--text-color)] text-sm gap-2 hover:bg-[var(--hover-background)] hover:text-[var(--primary-color)]"
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
                                        <h3 class="text-xl mb-1 mt-0 leading-7 font-medium">
                                            <a
                                                href={result.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                >{result.title}</a
                                            >
                                        </h3>
                                        <p class="text-xs sm:text-sm text-[var(--text-color-secondary)] leading-6 sm:leading-7 mt-0.5">
                                            {result.description ||
                                                "Açıklama yok."}
                                        </p>
                                    </div>
                                {/each}
                            </div>
                        {:else if searchQuery}
                            <div class="text-center mt-8 sm:mt-12 p-4 sm:p-6 text-[var(--text-color-secondary)] rounded-lg bg-[var(--card-background)] border border-[var(--border-color)]">
                                <p>
                                    "<strong>{searchQuery}</strong>" için sonuç
                                    bulunamadı.
                                </p>
                            </div>
                        {/if}

                        <!-- === IMAGE RESULTS === -->
                    {:else if activeSearchType === "images"}
                        {#if $searchResults.length > 0}
                            <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 sm:gap-4">
                                {#each $searchResults as result, i (result.thumbnail + i)}
                                    <div class="bg-[var(--card-background)] rounded-xl overflow-hidden border border-[var(--border-color)] transition-all duration-200 flex flex-col hover:-translate-y-0.5 hover:shadow-lg">
                                        <div class="relative pt-[75%] bg-gray-100 overflow-hidden">
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
                                            <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 pb-2 flex justify-end gap-2 opacity-0 transition-opacity duration-200 hover:opacity-100">
                                                <a
                                                    href={result.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="bg-white/20 backdrop-blur text-white border border-white/30 w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-200 hover:bg-white/40"
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
                                                    class="bg-white/20 backdrop-blur text-white border border-white/30 w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-200 hover:bg-white/40"
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
                                            class="p-2 sm:p-3 text-decoration-none flex flex-col bg-[var(--card-background)] z-1"
                                        >
                                            <span class="text-xs sm:text-sm text-[var(--text-color)] whitespace-nowrap overflow-hidden text-ellipsis font-medium mb-1"
                                                >{result.title}</span
                                            >
                                            <span class="text-[10px] sm:text-xs text-[var(--text-color-secondary)] flex items-center gap-1">
                                                {#if result.sourceIcon}<img
                                                        src={result.sourceIcon}
                                                        alt=""
                                                        class="w-3.5 h-3.5 rounded"
                                                    />{/if}
                                                {getDomain(result.source)}
                                            </span>
                                        </a>
                                    </div>
                                {/each}
                            </div>
                        {:else if searchQuery}
                            <div class="text-center mt-8 sm:mt-12 p-4 sm:p-6 text-[var(--text-color-secondary)] rounded-lg bg-[var(--card-background)] border border-[var(--border-color)]">
                                <p>
                                    '{searchQuery}' için görsel sonucu
                                    bulunamadı.
                                </p>
                            </div>
                        {/if}

                        <!-- === VIDEO RESULTS === -->
                    {:else if activeSearchType === "videos"}
                        {#if $searchResults.length > 0}
                            <div class="flex flex-col gap-4">
                                {#each $searchResults as result (result.url)}
                                    <div
                                        class="bg-[var(--card-background)] border border-[rgba(127,127,127,0.15)] rounded-xl px-5 py-6 shadow-sm transition-all duration-300 overflow-hidden relative hover:-translate-y-0.5 hover:shadow-lg hover:border-[rgba(127,127,127,0.25)] flex flex-row p-0 gap-4 overflow-hidden transition-colors duration-200 hover:bg-[var(--hover-background)]"
                                    >
                                        <div class="relative w-[200px] sm:w-[260px] h-[112px] sm:h-[146px] flex-shrink-0 bg-black overflow-hidden rounded-lg">
                                            <a
                                                href={result.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label={result.title}
                                            >
                                                <img
                                                    src={result.thumbnail}
                                                    alt=""
                                                    class="absolute top-0 left-0 w-full h-full object-cover opacity-95 transition-opacity duration-200"
                                                    loading="lazy"
                                                    onerror={(e) => {
                                                        e.target.style.visibility =
                                                            "hidden";
                                                    }}
                                                />
                                                <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 rounded-full flex items-center justify-center text-white text-xl opacity-80 transition-all duration-200 hover:bg-[var(--primary-color)] hover:opacity-100 hover:scale-110">
                                                    <i class="fas fa-play"></i>
                                                </div>
                                                {#if result.duration}
                                                    <div class="absolute bottom-2 right-2 bg-black/80 text-white px-1.5 py-0.5 rounded text-xs font-medium">
                                                        {formatDuration(
                                                            result.duration,
                                                        )}
                                                    </div>
                                                {/if}
                                            </a>
                                        </div>
                                        <div class="p-3 sm:p-4 flex flex-col gap-1">
                                            <h3
                                                class="text-lg sm:text-xl mb-1 mt-0 leading-7 font-medium"
                                            >
                                                <a
                                                    href={result.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    >{result.title}</a
                                                >
                                            </h3>
                                            <div class="text-xs sm:text-sm text-[var(--text-color-secondary)] leading-5 sm:leading-6 flex items-center flex-wrap">
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
                                                class="text-xs sm:text-sm text-[var(--text-color-secondary)] leading-6 sm:leading-7 mt-0.5"
                                            >
                                                {result.description || ""}
                                            </p>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {:else if searchQuery}
                            <div class="text-center mt-8 sm:mt-12 p-4 sm:p-6 text-[var(--text-color-secondary)] rounded-lg bg-[var(--card-background)] border border-[var(--border-color)]">
                                <p>
                                    '{searchQuery}' için video sonucu
                                    bulunamadı.
                                </p>
                            </div>
                        {/if}

                        <!-- === NEWS RESULTS === -->
                    {:else if activeSearchType === "news"}
                        {#if $searchResults.length > 0}
                            <div class="flex flex-col gap-4">
                                {#each $searchResults as result (result.url)}
                                    <div
                                        class="bg-[var(--card-background)] border border-[rgba(127,127,127,0.15)] rounded-xl px-3 sm:px-5 py-4 sm:py-6 shadow-sm transition-all duration-300 overflow-hidden relative hover:-translate-y-0.5 hover:shadow-lg hover:border-[rgba(127,127,127,0.25)] flex flex-row gap-4 sm:gap-6 p-3 sm:p-5 items-start"
                                    >
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center text-[10px] sm:text-xs text-[var(--text-color-secondary)] mb-2">
                                                {#if result.icon}<img
                                                        src={result.icon}
                                                        alt=""
                                                        class="w-4 h-4 mr-2 rounded"
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
                                            <h3 class="text-xl mb-1 mt-0 leading-7 font-medium">
                                                <a
                                                    href={result.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    {result.title}
                                                </a>
                                            </h3>
                                        </div>
                                        <div class="flex gap-3 sm:gap-4">
                                            {#if result.thumbnail}
                                                <div class="flex-shrink-0 w-[80px] sm:w-[120px] h-[80px] sm:h-[120px] rounded-lg overflow-hidden bg-[var(--background-secondary)]">
                                                    <img
                                                        src={result.thumbnail}
                                                        alt=""
                                                        class="w-full h-full object-cover"
                                                        loading="lazy"
                                                        onerror={(e) => {
                                                            e.target.style.display =
                                                                "none";
                                                        }}
                                                    />
                                                </div>
                                            {/if}
                                            <div class="flex-1 min-w-0">
                                                <p class="text-sm sm:text-base text-[var(--text-color-secondary)] leading-5 sm:leading-6 mt-1">{result.description}</p>
                                            </div>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {:else if searchQuery}
                            <div class="text-center mt-8 sm:mt-12 p-4 sm:p-6 text-[var(--text-color-secondary)] rounded-lg bg-[var(--card-background)] border border-[var(--border-color)]">
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
                    <div class="flex justify-center items-center gap-1 sm:gap-2 my-6 sm:my-8 flex-wrap">
                        <!-- Prev Button -->
                        <button
                            class="bg-[var(--card-background)] border border-[var(--border-color)] text-[var(--text-color)] w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full cursor-pointer font-medium transition-all duration-200 text-decoration-none select-none hover:bg-[var(--hover-background)] hover:text-[var(--primary-color)] hover:border-[var(--primary-color)] w-auto px-3 sm:px-4 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--disabled-background)]"
                            disabled={currentPage <= 1 || isLoading}
                            onclick={() => goToPage(currentPage - 1)}
                            aria-label="Önceki sayfa"
                        >
                            <i
                                class="fas fa-chevron-left mr-1"
                            ></i> Önceki
                        </button>

                        <!-- Page Numbers -->
                        {#each paginationPages.slice(0, 12) as page}
                            <button
                                class="bg-[var(--card-background)] border border-[var(--border-color)] text-[var(--text-color)] w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full cursor-pointer font-medium transition-all duration-200 text-decoration-none select-none hover:bg-[var(--hover-background)] hover:text-[var(--primary-color)] hover:border-[var(--primary-color)]"
                                class:active={page === currentPage}
                                class:bg-[var(--primary-color)]={page === currentPage}
                                class:text-white={page === currentPage}
                                class:border-[var(--primary-color)]={page === currentPage}
                                class:font-bold={page === currentPage}
                                class:cursor-default={page === currentPage}
                                onclick={() => goToPage(page)}
                                disabled={isLoading}
                            >
                                {page}
                            </button>
                        {/each}

                        <!-- Next Button -->
                        <button
                            class="bg-[var(--card-background)] border border-[var(--border-color)] text-[var(--text-color)] w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full cursor-pointer font-medium transition-all duration-200 text-decoration-none select-none hover:bg-[var(--hover-background)] hover:text-[var(--primary-color)] hover:border-[var(--primary-color)] w-auto px-3 sm:px-4 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--disabled-background)]"
                            disabled={!$hasMoreResults ||
                                isLoading ||
                                currentPage >= 12}
                            onclick={() => goToPage(currentPage + 1)}
                            aria-label="Sonraki sayfa"
                        >
                            Sonraki <i
                                class="fas fa-chevron-right ml-1"
                            ></i>
                        </button>
                    </div>
                {/if}
            {/if}
        </main>

        <!-- === Infobox Area === -->
        {#if activeSearchType === "web" && $infoBoxResult && !isLoading && !$error}
            <aside class="w-full sm:w-[300px] flex-shrink-0 mt-4 sm:mt-0 sticky top-[calc(61px+48px+1.5rem)] self-start">
                <!-- Wikipedia Özet Kutusu (Öncelikli gösterilir) -->
                {#if $infoBoxResult.wikipediaInfo}
                    <div class="bg-[var(--card-background)] border border-[var(--border-color)] rounded-xl p-6 mb-4">
                        <h4>
                            <i class="fas fa-book-open wiki-icon"></i>
                            {$infoBoxResult.wikipediaInfo.title || "Wikipedia"}
                        </h4>
                        {#if $infoBoxResult.wikipediaInfo.thumbnail}
                            <img
                                src={$infoBoxResult.wikipediaInfo.thumbnail}
                                alt={$infoBoxResult.wikipediaInfo.title || ""}
                                class="w-full h-full object-cover"
                                loading="lazy"
                                onerror={(e) => {
                                    e.target.style.display = "none";
                                }}
                            />
                        {/if}
                        {#if $infoBoxResult.wikipediaInfo.extract}
                                <p class="text-sm leading-6 text-[var(--text-color)]">
                                {$infoBoxResult.wikipediaInfo.extract}
                            </p>
                        {/if}
                        {#if $infoBoxResult.wikipediaInfo.url}
                            <a
                                href={$infoBoxResult.wikipediaInfo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="text-[var(--primary-color)] hover:underline"
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
                        <div class="bg-[var(--card-background)] border border-[var(--border-color)] rounded-xl p-6 mb-4">
                            <h4>Hesap Makinesi</h4>
                            <p class="text-sm text-[var(--text-color-secondary)]">{$infoBoxResult.query}</p>
                            <p class="text-lg font-bold text-[var(--text-color)]">= {$infoBoxResult.result}</p>
                        </div>
                    {:else if $infoBoxResult.type === "location" && $infoBoxResult.data}
                        <div class="bg-[var(--card-background)] border border-[var(--border-color)] rounded-xl p-6 mb-4">
                            <h4>
                                {$infoBoxResult.data.name || "Konum Bilgisi"}
                            </h4>
                            {#if $infoBoxResult.data.profile?.img}
                                <img
                                    src={$infoBoxResult.data.profile.img}
                                    alt={$infoBoxResult.data.name || ""}
                                    class="w-full h-auto rounded-lg"
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
                                <p class="text-sm text-[var(--text-color-secondary)]">
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
                        <div class="bg-[var(--card-background)] border border-[var(--border-color)] rounded-xl p-6 mb-4">
                            <h4>{$infoBoxResult.title || "Site Bilgisi"}</h4>

                            {#if $infoBoxResult.profile?.img}
                                <img
                                    src={$infoBoxResult.profile.img}
                                    alt={$infoBoxResult.title || "Logo"}
                                    class="w-full h-auto rounded-lg"
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
                                <p class="text-sm text-[var(--text-color-secondary)]">
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
                        <div class="bg-[var(--card-background)] border border-[var(--border-color)] rounded-xl p-6 mb-4">
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
                                    class="w-full h-auto rounded-lg"
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
