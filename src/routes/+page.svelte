<script>
  import { getContext, onMount, onDestroy } from "svelte";
  import { writable } from "svelte/store"; // For local state if needed
  import { goto } from "$app/navigation"; // Import goto for navigation

<<<<<<< HEAD
  // Get stores from context provided by layout
  const selectedTheme = getContext("theme"); // Read-only access is enough here
  import { searchHomeDesign } from "$lib/stores.js";
=======
  import { fade } from "svelte/transition";

  // Get stores from context provided by layout
  const selectedTheme = getContext("theme"); // Read-only access is enough here
  import { searchHomeDesign, selectedEngine } from "$lib/stores.js";
  import { searchHistory } from "$lib/searchHistory.js";
>>>>>>> 7f9df2b (İlk commit)
  // const isSidebarOpen = getContext('sidebar'); // Not directly needed here

  let searchQuery = "";
  let isLoading = false;
  let searchResults = [];
  let isListening = false; // State for microphone
  let recognition = null; // SpeechRecognition instance

  function performSearchNavigation() {
    if (!searchQuery.trim()) return;
<<<<<<< HEAD
=======
    searchHistory.addSearch(searchQuery.trim(), $selectedEngine, "web");
>>>>>>> 7f9df2b (İlk commit)
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

  function handleKeyPress(event) {
    if (event.key === "Enter") {
      performSearchNavigation(); // Use the new navigation function
    }
  }

  function clearSearch() {
    searchQuery = "";
    searchResults = [];
    // Optionally focus the input after clearing
    // document.querySelector('.search-box input[type="text"] ').focus();
  }

  // --- Web Speech API Logic ---
  function setupSpeechRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Tarayıcınız Web Speech API desteklemiyor.");
<<<<<<< HEAD
      alert("Üzgünüz, tarayıcınız sesli arama özelliğini desteklemiyor.");
=======
      // alert("Üzgünüz, tarayıcınız sesli arama özelliğini desteklemiyor."); // Removed alert for better UX
>>>>>>> 7f9df2b (İlk commit)
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
<<<<<<< HEAD
        alert(
          `Ses tanıma hatası: ${event.error === "not-allowed" ? "Mikrofon izni reddedildi." : "Ses algılanamadı veya mikrofon sorunu."}`,
        );
      } else {
        alert(`Bir ses tanıma hatası oluştu: ${event.error}`);
=======
        // alert(
        //   `Ses tanıma hatası: ${event.error === "not-allowed" ? "Mikrofon izni reddedildi." : "Ses algılanamadı veya mikrofon sorunu."}`,
        // );
      } else {
        // alert(`Bir ses tanıma hatası oluştu: ${event.error}`);
>>>>>>> 7f9df2b (İlk commit)
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
<<<<<<< HEAD
        alert("Ses tanıma başlatılamadı.");
=======
        // alert("Ses tanıma başlatılamadı.");
>>>>>>> 7f9df2b (İlk commit)
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

<div
  class="home-container"
  class:modern={$searchHomeDesign === "modern"}
  class:artistic={$searchHomeDesign === "artistic"}
<<<<<<< HEAD
=======
  in:fade={{ duration: 400 }}
>>>>>>> 7f9df2b (İlk commit)
>
  <div class="logo-container">
    <img src="/logo.png" alt="Artado Search" class="logo" />
    <h1>Artado Search</h1>
    <p class="subtitle">İnterneti Keşfet</p>
  </div>

  <div class="search-container">
    <div class="search-box">
      <i class="fas fa-search search-icon"></i>
      <input
        type="text"
        bind:value={searchQuery}
        on:keypress={handleKeyPress}
        placeholder="Ne aramıştınız?"
        aria-label="Arama"
        class="search-input"
      />
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
    max-width: 650px;
    margin-bottom: 3rem;
  }

  .search-box {
    display: flex;
    align-items: center;
    background: var(--input-background);
    border-radius: 50px;
    padding: 0.5rem 0.8rem;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
    border: 1px solid var(--border-color);
    transition:
      box-shadow 0.3s ease,
      border-color 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .search-box:focus-within {
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
    border-color: #1a73e8;
  }

  .search-icon {
    margin: 0 0.8rem;
    color: var(--text-color-secondary);
    font-size: 1.1rem;
  }

  .search-input {
    flex: 1;
    border: none;
    padding: 0.7rem 0.5rem;
    font-size: 1.1rem;
    outline: none;
    background: transparent;
    color: var(--text-color);
    min-width: 0;
    height: 100%;
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

  .search-box button:hover {
    background-color: var(--hover-background);
  }

  .clear-button:hover {
    color: var(--danger-color);
  }

  .mic-button:hover {
    color: var(--primary-color);
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

  .results {
    text-align: left;
    margin-top: 2rem;
    width: 100%;
    max-width: 700px;
    padding-bottom: 2rem; /* Add padding at the bottom */
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
  select:focus-visible,
  input:focus-visible {
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
</style>
