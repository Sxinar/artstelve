<script>
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { onMount, getContext } from 'svelte';
    import { writable } from 'svelte/store';
    import { aiSummaryEnabled } from '$lib/stores.js'; // Import AI summary setting
    import { t } from '$lib/i18n.js';

    // Get sidebar store from context
    const isSidebarOpen = getContext('sidebar');

    let searchQuery = '';
    let inputQuery = ''; // Separate state for the input field
    let isLoading = false;
    let searchResults = writable([]); 
    let error = writable(null); // Use writable store for error
    let activeSearchType = 'web'; // 'web', 'images', 'videos', 'news' etc.
    let infoBoxResult = writable(null); 
    let queryAiSummary = writable(null); // Store for the query AI summary

    // Fetch results from our backend API endpoint
    async function fetchSearchResults(query, type = 'web') {
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
            const apiUrl = `/api/search?i=${encodeURIComponent(query)}&t=${encodeURIComponent(type)}`;
            
            const response = await fetch(apiUrl); // Fetch from our own API

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { error: `API isteği başarısız: ${response.status}`, details: await response.text() };
                }
                 console.error("[Frontend] API Error:", errorData);
                 throw new Error(errorData.error || `API isteği başarısız: ${response.status}`);
            }
            
            // Data is already processed by the backend
            const data = await response.json();
            console.log('[Frontend] API Response:', data);

            searchResults.set(data.searchResults || []);
            infoBoxResult.set(data.infoBoxResult || null);
            queryAiSummary.set(data.queryAiSummary || null); // Set the query AI summary store

        } catch (err) {
            console.error('[Frontend] Error fetching search results:', err);
            error.set(err.message); // Set error store
            searchResults.set([]);
            infoBoxResult.set(null);
            queryAiSummary.set(null); // Reset query summary on error
        } finally {
            isLoading = false;
        }
    }

    // Reactive statement to fetch results when the URL query parameter changes
    $: {
        const queryParam = $page.url.searchParams.get('i');
        const typeParam = $page.url.searchParams.get('t') || 'web'; 
        if (queryParam !== searchQuery || typeParam !== activeSearchType) {
            searchQuery = queryParam || '';
            activeSearchType = typeParam;
            inputQuery = searchQuery; 
            fetchSearchResults(searchQuery, activeSearchType);
        }
    }
    
    function handleSearchSubmit(type = activeSearchType) {
        if (!inputQuery.trim()) return;
        goto(`/search?i=${encodeURIComponent(inputQuery.trim())}&t=${type}`);
    }
    
     function handleKeyPress(event) {
        if (event.key === 'Enter') {
            handleSearchSubmit();
        }
    }

    function changeSearchType(newType) {
         if (newType !== activeSearchType) {
             handleSearchSubmit(newType); 
        }
    }

    function getDomain(url) {
        if (!url) return '';
        try {
             if (!url.startsWith('http://') && !url.startsWith('https://')) {
                if (url.includes('.')) {
                     return url.replace(/^www\./, '');
                }
                 return url; 
            }
            return new URL(url).hostname.replace(/^www\./, '');
        } catch (e) {
            console.warn(`[Frontend] Failed to parse domain from URL: ${url}`, e);
            return url; 
        }
    }

    function toggleSidebar() {
		isSidebarOpen.update(open => !open);
	}

    function formatDuration(duration) {
        // This function might be redundant if backend formats it, 
        // but keep it for now in case backend format changes or fails.
        if (!duration || !duration.startsWith('PT')) return duration; // Return original if not expected format
        try {
            let time = duration.substring(2); 
            let hours = '';
            let minutes = '0';
            let seconds = '0';
            if (time.includes('H')) [hours, time] = time.split('H');
            if (time.includes('M')) [minutes, time] = time.split('M');
            if (time.includes('S')) seconds = time.split('S')[0];
            seconds = seconds.padStart(2, '0');
            minutes = minutes.padStart(2, '0');
            return hours ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
        } catch (e) { return duration; } // Return original on error
    }

     function formatAge(ageString) {
         // Keep this simple helper as backend just passes the string for now
         return ageString || '';
	}

</script>

<svelte:head>
    <title>{searchQuery ? `${searchQuery} - Artado Search` : 'Artado Search'}</title>
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
                placeholder="{$t('searchPlaceholder')}" 
                aria-label="Arama"
                class="search-input-header"
            />
             {#if inputQuery}
                <button 
                    class="clear-button-header" 
                    on:click={() => { inputQuery = ''; document.querySelector('.search-input-header')?.focus(); }} 
                    aria-label="Aramayı temizle"
                >
                    <i class="fas fa-times"></i>
                </button>
            {/if}
             <button class="search-button-header" on:click={() => handleSearchSubmit()} aria-label="Ara">
                <i class="fas fa-search"></i>
            </button>
        </div>
         <div class="header-actions">
             <button class="icon-button settings-button-header" aria-label="{$t('settings')}" on:click={toggleSidebar}>
                 <i class="fas fa-sliders-h"></i>
             </button>
        </div>
    </header>

    <!-- Search Type Tabs -->
     <nav class="search-type-nav" aria-label="Arama türleri">
         <div class="search-type-nav-inner">
             <button class:active={activeSearchType === 'web'} on:click={() => changeSearchType('web')}>
                 <i class="fas fa-search" aria-hidden="true"></i> {$t('all')}
             </button>
             <button class:active={activeSearchType === 'images'} on:click={() => changeSearchType('images')}>
                 <i class="fas fa-image" aria-hidden="true"></i> {$t('images')}
             </button>
             <button class:active={activeSearchType === 'videos'} on:click={() => changeSearchType('videos')}>
                  <i class="fas fa-video" aria-hidden="true"></i> {$t('videos')}
             </button>
             <!-- Add more types like News if needed -->
         </div>
     </nav>


    <div class="main-content-area"> 
        <main class="results-container" aria-live="polite">
        {#if isLoading}
            <div class="loading-indicator">
                    <i class="fas fa-spinner fa-spin fa-2x" aria-hidden="true"></i> Loading...
                </div>
            {:else if $error}
                <div class="error-message" role="alert">
                    <i class="fas fa-exclamation-triangle" aria-hidden="true"></i> Sonuçlar yüklenirken hata oluştu: {$error}
                </div>
            
            <!-- === WEB RESULTS === -->
            {:else if activeSearchType === 'web'}
                <!-- === AI Query Summary Box (Only shown if enabled) === -->
                {#if $aiSummaryEnabled}
                    {#if $queryAiSummary && $queryAiSummary !== 'AI_ERROR'}
                        <div class="ai-query-summary-box result-item-card enhanced-ai-box">
                            <div class="ai-box-header">
                                <i class="fas fa-brain ai-icon"></i>
                                <span class="ai-box-title">AI Özeti</span>
                            </div>
                             <p class="ai-summary">
                                {@html $queryAiSummary} 
                            </p>
                        </div>
                    {:else if $queryAiSummary === 'AI_ERROR'}
                        <div class="ai-query-summary-box result-item-card enhanced-ai-box error-ai-box">
                             <div class="ai-box-header">
                                <i class="fas fa-exclamation-triangle ai-icon"></i>
                                <span class="ai-box-title">AI Hatası</span>
            </div>
                             <p class="ai-error">
                                AI sorgu özeti alınamadı.
                            </p>
            </div>
                    {/if}
                {/if}

                {#if $searchResults.length > 0}
                    <div class="results-list web-results">
                {#each $searchResults as result (result.url)}
                    <div class="result-item-card">
                         <div class="result-header">
                             <img 
                                src={result.icon || '/favicon.ico'} 
                                alt="" 
                                class="favicon" 
                                        loading="lazy"
                                        on:error={(e) => { e.target.style.visibility = 'hidden'; }} 
                             /> 
                            <span class="result-domain">{getDomain(result.url)}</span>
                                    {#if result.age}
                                        <span class="result-age"> - {formatAge(result.age)}</span>
                                    {/if}
                            <button class="more-options" aria-label="Daha fazla seçenek">
                                        <i class="fas fa-ellipsis-v" aria-hidden="true"></i>
                            </button>
                         </div>
                        <h3 class="result-title">
                            <a href={result.url} target="_blank" rel="noopener noreferrer">{result.title}</a>
                        </h3>
                                <p class="result-description">{@html result.description || 'Açıklama yok.'}</p>
                                
                    </div>
                {/each}
            </div>
             <p class="results-count">Yaklaşık {$searchResults.length} sonuç bulundu.</p>
        {:else if searchQuery}
             <div class="no-results">
                         <p>"<strong>{searchQuery}</strong>" için web sonucu bulunamadı.</p>
                     </div>
                 {/if}

            <!-- === IMAGE RESULTS === -->
             {:else if activeSearchType === 'images'}
                 {#if $searchResults.length > 0}
                    <div class="results-grid image-results">
                        {#each $searchResults as result, i (result.thumbnail + i)} 
                            <a href={result.url} target="_blank" rel="noopener noreferrer" class="image-result-item">
                                <img src={result.thumbnail} alt={result.title || 'Görsel'} loading="lazy" 
                                    on:error={(e) => { e.target.style.display='none'; e.target.parentElement.classList.add('no-image'); }}/>
                                <div class="image-info">
                                    <span class="image-title">{result.title}</span>
                                    <span class="image-source">{getDomain(result.source)}</span>
                                </div>
                            </a>
                        {/each}
                    </div>
                    <p class="results-count">{$searchResults.length} görsel bulundu.</p>
                {:else if searchQuery}
                     <div class="no-results">
                         <p>' {searchQuery} ' için Görsel sonucu bulunamadı.</p>
                     </div>
                 {/if}

             <!-- === VIDEO RESULTS === -->
             {:else if activeSearchType === 'videos'}
                 {#if $searchResults.length > 0}
                    <div class="results-list video-results">
                        {#each $searchResults as result (result.url)}
                            <div class="result-item-card video-item-card">
                                <div class="video-thumbnail-container">
                                    <a href={result.url} target="_blank" rel="noopener noreferrer" aria-label={result.title}>
                                        <img src={result.thumbnail} alt="" class="video-thumbnail" loading="lazy"
                                            on:error={(e) => { e.target.style.visibility = 'hidden'; }}/>
                                        {#if result.duration}
                                            <span class="video-duration">{formatDuration(result.duration)}</span>
                                        {/if}
                                    </a>
                                </div>
                                <div class="video-details">
                                    <h3 class="result-title video-title">
                                        <a href={result.url} target="_blank" rel="noopener noreferrer">{result.title}</a>
                                    </h3>
                                    <div class="video-meta">
                                        {#if result.publisher}
                                            <span class="video-publisher">{result.publisher}</span>
                                        {/if}
                                        {#if result.age}
                                            <span class="video-age">{formatAge(result.age)}</span>
                                        {/if}
                                    </div>
                                    <p class="result-description video-description">{result.description || 'Açıklama yok.'}</p>
                                </div>
                            </div>
                        {/each}
                    </div>
                    <p class="results-count">{$searchResults.length} video bulundu.</p>
                 {:else if searchQuery}
                     <div class="no-results">
                         <p>' {searchQuery} ' için Video sonucu bulunamadı.</p>
             </div>
                 {/if}
             
            <!-- Fallback for other types or initial state -->
             {:else if !isLoading && !$error && !searchQuery}
             <div class="no-results">
                <p>Arama yapmak için yukarıdaki kutuyu kullanın.</p>
             </div>
             {:else if !isLoading && !$error}
                 <div class="no-results">
                     <p>' {searchQuery} ' için ({activeSearchType}) sonucu bulunamadı veya bu tür desteklenmiyor.</p>
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
                             {$infoBoxResult.wikipediaInfo.title || 'Wikipedia'}
                         </h4>
                         {#if $infoBoxResult.wikipediaInfo.thumbnail}
                            <img src={$infoBoxResult.wikipediaInfo.thumbnail} alt="{$infoBoxResult.wikipediaInfo.title || ''}" class="infobox-image"
                                loading="lazy" on:error={(e) => { e.target.style.display='none'; }}/>
                         {/if}
                         {#if $infoBoxResult.wikipediaInfo.extract}
                            <p class="wiki-extract">{$infoBoxResult.wikipediaInfo.extract}</p>
                         {/if}
                         {#if $infoBoxResult.wikipediaInfo.url}
                            <a href={$infoBoxResult.wikipediaInfo.url} target="_blank" rel="noopener noreferrer" class="wiki-link">
                                <i class="fas fa-external-link-alt"></i> Wikipedia'da devamını oku
                            </a>
                         {/if}
                     </div>
                 {/if}
                 
                 <!-- Diğer Infobox Tipleri (Sadece Wikipedia yoksa gösterilir) -->
                 {#if !$infoBoxResult.wikipediaInfo}
                     {#if $infoBoxResult.type === 'calculator'}
                        <div class="infobox-card calculator-box">
                            <h4>Hesap Makinesi</h4>
                            <p class="calc-query">{$infoBoxResult.query}</p>
                            <p class="calc-result">= {$infoBoxResult.result}</p>
                        </div>
                     {:else if $infoBoxResult.type === 'location' && $infoBoxResult.data}
                         <div class="infobox-card location-box">
                             <h4>{$infoBoxResult.data.name || 'Konum Bilgisi'}</h4>
                             {#if $infoBoxResult.data.profile?.img}
                                <img src={$infoBoxResult.data.profile.img} alt="{$infoBoxResult.data.name || ''}" class="infobox-image"
                                    loading="lazy" on:error={(e) => { e.target.style.display='none'; }}/>
                             {/if}
                             {#if $infoBoxResult.data.description}
                                <p>{$infoBoxResult.data.description}</p>
                             {/if}
                             {#if $infoBoxResult.data.address?.streetAddress}
                                 <p class="address">{$infoBoxResult.data.address.streetAddress}, {$infoBoxResult.data.address.addressLocality || ''}</p>
                             {/if}
                             {#if $infoBoxResult.data.url}
                                <a href={$infoBoxResult.data.url} target="_blank" rel="noopener noreferrer">Daha fazla bilgi</a>
                             {/if}
                         </div>
                     {:else if $infoBoxResult.type === 'generic_infobox'} 
                         <div class="infobox-card">
                             <h4>{$infoBoxResult.title || 'Bilgi Kutusu'}</h4>
                             {#if $infoBoxResult.profile?.img}
                                <img src={$infoBoxResult.profile.img} alt="{$infoBoxResult.title || ''}" class="infobox-image"
                                    loading="lazy" on:error={(e) => { e.target.style.display='none'; }}/>
                             {/if}
                             {#if $infoBoxResult.description}
                                <p>{$infoBoxResult.description}</p>
                             {/if}
                             {#if $infoBoxResult.url}
                                <a href={$infoBoxResult.url} target="_blank" rel="noopener noreferrer">Daha fazla bilgi</a>
                             {/if}
                         </div>
                     {:else}
                          <!-- Fallback for other known/unknown infobox types -->
                         <div class="infobox-card">
                             <h4>{$infoBoxResult.type || 'Bilgi'}</h4>
                             {#if $infoBoxResult.title}<p><strong>{$infoBoxResult.title}</strong></p>{/if}
                             {#if $infoBoxResult.description}<p>{$infoBoxResult.description}</p>{/if}
                             {#if $infoBoxResult.url}<a href={$infoBoxResult.url} target="_blank" rel="noopener noreferrer">Daha fazla bilgi</a>{/if}
                         </div>
                     {/if}
                 {/if} <!-- End of check for !$infoBoxResult.wikipediaInfo -->
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
     .logo-link { flex-shrink: 0; display: flex; align-items: center; }
     .header-logo { height: 30px; width: auto; }

    .search-bar-container {
        flex-grow: 1;
        display: flex;
        align-items: center;
        background-color: var(--input-background);
        border-radius: 25px;
        border: 1px solid var(--border-color);
        padding: 0 0.5rem 0 1rem;
        max-width: 700px; 
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        transition: border-color 0.2s, box-shadow 0.2s;
    }
     .search-bar-container:focus-within {
        border-color: var(--primary-color);
         box-shadow: 0 0 0 1px var(--primary-color), 0 2px 5px rgba(0,0,0,0.08); /* Enhanced focus */
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
        background: none; border: none;
        color: var(--text-color-secondary);
        cursor: pointer; font-size: 1.1rem;
        padding: 0 0.5rem; line-height: 1; 
     }
      .clear-button-header:hover { color: var(--text-color); }

    .search-button-header {
        background: none; border: none;
        color: var(--primary-color); 
        cursor: pointer; font-size: 1.1rem;
        padding: 0 0.8rem 0 0.3rem; margin-left: 0.2rem;
        line-height: 1; 
    }
     .search-button-header:hover { opacity: 0.8; }

    .header-actions {
        margin-left: auto;
        flex-shrink: 0; 
    }
     .icon-button { /* Settings button */
        background: none; border: none;
         color: var(--text-color-secondary);
        cursor: pointer; font-size: 1.2rem;
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
        background: none; border: none;
        color: var(--text-color-secondary);
        cursor: pointer; padding: 0.8rem 0.2rem; /* Keep vertical padding */
        font-size: 0.95rem;
        border-bottom: 3px solid transparent; /* Thicker transparent border for spacing */
        transition: color 0.2s, border-color 0.2s;
        display: inline-flex; 
        align-items: center; gap: 0.4rem;
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
    @media (max-width: 1200px) { /* Adjust alignment margin */
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
        .search-header, .search-type-nav {
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
          .search-button-header, .clear-button-header {
              font-size: 1rem; /* Adjust icon size */
          }
          .settings-button-header {
             font-size: 1.2rem; /* Adjust icon size */
             padding: 0.5rem;
          }

        .search-type-nav {
            top: calc(var(--header-height-small, 50px) + 1px); /* Adjust sticky top based on smaller header */
            gap: 0.8rem; /* Reduce gap */
            padding: 0 1rem 0.3rem 1rem; /* Add bottom padding for scrollbar */
            /* Add horizontal scroll */
            overflow-x: auto;
            white-space: nowrap; 
            /* Hide scrollbar visually if desired */
             -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
        }
         .search-type-nav::-webkit-scrollbar { /* Chrome, Safari, Opera */
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
    
    /* Image grid adjustments for smaller screens */
    @media (max-width: 600px) {
         .image-results {
             grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); /* Fewer/smaller columns */
             gap: 0.5rem;
         }
          .image-result-item img {
             height: 120px; /* Adjust height */
         }
    }
     @media (max-width: 400px) {
         .image-results {
             grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); /* Even smaller */
         }
          .image-result-item img {
             height: 100px; 
         }
     }

    /* Loading, Error, No Results States */
    .loading-indicator, .error-message, .no-results {
        text-align: center;
        margin-top: 3rem;
        padding: 1.5rem;
        color: var(--text-color-secondary);
        border-radius: 8px; 
        background-color: var(--card-background);
        border: 1px solid var(--border-color);
    }
    .loading-indicator i, .error-message i {
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

    /* Common Result Item Card */
    .result-item-card {
        background-color: var(--card-background);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 1rem 1.2rem; /* More horizontal padding */
        box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        transition: box-shadow 0.2s ease-in-out;
        overflow: hidden; /* Prevent content overflow */
    }
    .result-item-card:hover {
        box-shadow: 0 3px 6px rgba(0,0,0,0.06);
    }

    /* Web/Video Result List Layout */
    .results-list {
        display: flex;
        flex-direction: column;
        gap: 1rem; 
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
        width: 16px; height: 16px;
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
    .result-age, .video-age {
        font-size: 0.8rem;
        color: var(--text-color-secondary);
        flex-shrink: 0;
        white-space: nowrap;
    }
     .more-options {
        background: none; border: none;
         color: var(--text-color-secondary);
        cursor: pointer; font-size: 1rem;
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

    /* Result Title (Web/Video) */
    .result-title {
        font-size: 1.2rem; /* Slightly larger title */
        margin-bottom: 0.3rem;
        margin-top: 0;
        line-height: 1.3;
    }
    .result-title a {
        color: var(--link-color);
        text-decoration: none;
        font-weight: 400; /* Standard weight like Google */
        word-break: break-word; 
    }
    .result-title a:hover { text-decoration: underline; }
    .result-title a:visited { color: var(--link-visited-color); }

    /* Result Description (Web/Video) */
    .result-description {
        font-size: 0.9rem;
        color: var(--text-color-secondary);
        line-height: 1.5;
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
       border-color: rgba(var(--primary-color-rgb), 0.3); /* Border color for summary */
   }
    .ai-query-summary-box .ai-error {
        border-color: rgba(var(--danger-color-rgb, 220, 53, 69), 0.3); /* Border color for error */
    }
    .ai-query-summary-box .ai-icon { margin-top: 0.1em; } /* Slightly adjust icon */

    /* --- Enhanced AI Query Summary Box Styles --- */
     .ai-query-summary-box.enhanced-ai-box {
        margin-bottom: 1.5rem; 
        padding: 1rem; /* Add padding inside the box */
        border-radius: 8px; /* Slightly more rounded corners */
        border: 1px solid rgba(var(--primary-color-rgb), 0.2);
        background-color: rgba(var(--primary-color-rgb), 0.05); /* Light primary background */
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

    /* Results Count */
    .results-count {
        text-align: center;
        font-size: 0.85rem;
        color: var(--text-color-secondary);
        margin-top: 2rem;
        margin-bottom: 1rem;
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
        transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
    }
     .image-result-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.08);
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
      .video-thumbnail-container a { display: block; }
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
         box-shadow: 0 1px 3px rgba(0,0,0,0.05);
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
       .infobox-card a:hover { text-decoration: underline; }
       
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
</style>