<script lang="js">
  import { getContext, onMount, setContext } from 'svelte';
  import { writable } from 'svelte/store';
  import { browser } from '$app/environment'; // Import browser check
  import { t } from '$lib/i18n.js'; // Import translation function

  // --- Import Stores ---
  import { 
      selectedTheme, 
      customCssStore, 
      aiSummaryEnabled, 
      isSidebarOpen,
      selectedLanguage, // Import new store
      selectedEngine // Import new store
  } from '$lib/stores.js';

  // Get global theme store (redundant if imported directly?)
  // const selectedTheme = getContext('theme');

  // REMOVED: Local definitions, now imported from stores.js
  // const customCssStore = writable(browser ? localStorage.getItem('customCSS') || '' : '');
  // let customCss = $customCssStore; 
  // let settingsTheme = $selectedTheme;

  // Settings state (local to this component for now)
  let safeSearch = true; // Keep local or move to store?
  let notifications = false; // Keep local or move to store?
  let activeTab = 'Temel Ayarlar'; // Default active tab

  const tabs = [
    'Temel Ayarlar',
    'Temalar',
    'Özel CSS', 
    'Eklentiler',
    'Profiller',
    'Proxy',
    'Reklamlar'
  ];

  // --- Theme Handling --- 
  // No need for local settingsTheme copy if binding directly to store
  // Use the imported store directly in the template

  // --- Custom CSS Handling --- 
  // Use the imported store directly in the template
  // Apply function simplified
  function applyCustomCss(css) {
      customCssStore.set(css); 
      // localStorage update is handled by the store itself
  }

  // REMOVED: Redundant reactive statements
  // $: settingsTheme = $selectedTheme;
  // $: customCss = $customCssStore;

  // Provide a local context (might be unnecessary if children use global store)
  // setContext('settings-theme', writable(settingsTheme)); // Redundant?

  // --- Workshop Items --- (Keep as is)
  let themes = writable([]);
  let plugins = writable([]);
  let workshopError = writable(null);
  let isLoadingWorkshop = writable(true);

  async function fetchWorkshopItems() {
       isLoadingWorkshop.set(true);
        workshopError.set(null);
        try {
            const response = await fetch('/api/workshop/items');
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { error: `API isteği başarısız: ${response.status}` };
                }
                 throw new Error(errorData.error || `API isteği başarısız: ${response.status}`);
            }
            const data = await response.json();
            themes.set(data.themes || []);
            plugins.set(data.plugins || []);
            if (!data.themes && !data.plugins && response.status === 200) {
                 workshopError.set("Workshop yolu yapılandırılmamış veya öğe bulunamadı.");
             }
        } catch (err) {
            console.error("Workshop öğeleri alınırken hata:", err);
            workshopError.set(err.message);
            themes.set([]);
            plugins.set([]);
        } finally {
            isLoadingWorkshop.set(false);
        }
  }

  // --- Lifecycle and Helpers --- 
  onMount(() => {
    // Apply custom CSS (moved from layout, only needed here?)
      let styleElement = document.getElementById('custom-user-css');
      if (browser) {
          if (!styleElement) {
              styleElement = document.createElement('style');
              styleElement.id = 'custom-user-css';
              document.head.appendChild(styleElement);
          }
           styleElement.textContent = $customCssStore;
          const unsubscribeCss = customCssStore.subscribe(value => {
              if (styleElement) styleElement.textContent = value;
          });
          
          // Fetch workshop items
          fetchWorkshopItems(); 

          document.body.classList.add('settings-active');

          return () => {
              unsubscribeCss();
              // Optionally remove style tag or CSS class
              document.body.classList.remove('settings-active');
          };
      } else {
          // Fetch workshop items on server if needed, or handle differently
          fetchWorkshopItems(); 
      }
  });

	// REMOVED: toggleSetting function is generic, direct binding is simpler

  function toggleSidebar() {
		isSidebarOpen.update(open => !open);
	}

  // Helper function to format theme names for display (copied from layout)
  function formatThemeName(kebabCaseName) {
        if (!kebabCaseName) return '';
        return kebabCaseName
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

</script>

<svelte:head>
	<title>{$t('settings')} - Stelve</title>
</svelte:head>

<div class="settings-page">
  
  <header class="settings-header">
       <button class="icon-button sidebar-toggle-settings" on:click={toggleSidebar} aria-label="Menüyü aç/kapat">
             <i class="fas fa-bars"></i>
        </button>
       <h1>{$t('settings')}</h1>
       <!-- Placeholder -->
   </header>

   <div class="settings-content-wrapper">
    <aside class="settings-sidebar">
           <nav aria-label="Ayarlar Menüsü">
               <ul>
                   {#each tabs as tab (tab)}
                       <li>
        <button
          class:active={activeTab === tab}
          on:click={() => activeTab = tab}
                               aria-current={activeTab === tab ? 'page' : undefined}
                           >
                               <!-- Translate tab names if keys exist -->
                               {tab === 'Temel Ayarlar' ? $t('basicSettings') : 
                                 tab === 'Temalar' ? $t('themes') : 
                                 tab === 'Eklentiler' ? $t('plugins') : 
                                 tab}
        </button>
                       </li>
      {/each}
               </ul>
           </nav>
    </aside>

       <main class="settings-main-content">
      {#if activeTab === 'Temel Ayarlar'}
               <section id="temel-ayarlar" aria-labelledby="temel-ayarlar-baslik">
                   <h2 id="temel-ayarlar-baslik">{$t('basicSettings')}</h2>

          <div class="setting-group">
            <h3>{$t('language')}</h3>
            <p>Artado Search'ü kullandığınız dili değiştirin.</p>
             <div class="select-wrapper">
                           <select bind:value={$selectedLanguage} aria-label="{$t('language')}">
                <option value="tr">Türkçe</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                               <!-- Add more languages -->
              </select>
                           <i class="fas fa-chevron-down dropdown-icon" aria-hidden="true"></i>
            </div>
          </div>

          <div class="setting-group">
            <h3>{$t('searchEngine')}</h3>
            <p>Aramalarınızda kullanılacak varsayılan arama motorunu seçin.</p>
             <div class="select-wrapper">
                           <select bind:value={$selectedEngine} aria-label="Arama Motoru Seçimi">
                               <option value="Brave">Brave Search</option>
                <option value="DuckDuckGo">DuckDuckGo</option>
                               <option disabled>Google (Yakında)</option> 
                               <option disabled>Bing (Yakında)</option>
              </select>
                           <i class="fas fa-chevron-down dropdown-icon" aria-hidden="true"></i>
            </div>
          </div>

          <div class="setting-group toggle-group">
            <div>
              <h3>Güvenli Arama</h3>
              <p>Uygunsuz içeriği arama sonuçlarından filtreleyin.</p>
            </div>
                       <label class="switch" aria-label="Güvenli Arama">
              <input type="checkbox" bind:checked={safeSearch}>
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-group toggle-group">
            <div>
              <h3>AI Özetini Göster</h3>
              <p>Arama sonuçları sayfasının üst kısmında AI tarafından oluşturulan özeti göster.</p>
            </div>
                       <label class="switch" aria-label="AI Özeti Gösterimi">
              <input type="checkbox" bind:checked={$aiSummaryEnabled}>
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-group toggle-group">
            <div>
              <h3>Bildirimler</h3>
                           <p>Uygulama güncellemeleri ve diğer bildirimler hakkında bilgi alın.</p>
            </div>
                       <label class="switch" aria-label="Bildirimler">
              <input type="checkbox" bind:checked={notifications}>
              <span class="slider"></span>
            </label>
          </div>

        </section>
      {:else if activeTab === 'Temalar'}
                <section id="temalar" aria-labelledby="temalar-baslik">
                   <h2 id="temalar-baslik">{$t('themes')}</h2>
            <p>Artado Search görünümünü kişiselleştirin.</p>
                    <div class="theme-options">
                         <button class:active={$selectedTheme === 'klasik'} on:click={() => selectedTheme.set('klasik')} aria-pressed={$selectedTheme === 'klasik'}>{formatThemeName('klasik')}</button>
                         <button class:active={$selectedTheme === 'koyu'} on:click={() => selectedTheme.set('koyu')} aria-pressed={$selectedTheme === 'koyu'}>{formatThemeName('koyu')}</button>
                         <button class:active={$selectedTheme === 'mavi'} on:click={() => selectedTheme.set('mavi')} aria-pressed={$selectedTheme === 'mavi'}>{formatThemeName('mavi')}</button>
                         <button class:active={$selectedTheme === 'pastel'} on:click={() => selectedTheme.set('pastel')} aria-pressed={$selectedTheme === 'pastel'}>{formatThemeName('pastel')}</button>
                         <button class:active={$selectedTheme === 'doga'} on:click={() => selectedTheme.set('doga')} aria-pressed={$selectedTheme === 'doga'}>{formatThemeName('doga')}</button>
                         <button class:active={$selectedTheme === 'terminal'} on:click={() => selectedTheme.set('terminal')} aria-pressed={$selectedTheme === 'terminal'}>{formatThemeName('terminal')}</button>
                         <button class:active={$selectedTheme === 'gece-yarisi'} on:click={() => selectedTheme.set('gece-yarisi')} aria-pressed={$selectedTheme === 'gece-yarisi'}>{formatThemeName('gece-yarisi')}</button>
                         <button class:active={$selectedTheme === 'gunesli'} on:click={() => selectedTheme.set('gunesli')} aria-pressed={$selectedTheme === 'gunesli'}>{formatThemeName('gunesli')}</button>
                         <button class:active={$selectedTheme === 'retro'} on:click={() => selectedTheme.set('retro')} aria-pressed={$selectedTheme === 'retro'}>{formatThemeName('retro')}</button>
                         <button class:active={$selectedTheme === 'komur'} on:click={() => selectedTheme.set('komur')} aria-pressed={$selectedTheme === 'komur'}>{formatThemeName('komur')}</button>
                         <button class:active={$selectedTheme === 'okyanus'} on:click={() => selectedTheme.set('okyanus')} aria-pressed={$selectedTheme === 'okyanus'}>{formatThemeName('okyanus')}</button>
             </div>
               </section>
            {:else if activeTab === 'Özel CSS'}
                 <section id="ozel-css" aria-labelledby="ozel-css-baslik">
                    <h2 id="ozel-css-baslik">Özel CSS</h2>
                    <p>
                        Buraya kendi özel CSS kodlarınızı ekleyerek uygulamanın görünümünü 
                        daha da kişiselleştirebilirsiniz. Değişiklikler anında uygulanacaktır.
                        <strong>Dikkat:</strong> Hatalı CSS kodu sayfa düzenini bozabilir.
                    </p>
                    <div class="setting-group">
                         <h3>Özel Stil Kodları</h3>
                         <textarea 
                             bind:value={$customCssStore} 
                             on:input={(e) => applyCustomCss(e.target.value)}
                             rows="15"
                             placeholder="/* Örneğin: body &#123; font-family: sans-serif; &#125; */"
                             aria-label="Özel CSS Kodu"
                             class="custom-css-textarea"
                         ></textarea>
                         <button class="clear-css-button" on:click={() => applyCustomCss('')} disabled={!$customCssStore}>
                             Temizle
                         </button>
          </div>
        </section>
      {:else if activeTab === 'Eklentiler'}
               <!-- Workshop Section -->
    <section class="settings-section">
        <h2>Workshop Öğeleri</h2>

        {#if $isLoadingWorkshop}
            <p>Workshop öğeleri yükleniyor...</p>
        {:else if $workshopError}
            <p class="error-message">Hata: {$workshopError}</p>
        {:else}
            <!-- Themes -->
            <div class="workshop-subsection">
                <h3>Temalar</h3>
                {#if $themes.length > 0}
                    <ul class="workshop-list">
                        {#each $themes as theme (theme.id)}
                            <li class="workshop-item">
                                <div class="item-info">
                                    <span class="item-name">{theme.name} <span class="item-version">v{theme.version}</span></span>
                                    <p class="item-description">{theme.description}</p>
                                    <span class="item-author">Yazar: {theme.author}</span>
                                </div>
                                <button class="button button-secondary" disabled>Aktif Et (Yakında)</button> 
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <p>Harici workshop klasörünüzde hiç tema bulunamadı.</p>
                {/if}
            </div>

            <!-- Plugins -->
            <div class="workshop-subsection">
                <h3>Eklentiler</h3>
                 {#if $plugins.length > 0}
                    <ul class="workshop-list">
                        {#each $plugins as plugin (plugin.id)}
                             <li class="workshop-item">
                                <div class="item-info">
                                    <span class="item-name">{plugin.name} <span class="item-version">v{plugin.version}</span></span>
                                    <p class="item-description">{plugin.description}</p>
                                    <span class="item-author">Yazar: {plugin.author}</span>
                                </div>
                                <button class="button button-secondary" disabled>Aktif Et (Yakında)</button> 
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <p>Harici workshop klasörünüzde hiç eklenti bulunamadı.</p>
                {/if}
            </div>
        {/if}
        </section>
      {:else}
               <!-- Placeholder for other tabs -->
         <section>
           <h2>{activeTab}</h2>
                   <p>Bu bölüm yakında eklenecektir.</p>
                   <!-- Content for {activeTab} goes here -->
         </section>
      {/if}
       </main>
    </div>

</div>

<style>
    :global(body.settings-active) {
        /* Optional: Prevent body scroll when settings are open */
        /* overflow: hidden; */
    }
    /* Remove sidebar influence from parent layout if needed */
    :global(:host) {
        /* Reset styles possibly inherited from layout */
    }

  .settings-page {
        /* REMOVED fixed positioning styles */
        /* position: fixed; */
        /* top: 0; */
        /* left: 0; */
        /* z-index: 1100; */
        /* overflow-y: auto; */

        /* Let layout handle background and text color */
        /* background-color: var(--background-color); */
        /* color: var(--text-color); */
        
        /* Use standard page flow */
        display: flex;
        flex-direction: column;
        min-height: calc(100vh - var(--header-height, 60px)); /* Adjust based on actual header height */
        width: 100%; 
    }

    .settings-header {
        display: flex;
        align-items: center;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--border-color);
        background-color: var(--card-background); 
        flex-shrink: 0; /* Prevent header from shrinking */
        position: sticky; /* Make header sticky */
        top: 0; /* Stick to top */
        z-index: 1010; /* Above content, below main sidebar */
    }
    .settings-header h1 {
        margin: 0;
        font-size: 1.3rem;
        font-weight: 600;
        flex-grow: 1; /* Push title */
        text-align: center;
    }
    .back-link {
        color: var(--text-color);
        text-decoration: none;
        font-size: 1.2rem;
        padding: 0.5rem;
        margin-left: -0.5rem; /* Align icon better */
        border-radius: 50%;
        transition: background-color 0.2s;
    }
    .back-link:hover {
        background-color: var(--hover-background);
    }

    .settings-content-wrapper {
        display: flex;
        flex-grow: 1; /* Take remaining height */
        max-width: 1200px; /* Max width for content */
        width: 100%;
        /* Remove auto margins to align left within the page padding */
        margin-left: 0;
        margin-right: 0; 
        padding: 1rem 0; /* Reduce top/bottom padding if header is sticky */
    gap: 2.5rem;
  }

  .settings-sidebar {
        width: 220px; /* Fixed width sidebar */
        flex-shrink: 0;
    border-right: 1px solid var(--border-color);
        padding-right: 1.5rem;
    }
    .settings-sidebar nav ul {
        list-style: none;
        padding: 0;
        margin: 0;
        position: sticky;
        top: 1.5rem; /* Sticky relative to padding */
    }
    .settings-sidebar nav li {
    margin-bottom: 0.5rem;
    }
    .settings-sidebar nav button {
        background: none;
    border: none;
    color: var(--text-color-secondary);
    cursor: pointer;
        padding: 0.6rem 1rem;
    font-size: 0.95rem;
        width: 100%;
        text-align: left;
        border-radius: 6px;
    transition: background-color 0.2s, color 0.2s;
  }
    .settings-sidebar nav button:hover {
    background-color: var(--hover-background);
    color: var(--text-color);
  }
    .settings-sidebar nav button.active {
        background-color: var(--primary-light-background, rgba(var(--primary-color-rgb), 0.1));
    color: var(--primary-color);
        font-weight: 600;
    }

    .settings-main-content {
        flex-grow: 1; /* Take remaining width */
        min-width: 0; /* Allow shrinking */
    }
    .settings-main-content section {
        /* Add some bottom margin to sections */
    margin-bottom: 2.5rem;
  }
    .settings-main-content h2 {
        margin-top: 0;
        margin-bottom: 1.5rem;
        font-size: 1.5rem;
        font-weight: 600;
    border-bottom: 1px solid var(--border-color);
        padding-bottom: 0.8rem;
    }
    .settings-main-content h3 {
        margin-top: 0;
        margin-bottom: 0.3rem;
    font-size: 1.1rem;
    font-weight: 500;
  }
    .settings-main-content p {
        font-size: 0.9rem;
    color: var(--text-color-secondary);
        margin-top: 0;
        margin-bottom: 1rem;
        max-width: 600px; /* Limit description width */
    }

    .setting-group {
        margin-bottom: 2rem;
        padding-bottom: 1.5rem;
        border-bottom: 1px solid var(--divider-color, var(--border-color));
    }
     .setting-group:last-child {
         border-bottom: none;
      margin-bottom: 0;
         padding-bottom: 0;
  }

    /* Select dropdown styles */
  .select-wrapper {
    position: relative;
        display: inline-block; /* Fit content */
        max-width: 300px; /* Limit width */
        width: 100%;
  }
    .select-wrapper select {
    width: 100%;
        padding: 0.7rem 2.5rem 0.7rem 1rem; /* Space for icon */
    border: 1px solid var(--border-color);
        border-radius: 6px;
    background-color: var(--input-background);
    color: var(--text-color);
        font-size: 0.95rem;
        appearance: none; /* Remove default arrow */
    cursor: pointer;
        transition: border-color 0.2s;
    }
    .select-wrapper select:focus {
      outline: none;
      border-color: var(--primary-color);
        box-shadow: 0 0 0 1px var(--primary-color);
    }
     .select-wrapper select option[disabled] {
         color: var(--text-color-disabled);
  }
    .select-wrapper .dropdown-icon {
    position: absolute;
        right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-color-secondary);
        pointer-events: none; /* Allow clicking the select */
    }

    /* Toggle Switch styles */
    .toggle-group {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .toggle-group div { /* Container for title and description */
         margin-right: 1rem; /* Space before the toggle */
    }
    .toggle-group p {
        margin-bottom: 0; /* Remove bottom margin for description */
    }

  .switch {
    position: relative;
    display: inline-block;
    width: 50px; /* Smaller switch */
        height: 26px;
        flex-shrink: 0;
  }
  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  .slider {
    position: absolute;
    cursor: pointer;
        top: 0; left: 0; right: 0; bottom: 0;
        background-color: var(--toggle-background, #ccc);
        transition: .3s;
        border-radius: 26px;
    }
  .slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
        left: 3px;
        bottom: 3px;
    background-color: white;
        transition: .3s;
    border-radius: 50%;
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
  }
  input:checked + .slider {
    background-color: var(--primary-color);
  }
    input:checked + .slider:before {
        transform: translateX(24px); /* (Width - Height) + left = (50-26)+3 */
    }
    input:focus + .slider {
         box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.3);
    }
    
     /* Custom CSS Textarea - ADDED */
    .custom-css-textarea {
        width: 100%;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 0.8rem 1rem;
        font-family: monospace;
        font-size: 0.9rem;
        background-color: var(--input-background);
        color: var(--text-color);
        resize: vertical; /* Allow vertical resize */
        min-height: 200px;
        margin-bottom: 0.5rem;
        transition: border-color 0.2s, box-shadow 0.2s;
    }
    .custom-css-textarea:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 1px var(--primary-color);
    }
    .clear-css-button {
        padding: 0.5rem 1rem;
        background-color: var(--input-background);
        border: 1px solid var(--border-color);
        color: var(--text-color-secondary);
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s, color 0.2s;
        font-size: 0.85rem;
    }
    .clear-css-button:hover:not([disabled]) {
        background-color: var(--hover-background);
        border-color: var(--text-color-secondary);
        color: var(--text-color);
    }
     .clear-css-button:disabled {
         opacity: 0.6;
         cursor: not-allowed;
     }

    /* Theme options styling */
    .theme-options {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
    }
    .theme-options button {
        padding: 0.8rem 1.5rem;
        border: 1px solid var(--border-color);
        background-color: var(--input-background);
        color: var(--text-color);
        border-radius: 6px;
        cursor: pointer;
        transition: background-color 0.2s, border-color 0.2s, color 0.2s;
    }
    .theme-options button:hover {
        border-color: var(--primary-color);
        background-color: var(--hover-background);
    }
    .theme-options button.active {
        background-color: var(--primary-color);
        color: white; /* Or a specific contrast color */
        border-color: var(--primary-color);
        font-weight: 600;
    }
    
    /* Responsive adjustments for settings page */
    @media (max-width: 1200px) { /* Apply padding change when max-width is hit */
         .settings-content-wrapper {
             padding: 2rem 1.5rem; /* Reduce side padding slightly */
         }
    }
    @media (max-width: 1024px) {
         .settings-content-wrapper {
            /* max-width: 95%; Remove this if we want edge-to-edge */
            padding: 1.5rem;
            gap: 2rem;
        }
    }
    @media (max-width: 768px) {
        .settings-content-wrapper {
            flex-direction: column;
            padding: 1rem;
            gap: 1.5rem;
             /* max-width: 100%; This is default */
        }
        .settings-sidebar {
            width: 100%;
            border-right: none;
            border-bottom: 1px solid var(--border-color);
            padding-right: 0;
            padding-bottom: 1rem;
        }
        .settings-sidebar nav ul {
            position: static; /* Remove sticky */
            display: flex; /* Horizontal scroll for tabs? */
            overflow-x: auto;
            padding-bottom: 0.5rem; /* Space for scrollbar */
        }
         .settings-sidebar nav li {
             margin-bottom: 0;
             margin-right: 0.5rem; /* Space between horizontal tabs */
             flex-shrink: 0;
         }
         .settings-sidebar nav button {
             padding: 0.5rem 0.8rem;
             white-space: nowrap;
         }
        .settings-main-content h2 {
            font-size: 1.3rem;
            margin-bottom: 1rem;
            padding-bottom: 0.6rem;
        }
        .toggle-group {
            /* Stack vertically if needed */
            /* flex-direction: column; */
            /* align-items: flex-start; */
        }
  }

    .settings-container {
        max-width: 800px;
        margin: 2rem auto;
    }

    .page-padding {
        padding: 1rem 2rem;
    }

    h1 {
        margin-bottom: 2rem;
        color: var(--text-primary-color);
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 0.5rem;
    }

    h2 {
        margin-top: 2rem;
        margin-bottom: 1rem;
        color: var(--text-secondary-color);
    }

    .settings-section {
        margin-bottom: 2rem;
    }

    .setting-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 0;
        border-bottom: 1px solid var(--border-color-soft);
    }

    .setting-item:last-child {
        border-bottom: none;
    }

    .setting-item label:first-child { /* Target the text label */
        flex-grow: 1;
        margin-right: 1rem;
    }

    .setting-description {
        font-size: 0.85rem;
        color: var(--text-muted-color);
        margin-top: 0.25rem;
    }

    /* Basic Toggle Switch Styles */
    .switch {
        position: relative;
        display: inline-block;
        width: 50px; /* Reduced width */
        height: 28px; /* Reduced height */
    }
    .switch input { 
        opacity: 0;
        width: 0;
        height: 0;
    }
    .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #ccc;
        transition: .4s;
    }
    .slider:before {
        position: absolute;
        content: "";
        height: 20px; /* Adjust size */
        width: 20px; /* Adjust size */
        left: 4px; /* Adjust position */
        bottom: 4px; /* Adjust position */
        background-color: white;
        transition: .4s;
    }
    input:checked + .slider {
        background-color: var(--primary-color);
    }
    input:focus + .slider {
        box-shadow: 0 0 1px var(--primary-color);
    }
    input:checked + .slider:before {
        transform: translateX(22px); /* Adjust movement */
    }
    .slider.round {
        border-radius: 28px;
    }
    .slider.round:before {
        border-radius: 50%;
    }

    hr.divider {
        border: none;
        border-top: 1px solid var(--border-color);
        margin: 2rem 0;
    }

    .error-message {
        color: var(--danger-color, #dc3545);
        background-color: rgba(var(--danger-color-rgb, 220, 53, 69), 0.1);
        padding: 0.75rem 1rem;
        border-radius: 4px;
        border: 1px solid rgba(var(--danger-color-rgb, 220, 53, 69), 0.3);
    }

    /* Workshop Styles */
    .workshop-subsection {
        margin-top: 1.5rem;
    }
    .workshop-subsection h3 {
        font-size: 1.1rem;
        color: var(--text-primary-color);
        margin-bottom: 0.75rem;
    }
    .workshop-list {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    .workshop-item {
        background-color: var(--card-background);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 1rem;
        margin-bottom: 1rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: box-shadow 0.2s ease-in-out;
    }
    .workshop-item:hover {
        box-shadow: 0 2px 5px rgba(0,0,0,0.07);
    }
    .item-info {
        flex-grow: 1;
        margin-right: 1rem;
    }
    .item-name {
        font-weight: 600;
        color: var(--text-primary-color);
    }
    .item-version {
        font-size: 0.8rem;
        color: var(--text-muted-color);
        margin-left: 0.5rem;
        background-color: var(--background-alt-color);
        padding: 0.1em 0.4em;
        border-radius: 4px;
    }
    .item-description {
        font-size: 0.9rem;
        color: var(--text-secondary-color);
        margin-top: 0.25rem;
        margin-bottom: 0.25rem;
    }
    .item-author {
        font-size: 0.8rem;
        color: var(--text-muted-color);
    }

    /* General Button Style */
    .button {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        transition: background-color 0.2s ease, box-shadow 0.2s ease;
    }
    .button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .button-primary {
        background-color: var(--primary-color);
        color: var(--button-text-color, #fff);
    }
    .button-primary:hover:not(:disabled) {
        background-color: var(--primary-color-dark);
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .button-secondary {
        background-color: var(--button-secondary-background, #e9ecef);
        color: var(--button-secondary-text, #495057);
        border: 1px solid var(--border-color);
    }
     .button-secondary:hover:not(:disabled) {
        background-color: var(--button-secondary-hover-background, #ced4da);
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .sidebar-toggle-settings { /* Style the new button */
         /* Inherits .icon-button styles potentially */
        font-size: 1.2rem;
        padding: 0.5rem;
        margin-right: 1rem; /* Space between button and title */
        color: var(--text-color);
    }
     .sidebar-toggle-settings:hover {
         background-color: var(--hover-background);
     }
</style> 