<script>
  import { getContext, onMount, onDestroy } from "svelte";
  import { writable } from "svelte/store"; // For local state if needed
  import { goto } from "$app/navigation"; // Import goto for navigation
  import { BANG_COMMANDS } from "$lib/bangs.js";

  // Güvenli metin vurgulama - XSS güvenli (innerHTML kullanmaz)
  function highlightParts(text, query) {
    if (!query || query.length < 2) return [{ text, bold: false }];
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex)
        parts.push({ text: text.slice(lastIndex, match.index), bold: false });
      parts.push({ text: match[0], bold: true });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length)
      parts.push({ text: text.slice(lastIndex), bold: false });
    return parts;
  }

  import { fade } from "svelte/transition";

  // Get stores from context provided by layout
  const selectedTheme = getContext("theme"); // Read-only access is enough here
  import {
    searchHomeDesign,
    selectedEngine,
    enableSuggestions,
    customLogo,
    isSidebarOpen,
    bangsOpenNewTab,
  } from "$lib/stores.js";
  import { browser } from "$app/environment";

  let searchQuery = "";
  let isLoading = false;
  let searchResults = [];
  let isListening = false; // State for microphone
  let recognition = null; // SpeechRecognition instance

  function toggleSidebar() {
    isSidebarOpen.set(!$isSidebarOpen);
  }

  // Initialize on mount if API exists
  onMount(() => {
    recognition = setupSpeechRecognition();
  });

  function clickOutsideSuggestions() {
    showSuggestions = false;
  }

  let customHomeThemeElement;
  function applyHomeTheme(theme) {
    if (!browser) return;
    if (customHomeThemeElement) {
      customHomeThemeElement.remove();
      customHomeThemeElement = null;
    }
    if (["simple", "modern", "artistic", "klasik"].includes(theme)) return;

    customHomeThemeElement = document.createElement("link");
    customHomeThemeElement.rel = "stylesheet";

    // Check if it's a remote URL
    if (
      theme &&
      (theme.startsWith("http://") || theme.startsWith("https://"))
    ) {
      customHomeThemeElement.href = theme;
      console.log("[Home] Loading remote theme:", theme);
    } else {
      // Try home subfolder first, then direct
      const paths = [
        `/themes/home/${theme}/${theme}.css`,
        `/themes/${theme}/${theme}.css`,
      ];

      customHomeThemeElement.href = paths[0];
      console.log("[Home] Loading local theme:", paths[0]);

      // Fallback mechanism
      customHomeThemeElement.onerror = () => {
        console.log("[Home] Primary theme load failed, trying fallback");
        if (
          customHomeThemeElement &&
          customHomeThemeElement.href.includes("/home/")
        ) {
          customHomeThemeElement.href = `/themes/${theme}/${theme}.css`;
          console.log("[Home] Trying fallback:", customHomeThemeElement.href);
        }
      };
    }

    customHomeThemeElement.onload = () => {
      console.log("[Home] Theme loaded successfully:", theme);
    };

    document.head.appendChild(customHomeThemeElement);
  }

  // Subscribe to searchHomeDesign changes
  $: {
    if (browser) {
      console.log("[Home] searchHomeDesign changed to:", $searchHomeDesign);
      applyHomeTheme($searchHomeDesign);
    }
  }

  function performSearchNavigation() {
    if (!searchQuery.trim()) return;

    const parts = searchQuery.trim().split(/\s+/);
    const bang = parts[0].toLowerCase();
    if (bang.startsWith("!") && BANG_COMMANDS[bang]) {
      const query = parts.slice(1).join(" ");
      const url = BANG_COMMANDS[bang].url + encodeURIComponent(query);
      if ($bangsOpenNewTab) {
        window.open(url, "_blank");
      } else {
        window.location.href = url;
      }
      return;
    }

    // Navigate to the search page with the query
    goto(`/search?i=${encodeURIComponent(searchQuery.trim())}`);
  }

  async function handleSearch() {
    performSearchNavigation();
    /* 
    // Original search logic (now moved to search page)
    if (!searchQuery.trim()) return;
    
    isLoading = true;
    searchResults = []; 
    try {
      const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&pretty=1`);
      if (!response.ok) throw new Error('API request failed');
      const data = await response.json();
      searchResults = data.RelatedTopics
        .filter(topic => topic.FirstURL && topic.Text) // Ensure required fields exist
        .map(topic => ({
          title: topic.Text?.split(' - ')[0] || topic.Text,
          description: topic.Text?.split(' - ')[1] || topic.Text,
          url: topic.FirstURL
        }));
    } catch (error) {
      console.error('Arama sırasında bir hata oluştu:', error);
      // TODO: Show error message to the user
    } finally {
      isLoading = false;
    }
    */
  }

  function clearSearch() {
    searchQuery = "";
    searchResults = [];
    suggestions = [];
    spellCorrection = null;
    showSuggestions = false;
    clearTimeout(suggestTimeout);
  }

  // --- Autosuggest Logic ---
  let suggestions = [];
  let spellCorrection = null;
  let showSuggestions = false;
  let suggestTimeout;

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
        // Yeni API formatı: { suggestions: [...], spellCorrection: {...} | null }
        if (Array.isArray(data)) {
          // Geriye dönük uyumluluk: eski format
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
      console.error("Suggestion fetch error", e);
      suggestions = [];
      spellCorrection = null;
    }
  }

  let focusedSuggestionIndex = -1;

  function handleInput(event) {
    const val = event.target.value;
    console.log("⌨️ handleInput:", val);
    searchQuery = val;
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
      console.log("⏰ Setting timeout for suggestions...");
      suggestTimeout = setTimeout(() => {
        fetchSuggestions(val);
        showSuggestions = true;
        console.log("👁️ showSuggestions set to true");
      }, 300);
    } else {
      showSuggestions = false;
      console.log("👁️ showSuggestions set to false (too short)");
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      clearTimeout(suggestTimeout);
      if (showSuggestions && focusedSuggestionIndex > -1) {
        selectSuggestion(suggestions[focusedSuggestionIndex]);
      } else {
        showSuggestions = false;
        performSearchNavigation();
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
        (focusedSuggestionIndex - 1 + suggestions.length) % suggestions.length;
    } else if (event.key === "Escape") {
      showSuggestions = false;
    }
  }

  function selectSuggestion(s) {
    searchQuery = s.text;
    showSuggestions = false;
    performSearchNavigation();
  }

  // --- Web Speech API Logic ---
  function setupSpeechRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Tarayıcınız Web Speech API desteklemiyor.");
      // alert("Üzgünüz, tarayıcınız sesli arama özelliğini desteklemiyor."); // Removed alert for better UX
      return null;
    }

    const instance = new SpeechRecognition();
    instance.continuous = false; // Stop after first result
    instance.lang = "tr-TR"; // Set language to Turkish
    instance.interimResults = false; // We only want final results
    instance.maxAlternatives = 1;

    instance.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log("Transcript:", transcript);
      searchQuery = transcript; // Update search query
      handleSearch(); // Perform search automatically
      isListening = false; // Update state
    };

    instance.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (
        event.error === "no-speech" ||
        event.error === "audio-capture" ||
        event.error === "not-allowed"
      ) {
        // Handle common non-critical errors gracefully
        // alert(
        //   `Ses tanıma hatası: ${event.error === "not-allowed" ? "Mikrofon izni reddedildi." : "Ses algılanamadı veya mikrofon sorunu."}`,
        // );
      } else {
        // alert(`Bir ses tanıma hatası oluştu: ${event.error}`);
      }
      isListening = false; // Update state
    };

    instance.onend = () => {
      console.log("Speech recognition ended.");
      // Ensure listening state is false if ended unexpectedly
      if (isListening) {
        isListening = false;
      }
    };

    return instance;
  }

  function startListening() {
    if (!recognition) {
      recognition = setupSpeechRecognition();
      if (!recognition) return; // Setup failed
    }

    if (recognition && !isListening) {
      try {
        recognition.start();
        isListening = true;
        console.log("Listening started...");
      } catch (err) {
        console.error("Error starting speech recognition:", err);
        // alert("Ses tanıma başlatılamadı.");
        isListening = false;
      }
    }
  }

  function stopListening() {
    if (recognition && isListening) {
      recognition.stop();
      isListening = false;
      console.log("Listening stopped manually.");
    }
  }

  // Initialize on mount if API exists
  onMount(() => {
    recognition = setupSpeechRecognition();
  });

  // Clean up on destroy
  onDestroy(() => {
    if (recognition) {
      recognition.stop(); // Ensure it stops if component is destroyed while listening
    }
  });
</script>

<svelte:head>
  <title>Artado Search</title>
</svelte:head>

<svelte:window onclick={clickOutsideSuggestions} />

<div
  class="home-container w-full flex flex-col items-center px-4 sm:px-6 box-border bg-[var(--background-color)]"
  style="background-image: var(--background-image, none); color: var(--text-color);"
  class:modern={$searchHomeDesign === "modern"}
  class:artistic={$searchHomeDesign === "artistic"}
  in:fade={{ duration: 400 }}
>
  <div class="home-header flex justify-end items-center w-full sm:max-w-[1200px] mb-4 sm:mb-8 px-4 sm:px-8 self-end">
    <button class="menu-button flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-[var(--card-background)] border border-[var(--border-color)] rounded-lg text-[var(--text-color)] hover:bg-[var(--primary-color)] hover:text-white hover:border-[var(--primary-color)] transition-all duration-200" onclick={toggleSidebar} aria-label="Menüyü aç">
      <i class="fas fa-sliders text-sm sm:text-base"></i>
      <span class="hidden sm:inline text-sm font-medium">Ayarlar</span>
    </button>
  </div>
  <div class="logo-container flex flex-col items-center mt-12 sm:mt-20 mb-6 sm:mb-10 text-center">
    <img src={$customLogo} alt="Artado Search" class="logo w-20 h-20 sm:w-[120px] sm:h-[120px] mb-2 sm:mb-2" />
    <h1 style="text-transform: none; font-size: 2rem sm:2.8rem; margin: 0; color: var(--header-color); font-weight: 600;">Artado Search</h1>
    <p class="subtitle text-sm sm:text-base text-[var(--text-color-secondary)] mt-2">İnterneti Keşfet</p>
  </div>

  <div class="search-container w-full sm:max-w-[600px] mb-8 sm:mb-16 px-2 sm:px-0">
    <div class="search-box flex items-center bg-[var(--card-background)] rounded-3xl p-3 sm:p-4 shadow-xl border border-[var(--border-color)] hover:border-[var(--primary-color)] transition-all duration-300" onclick={(e) => e.stopPropagation()}>
      <i class="fas fa-search search-icon text-[var(--text-color-secondary)] text-base sm:text-lg mr-3"></i>
      <div class="input-wrapper" style="flex:1; width:100%; display: flex;">
        <input
          type="text"
          value={searchQuery}
          oninput={handleInput}
          onkeydown={handleKeyDown}
          onfocus={() => {
            if (searchQuery.length > 1 && suggestions.length > 0)
              showSuggestions = true;
          }}
          placeholder="Ne aramıştınız?"
          aria-label="Arama"
          class="search-input flex-1 border-none outline-none px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base bg-transparent text-[var(--text-color)] placeholder-[var(--text-color-secondary)]"
          autocomplete="off"
        />
        {#if showSuggestions && (suggestions.length > 0 || spellCorrection)}
          <div
            class="suggestions-dropdown absolute top-full left-0 right-0 bg-[var(--card-background)] backdrop-blur-lg border border-[var(--border-color)] rounded-2xl shadow-xl mt-2 overflow-hidden z-50 max-h-[400px] overflow-y-auto"
            transition:fly={{ y: 20, duration: 400, delay: 0 }}
          >
            {#if spellCorrection}
              <button
                class="did-you-mean-row"
                onclick={() => selectSuggestion(spellCorrection.corrected)}
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
                <div style="display: flex; align-items: center; gap: 6px;">
                  <i class="fas fa-magic"></i> Öneriler
                </div>
                <button
                  class="close-suggestions-btn"
                  onclick={(e) => {
                    e.stopPropagation();
                    showSuggestions = false;
                  }}
                  title="Kapat"
                  aria-label="Önerileri Kapat"
                >
                  <i class="fas fa-times"></i>
                </button>
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
                      >{#each highlightParts(s.text, searchQuery) as part}{#if part.bold}<b
                            >{part.text}</b
                          >{:else}{part.text}{/if}{/each}</span
                    >
                    {#if s.description}
                      <span style="font-size: 0.75rem; opacity: 0.6;"
                        >{s.description}</span
                      >
                    {/if}
                  </div>
                  <i class="fas fa-arrow-up suggestion-arrow"></i>
                </button>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
      {#if searchQuery}
        <button
          class="clear-button"
          onclick={clearSearch}
          aria-label="Aramayı temizle"
        >
          <i class="fas fa-times"></i>
        </button>
      {/if}
      <button
        class="mic-button"
        class:listening={isListening}
        onclick={isListening ? stopListening : startListening}
        aria-label={isListening ? "Dinlemeyi Durdur" : "Sesli Arama"}
      >
        {#if isListening}
          <i class="fas fa-microphone-slash"></i>
        {:else}
          <i class="fas fa-microphone"></i>
        {/if}
      </button>
      <button
        class="search-action-button"
        onclick={handleSearch}
        disabled={isLoading}
        aria-label="Ara"
      >
        {#if isLoading}
          <i class="fas fa-spinner fa-spin search-action-icon"></i>
        {:else}
          <i class="fas fa-arrow-right search-action-icon"></i>
        {/if}
      </button>
    </div>
  </div>

  {#if isLoading && searchResults.length === 0}
    <div class="loading-initial">
      <i class="fas fa-spinner fa-spin fa-3x"></i>
    </div>
  {/if}

  {#if searchResults.length > 0}
    <div class="results">
      <div class="results-header">
        <h2>Arama Sonuçları</h2>
        <button
          class="menu-button"
          onclick={toggleSidebar}
          aria-label="Menüyü aç"
        >
          <i class="fas fa-sliders"></i>
        </button>
      </div>
      {#each searchResults as result (result.url)}
        <div class="result-item">
          <h3 class="result-title">
            <a href={result.url} target="_blank" rel="noopener noreferrer">
              {result.title}
            </a>
          </h3>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            class="result-url"
          >
            <i class="fas fa-link"></i>
            {result.url}
          </a>
          <p class="result-description">{result.description}</p>
        </div>
      {/each}
    </div>
  {/if}
</div>
