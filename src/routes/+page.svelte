<script>
  import { getContext, onMount, onDestroy } from "svelte";
  import { writable } from "svelte/store"; // For local state if needed
  import { goto } from "$app/navigation"; // Import goto for navigation

  import { fade } from "svelte/transition";

  // Get stores from context provided by layout
  const selectedTheme = getContext("theme"); // Read-only access is enough here
  import {
    searchHomeDesign,
    selectedEngine,
    enableSuggestions,
    customLogo,
    isSidebarOpen,
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
    showSuggestions = false;
    clearTimeout(suggestTimeout);
    // Optionally focus the input after clearing
    // document.querySelector('.search-box input[type="text"] ').focus();
  }

  // --- Autosuggest Logic ---
  let suggestions = [];
  let showSuggestions = false;
  let suggestTimeout;

  async function fetchSuggestions(q) {
    console.log('🔍 fetchSuggestions called:', q, 'enableSuggestions:', $enableSuggestions);
    if (!$enableSuggestions || !q || q.length < 2) {
      console.log('❌ Suggestions disabled or too short');
      suggestions = [];
      return;
    }
    try {
      console.log('🌐 Fetching suggestions for:', q);
      const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        console.log('✅ Suggestions received:', data);
        suggestions = data;
      } else {
        console.log('❌ API response not ok:', res.status);
        suggestions = [];
      }
    } catch (e) {
      console.error("❌ Suggestion fetch error", e);
      suggestions = [];
    }
  }

  let focusedSuggestionIndex = -1;

  function handleInput(event) {
    const val = event.target.value;
    console.log('⌨️ handleInput:', val);
    searchQuery = val;
    focusedSuggestionIndex = -1; // Reset focus on input
    clearTimeout(suggestTimeout);

    if (val.trim().length > 1) {
      console.log('⏰ Setting timeout for suggestions...');
      suggestTimeout = setTimeout(() => {
        fetchSuggestions(val);
        showSuggestions = true;
        console.log('👁️ showSuggestions set to true');
      }, 300);
    } else {
      showSuggestions = false;
      console.log('👁️ showSuggestions set to false (too short)');
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
    searchQuery = s;
    showSuggestions = false;
    performSearchNavigation();
  }

  function handleBlur() {
    // Small timeout to allow click to fire
    setTimeout(() => {
      showSuggestions = false;
    }, 200);
  }

  function clickOutsideSuggestions(event) {
    if (!event.target.closest(".search-box")) {
      showSuggestions = false;
    }
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

<svelte:window on:click={clickOutsideSuggestions} />

<div class="home-container"
  class:modern={$searchHomeDesign === "modern"}
  class:artistic={$searchHomeDesign === "artistic"}
  in:fade={{ duration: 400 }}
>
  <div class="home-header">
    <button
      class="menu-button"
      on:click={toggleSidebar}
      aria-label="Menüyü aç"
    >
      <i class="fas fa-sliders"></i>
    </button>
  </div>
  <div class="logo-container">
    <img src={$customLogo} alt="Artado Search" class="logo" />
    <h1 style="text-transform: none;">Artado Search</h1>
    <p class="subtitle">İnterneti Keşfet</p>
  </div>

  <div class="search-container">
    <div class="search-box">
      <i class="fas fa-search search-icon"></i>
      <div class="input-wrapper" style="flex:1; width:100%; display: flex;">
        <input
          type="text"
          value={searchQuery}
          on:input={handleInput}
          on:keydown={handleKeyDown}
          on:blur={handleBlur}
          on:focus={() => {
            if (searchQuery.length > 1 && suggestions.length > 0)
              showSuggestions = true;
          }}
          placeholder="Ne aramıştınız?"
          aria-label="Arama"
          class="search-input"
          autocomplete="off"
        />
        {#if showSuggestions && suggestions.length > 0}
          <div
            class="suggestions-dropdown"
            transition:fly={{ y: 20, duration: 400, delay: 0 }}
          >
            <div class="suggestions-header">
              <i class="fas fa-magic"></i> Öneriler
            </div>
            {#each suggestions.slice(0, 7) as s, i}
              <button
                class="suggestion-item"
                class:focused={i === focusedSuggestionIndex}
                on:click={() => selectSuggestion(s)}
              >
                <div class="suggestion-icon-wrapper">
                  <i class="fas fa-search"></i>
                </div>
                <span
                  >{@html s.replace(
                    new RegExp(
                      searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                      "gi",
                    ),
                    (match) => `<b>${match}</b>`,
                  )}</span
                >
                <i class="fas fa-arrow-up suggestion-arrow"></i>
              </button>
            {/each}
          </div>
        {/if}
      </div>
      {#if searchQuery}
        <button
          class="clear-button"
          on:click={clearSearch}
          aria-label="Aramayı temizle"
        >
          <i class="fas fa-times"></i>
        </button>
      {/if}
      <button
        class="mic-button"
        class:listening={isListening}
        on:click={isListening ? stopListening : startListening}
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
        on:click={handleSearch}
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
          on:click={toggleSidebar}
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

<style>
  /* Styles specific to the home page content */
  .home-container {
    width: 100%;
    flex: 1; /* Take remaining vertical space */
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;
    box-sizing: border-box; /* Include padding in width/height */
    background-color: var(--background-color);
    background-image: var(--background-image, none);
    color: var(--text-color);
  }

  .home-header {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    width: 100%;
    max-width: 1200px;
    margin-bottom: 2rem;
    padding: 0 2rem;
    align-self: flex-end;
  }

  .home-header h1 {
    font-size: 2.8rem;
    margin: 0;
    color: var(--header-color);
    font-weight: 600;
  }

  .home-header .menu-button {
    background: var(--card-background);
    border: 1px solid var(--border-color);
    color: var(--text-color);
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s ease;
  }

  .home-header .menu-button:hover {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
  }

  .logo-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 4rem 0 2rem 0;
    text-align: center;
  }

  .logo {
    width: 120px;
    height: 120px;
    margin-bottom: 0.5rem;
    /* Assuming logo.png is circular or has transparent bg */
  }

  h1 {
    font-size: 2.8rem;
    margin: 0;
    color: var(--header-color);
    font-weight: 600;
  }

  .subtitle {
    font-size: 1.1rem;
    color: var(--text-color-secondary);
    margin-top: 0.5rem;
  }

  .search-container {
    width: 100%;
    max-width: 580px;
    margin-bottom: 3rem;
  }

  .search-box {
    display: flex;
    align-items: center;
    background: var(--card-background);
    border-radius: 24px;
    padding: 0.6rem 1rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border: 1px solid var(--border-color);
    transition: all 0.2s ease;
    position: relative;
  }

  .search-box:focus-within {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border-color: var(--primary-color);
  }

  .search-icon {
    margin: 0 0.8rem;
    color: var(--text-color-secondary);
    font-size: 1.1rem;
  }

  .search-input {
    flex: 1;
    border: none;
    padding: 0.5rem 0.8rem;
    font-size: 1rem;
    outline: none;
    background: transparent;
    color: var(--text-color);
    min-width: 0;
    height: 100%;
    cursor: text;
    pointer-events: auto;
    font-weight: 400;
  }

  input[type="text"]::placeholder {
    color: var(--text-color-secondary);
    opacity: 0.8;
  }

  .search-box button {
    background: none;
    border: none;
    padding: 0.6rem;
    margin-left: 0.5rem;
    cursor: pointer;
    color: var(--text-color-secondary);
    border-radius: 50%;
    transition:
      background-color 0.2s,
      color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .clear-button:hover {
    color: var(--danger-color);
    background-color: rgba(255, 59, 48, 0.1);
  }

  .mic-button:hover {
    color: var(--primary-color);
    background-color: rgba(26, 115, 232, 0.1);
  }

  .search-action-button {
    background-color: #1a73e8 !important;
    color: white !important;
    padding: 0 !important;
    font-size: 1rem !important;
    margin-left: 0.8rem !important;
    height: 44px;
    width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .search-action-button:hover {
    background-color: #1558b8 !important;
    color: white !important;
  }

  .search-action-button:disabled {
    background-color: var(--disabled-background) !important;
    color: var(--text-color-secondary) !important;
    cursor: not-allowed;
  }

  .search-action-icon {
    font-size: 1.1rem;
  }

  /* Autosuggest Styles - Modern Design */
  .suggestions-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    background: rgba(20, 20, 25, 0.95);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow:
      0 20px 40px rgba(0, 0, 0, 0.4),
      0 0 0 1px rgba(255, 255, 255, 0.05),
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
    color: rgba(255, 255, 255, 0.4);
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
    color: rgba(255, 255, 255, 0.9);
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
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
    border-radius: 10px;
    opacity: 0;
    transition: opacity 0.2s ease;
    z-index: -1;
  }

  .suggestion-item:hover {
    background: transparent;
    color: #ffffff;
    transform: translateX(0px);
  }

  .suggestion-item.focused {
    background: transparent;
    color: #ffffff;
    transform: translateX(0px);
  }

  .suggestion-item:hover::before {
    opacity: 1;
    border-radius: 10px;
  }

  .suggestion-item.focused::before {
    opacity: 1;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.08));
    border-radius: 10px;
  }

  .suggestion-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.6);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
    font-size: 0.9rem;
  }

  .suggestion-item:hover .suggestion-icon-wrapper {
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.9);
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .suggestion-item.focused .suggestion-icon-wrapper {
    background: rgba(255, 255, 255, 0.18);
    color: #ffffff;
    transform: scale(1.15);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
  }

  .suggestion-arrow {
    margin-left: auto;
    opacity: 0;
    transform: translateX(-5px) rotate(-45deg);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
  }

  .suggestion-item:hover .suggestion-arrow {
    opacity: 0.8;
    transform: translateX(0) rotate(-45deg);
    color: rgba(255, 255, 255, 0.7);
  }

  .suggestion-item.focused .suggestion-arrow {
    opacity: 1;
    transform: translateX(0) rotate(-45deg);
    color: #ffffff;
  }


  .results {
    text-align: left;
    margin-top: 2rem;
    width: 100%;
    max-width: 700px;
    padding-bottom: 2rem; /* Add padding at the bottom */
  }

  .results-header {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
  }

  .results-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0;
  }

  .results-header .menu-button {
    background: var(--card-background);
    border: 1px solid var(--border-color);
    color: var(--text-color);
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s ease;
  }

  .results-header .menu-button:hover {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
  }

  .result-item {
    background: var(--card-background);
    padding: 1.2rem 1.5rem;
    margin-bottom: 1.2rem;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    border: 1px solid var(--border-color);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }

  .result-item:hover {
    transform: translateY(-3px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
  }

  .result-title {
    margin: 0 0 0.4rem 0;
    font-size: 1.2rem;
    color: var(--text-color);
  }

  .result-title a {
    color: var(--link-color);
    text-decoration: none;
    font-weight: 500;
  }

  .result-title a:hover {
    text-decoration: underline;
  }

  .result-url {
    color: var(--link-color-visited);
    margin: 0 0 0.6rem 0;
    font-size: 0.9rem;
    display: block;
    word-break: break-all;
    text-decoration: none;
  }

  .result-url i {
    margin-right: 0.3rem;
    font-size: 0.8rem;
  }

  .result-url:hover {
    text-decoration: underline;
  }

  .result-snippet {
    color: var(--text-secondary);
    font-size: 0.95rem;
    line-height: 1.5;
    margin: 0;
  }

  .result-description {
    color: var(--text-color-secondary);
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .loading-initial {
    margin-top: 4rem;
    color: var(--text-color-secondary);
  }

  /* Style for active listening state */
  .mic-button.listening {
    color: var(--danger-color);
    background-color: var(--hover-background);
  }

  /* Improve focus visibility for accessibility */
  button:focus-visible,
  a:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px var(--primary-color-light);
  }
  
  input:not(.search-input):focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px var(--primary-color-light);
  }
  select:focus {
    /* Override default select focus to use focus-visible */
    outline: none;
    box-shadow: none;
  }

  .search-input:focus-visible {
    outline: none; /* Remove default outline on the input itself */
    box-shadow: none; /* Ensure no box-shadow is applied directly to the input on focus */
  }

  /* Search Home Designs */
  .home-container.modern {
    background: radial-gradient(
      circle at center,
      var(--card-background) 0%,
      var(--background-color) 100%
    );
  }
  .home-container.modern h1 {
    font-size: 4rem;
    background: linear-gradient(
      135deg,
      var(--primary-color),
      var(--accent-color)
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .home-container.modern .search-box {
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    padding: 0.8rem 1.2rem;
  }

  .home-container.artistic {
    background-image: linear-gradient(
      120deg,
      #a1c4fd 0%,
      #c2e9fb 100%
    ); /* Example gradient */
  }
  :global(body.dark) .home-container.artistic {
    background-image: linear-gradient(to top, #30cfd0 0%, #330867 100%);
  }

  .home-container.artistic h1 {
    font-family: "serif"; /* Example font change */
    font-style: italic;
  }

  @media (max-width: 768px) {
    .home-container {
      padding: 1rem;
      min-height: 100vh;
      justify-content: flex-start;
      padding-top: 2rem;
    }
    
    .home-header {
      padding: 0 1rem;
      margin-bottom: 1.5rem;
    }
    
    .home-header h1 {
      font-size: 2rem;
    }
    
    .home-header .menu-button {
      padding: 0.4rem 0.8rem;
      font-size: 0.8rem;
    }
    
    .logo-container {
      margin-bottom: 2rem;
      gap: 1rem;
      text-align: center;
    }
    
    .logo {
      width: 70px;
      height: 70px;
      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.1));
    }
    
    h1 {
      font-size: 1.75rem;
      letter-spacing: -0.5px;
      margin: 0 0 1rem 0;
      line-height: 1.2;
    }
    
    .subtitle {
      font-size: 0.9rem;
      opacity: 0.8;
      margin: 0;
    }
    
    .search-container {
      width: 100% !important;
      max-width: none !important;
      padding: 0;
      margin: 0 auto;
    }
    
    .search-box {
      padding: 1rem;
      height: 52px;
      margin: 0;
      font-size: 1rem;
      border-radius: 1rem;
      width: 100%;
      max-width: 100%;
    }
    
    .search-input {
      font-size: 1rem;
      width: 100% !important;
    }
    
    .search-icon {
      font-size: 1.1rem;
      margin-right: 0.75rem;
      flex-shrink: 0;
    }
    
    .voice-search-btn {
      width: 40px;
      height: 40px;
      font-size: 0.9rem;
      flex-shrink: 0;
    }
    
    .suggestion-item {
      padding: 0.8rem 1rem;
      gap: 0.75rem;
      font-size: 0.95rem;
    }
    
    .suggestion-icon-wrapper {
      width: 28px;
      height: 28px;
      font-size: 0.8rem;
    }
    
    .results {
      padding: 0 1rem;
    }
    
    /* Search Results Mobile Responsive */
    .results {
      margin-top: 1.5rem;
      max-width: none;
      padding: 0 0.5rem;
    }
    
    .result-item {
      padding: 1rem;
      margin-bottom: 1rem;
      border-radius: 0.875rem;
    }
    
    .result-title {
      font-size: 1.1rem;
      margin: 0 0 0.3rem 0;
      line-height: 1.3;
    }
    
    .result-url {
      font-size: 0.8rem;
      margin: 0 0 0.5rem 0;
    }
    
    .result-snippet {
      font-size: 0.9rem;
      line-height: 1.4;
    }
    
    .loading-initial {
      margin-top: 2rem;
    }
    
    .loading-initial i {
      font-size: 2rem !important;
    }
  }
  
  /* --- Homepage Mobile Design --- */
  @media (max-width: 480px) {
    .home-container {
      padding: 0.75rem;
      padding-top: 1.5rem;
      justify-content: flex-start;
    }
    
    .logo-container {
      margin-bottom: 1.5rem;
      gap: 0.75rem;
    }
    
    .logo {
      width: 50px;
      height: 50px;
    }
    
    h1 {
      font-size: 1.5rem;
      margin: 0 0 0.5rem 0;
      line-height: 1.1;
    }
    
    .subtitle {
      font-size: 0.85rem;
    }
    
    .search-container {
      padding: 0;
      width: 100% !important;
    }
    
    .search-box {
      padding: 0.875rem;
      height: 48px;
      font-size: 0.9rem;
      border-radius: 0.875rem;
    }
    
    .search-input {
      font-size: 0.9rem;
    }
    
    .search-icon {
      font-size: 1rem;
      margin-right: 0.5rem;
    }
    
    .voice-search-btn {
      width: 36px;
      height: 36px;
      font-size: 0.8rem;
    }
    
    .suggestion-item {
      padding: 0.75rem;
      gap: 0.5rem;
      font-size: 0.9rem;
    }
    
    .suggestion-icon-wrapper {
      width: 24px;
      height: 24px;
      font-size: 0.7rem;
    }
    
    /* Search Results Mobile Responsive */
    .results {
      margin-top: 1rem;
      padding: 0 0.25rem;
    }
    
    .result-item {
      padding: 0.75rem;
      margin-bottom: 0.75rem;
      border-radius: 0.75rem;
    }
    
    .result-title {
      font-size: 1rem;
      margin: 0 0 0.25rem 0;
      line-height: 1.2;
    }
    
    .result-url {
      font-size: 0.75rem;
      margin: 0 0 0.4rem 0;
    }
    
    .result-snippet {
      font-size: 0.85rem;
      line-height: 1.3;
    }
    
    .loading-initial {
      margin-top: 1.5rem;
    }
    
    .loading-initial i {
      font-size: 1.5rem !important;
    }
  }

  /* --- Extra Small Mobile --- */
  @media (max-width: 360px) {
    .home-container {
      padding: 0.5rem;
      padding-top: 1rem;
    }
    
    h1 {
      font-size: 1.3rem;
    }
    
    .search-box {
      height: 44px;
      padding: 0.75rem;
      font-size: 0.85rem;
    }
    
    .search-input {
      font-size: 0.85rem;
    }
    
    .logo {
      width: 45px;
      height: 45px;
    }
  }
</style>
