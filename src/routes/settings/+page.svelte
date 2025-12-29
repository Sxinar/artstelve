<script lang="js">
  import { getContext, onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { browser } from '$app/environment';
  import { t } from '$lib/i18n.js';
  import { fade, slide, fly } from 'svelte/transition';

  // --- Import Stores ---
  import { 
      selectedTheme, 
      customCssStore, 
      aiSummaryEnabled, 
      isSidebarOpen,
      selectedLanguage,
      selectedEngine,
      themeMode,
      uiDensity,
      fontScale,
      cornerRadius,
      accentColor,
      safeSearch,
      searchHomeDesign,
      blockedSites,
      showNavbarSubCategory
  } from '$lib/stores.js';

  let notifications = false;
  let activeTab = 'Temel Ayarlar'; 

  const tabs = [
    { id: 'Temel Ayarlar', icon: 'fas fa-sliders-h', label: 'basicSettings' },
    { id: 'Görünüm', icon: 'fas fa-paint-brush', label: 'appearance' },
    { id: 'Arayüz', icon: 'fas fa-desktop', label: 'interface' }, 
    { id: 'Temalar', icon: 'fas fa-palette', label: 'themes' },
    { id: 'Gelişmiş', icon: 'fas fa-tools', label: 'advanced' },
    { id: 'Eklentiler', icon: 'fas fa-puzzle-piece', label: 'plugins' },
    { id: 'Özel CSS', icon: 'fas fa-code', label: 'customCSS' }
  ];

  // --- Helper Functions ---
  function applyPresetCSS(preset) {
      const presets = {
          minimal: `
/* Minimal Theme */
.result-item-card { border: none; box-shadow: 0 1px 3px rgba(0,0,0,0.05); background: var(--card-background); }
.sidebar { backdrop-filter: none; background: var(--card-background); }`,
          glassmorphism: `
/* Glassmorphism Theme */
.result-item-card { background: rgba(255,255,255,0.1); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1); }
.sidebar { background: rgba(255,255,255,0.1); backdrop-filter: blur(12px); border-right: 1px solid rgba(255,255,255,0.1); }`,
          neon: `
/* Neon Theme */
.result-item-card { background: #000; border: 1px solid #0f0; box-shadow: 0 0 10px #0f0; color: #0f0; }
.result-title a { color: #0f0 !important; text-shadow: 0 0 5px #0f0; }`
      };
      if (presets[preset]) applyCustomCss(presets[preset]);
  }

  function applySidebarTheme(theme) {
      // Logic for sidebar themes could be implemented via direct store if supported, 
      // or injecting CSS (legacy). For now, we'll use a simplified version or skip if strict.
      // Keeping legacy logic for compatibility if used elsewhere.
      const themes = {
          default: '',
          gradient: `.sidebar-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important; }`,
          glass: `.sidebar { background: rgba(255,255,255,0.1) !important; backdrop-filter: blur(20px) !important; border-left: 1px solid rgba(255,255,255,0.2) !important; }`
      };
      let styleElement = document.getElementById('sidebar-theme-css');
      if (!styleElement) {
          styleElement = document.createElement('style');
          styleElement.id = 'sidebar-theme-css';
          document.head.appendChild(styleElement);
      }
      styleElement.textContent = themes[theme] || '';
  }

  function applyCustomCss(css) {
      customCssStore.set(css); 
  }

  // --- Backup & Restore System ---
  function backupSettings() {
      const settings = {
          selectedTheme: $selectedTheme,
          customCss: $customCssStore,
          aiSummaryEnabled: $aiSummaryEnabled,
          selectedLanguage: $selectedLanguage,
          selectedEngine: $selectedEngine,
          themeMode: $themeMode,
          uiDensity: $uiDensity,
          fontScale: $fontScale,
          cornerRadius: $cornerRadius,
          accentColor: $accentColor,
          safeSearch: $safeSearch,
          blockedSites: $blockedSites,
          searchHomeDesign: $searchHomeDesign,
          showNavbarSubCategory: $showNavbarSubCategory
      };
      const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `artstelve_settings_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  }

  function restoreSettings(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const settings = JSON.parse(e.target.result);
              if (settings.selectedTheme) selectedTheme.set(settings.selectedTheme);
              if (settings.customCss !== undefined) customCssStore.set(settings.customCss);
              if (settings.aiSummaryEnabled !== undefined) aiSummaryEnabled.set(settings.aiSummaryEnabled);
              if (settings.selectedLanguage) selectedLanguage.set(settings.selectedLanguage);
              if (settings.selectedEngine) selectedEngine.set(settings.selectedEngine);
              if (settings.themeMode) themeMode.set(settings.themeMode);
              if (settings.uiDensity) uiDensity.set(settings.uiDensity);
              if (settings.fontScale) fontScale.set(settings.fontScale);
              if (settings.cornerRadius) cornerRadius.set(settings.cornerRadius);
              if (settings.accentColor) accentColor.set(settings.accentColor);
              if (settings.safeSearch !== undefined) safeSearch.set(settings.safeSearch);
              if (settings.blockedSites) blockedSites.set(settings.blockedSites);
              if (settings.searchHomeDesign) searchHomeDesign.set(settings.searchHomeDesign);
              if (settings.showNavbarSubCategory !== undefined) showNavbarSubCategory.set(settings.showNavbarSubCategory);
              
              alert('Ayarlar başarıyla geri yüklendi!');
              location.reload(); // Reload to ensure full application
          } catch (err) {
              alert('Dosya okunurken hata oluştu: ' + err.message);
          }
      };
      reader.readAsText(file);
  }

  function removeBlockedSite(site) {
      blockedSites.update(sites => sites.filter(s => s !== site));
  }

  // --- Workshop Items (Legacy but kept) ---
  let themes = writable([]);
  let plugins = writable([]);
  let workshopError = writable(null);
  let isLoadingWorkshop = writable(true);
  let installingId = null;

  async function fetchWorkshopItems() {
       isLoadingWorkshop.set(true);
        try {
            const response = await fetch('/api/workshop/items');
            if (response.ok) {
              const data = await response.json();
              themes.set(data.themes || []);
              plugins.set(data.plugins || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            isLoadingWorkshop.set(false);
        }
  }

  async function installItem(item, type) {
      if (installingId) return;
      installingId = item.id;
      try {
          const res = await fetch('/api/workshop/install', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ downloadUrl: item.download_url, type: type, name: item.name, id: item.id })
          });
          const result = await res.json();
          alert(result.success ? 'Başarıyla indirildi!' : 'Hata: ' + result.error);
      } catch (e) { alert('Hata: ' + e.message); } 
      finally { installingId = null; }
  }

  onMount(() => {
      if (browser) {
          fetchWorkshopItems();
          document.body.classList.add('settings-active');
          return () => document.body.classList.remove('settings-active');
      }
  });

  function formatThemeName(kebabCaseName) {
        if (!kebabCaseName) return '';
        return kebabCaseName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
</script>

<svelte:head>
  <title>{$t('settings')} - Stelve</title>
</svelte:head>

<div class="settings-page" transition:fade={{ duration: 300 }}>
  
  <header class="settings-header">
       <div class="header-left">
           <a href="/" class="back-button" aria-label="Aramaya Dön">
               <i class="fas fa-arrow-left"></i>
               <span>Aramaya Dön</span>
           </a>
       </div>
       <h1 class="settings-title">{$t('settings')}</h1>
       <div class="header-right"></div> 
   </header>

   <div class="settings-content-wrapper">
    <aside class="settings-sidebar">
           <nav aria-label="Ayarlar Menüsü">
               <ul>
                   {#each tabs as tab}
                       <li>
                           <button
                               class:active={activeTab === tab.id}
                               on:click={() => activeTab = tab.id}
                           >
                               <i class={tab.icon}></i>
                               <span>{ tab.label === 'interface' ? 'Arayüz' : 
                                       tab.label === 'customCSS' ? 'Özel CSS' :
                                       tab.label === 'advanced' ? 'Gelişmiş' :
                                       $t(tab.label) || tab.id }</span>
                           </button>
                       </li>
                   {/each}
               </ul>
           </nav>
    </aside>

       <main class="settings-main-content">
      {#if activeTab === 'Temel Ayarlar'}
           <section in:slide={{ duration: 300 }}>
             <h2 class="section-heading">{$t('basicSettings')}</h2>
             <div class="setting-card">
                 <div class="setting-row">
                    <div class="setting-info">
                        <h3>{$t('language')}</h3>
                        <p>Artado Search'ü kullandığınız dili seçin.</p>
                    </div>
                    <div class="select-wrapper">
                        <select bind:value={$selectedLanguage}>
                            <option value="tr">Türkçe</option>
                            <option value="en">English</option>
                            <option value="fr">Français</option>
                        </select>
                        <i class="fas fa-chevron-down dropdown-icon"></i>
                    </div>
                 </div>

                 <div class="divider"></div>

                 <div class="setting-row">
                    <div class="setting-info">
                        <h3>{$t('searchEngine')}</h3>
                        <p>Varsayılan arama motorunuzu belirleyin.</p>
                    </div>
                    <div class="select-wrapper">
                        <select bind:value={$selectedEngine}>
                            <option value="Brave">Brave Search</option>
                            <option value="DuckDuckGo">DuckDuckGo</option>
                            <option disabled>Google (Yakında)</option> 
                        </select>
                        <i class="fas fa-chevron-down dropdown-icon"></i>
                    </div>
                 </div>

                 <div class="divider"></div>

                 <div class="setting-row">
                    <div class="setting-info">
                         <h3>Güvenli Arama</h3>
                         <p>Uygunsuz içerikleri filtreleyin.</p>
                    </div>
                    <label class="switch">
                        <input type="checkbox" bind:checked={$safeSearch}>
                        <span class="slider"></span>
                    </label>
                 </div>

                 <div class="divider"></div>

                 <div class="setting-row">
                    <div class="setting-info">
                        <h3>AI Özetini Göster</h3>
                        <p>Arama sonuçlarında yapay zeka özetini görüntüleyin.</p>
                    </div>
                    <label class="switch">
                        <input type="checkbox" bind:checked={$aiSummaryEnabled}>
                        <span class="slider"></span>
                    </label>
                 </div>
             </div>
           </section>

      {:else if activeTab === 'Görünüm'}
            <section in:slide={{ duration: 300 }}>
                 <h2 class="section-heading">{$t('appearance')}</h2>
                 <div class="setting-card">
                     <div class="setting-row">
                        <div class="setting-info">
                            <h3>{$t('themeMode')}</h3>
                            <p>{$t('themeModeDesc')}</p>
                        </div>
                        <div class="select-wrapper">
                            <select bind:value={$themeMode}>
                                <option value="system">{$t('system')}</option>
                                <option value="light">{$t('light')}</option>
                                <option value="dark">{$t('dark')}</option>
                            </select>
                            <i class="fas fa-chevron-down dropdown-icon"></i>
                        </div>
                     </div>
                     <div class="divider"></div>
                     <div class="setting-row">
                        <div class="setting-info">
                            <h3>{$t('cornerRadius')}</h3>
                            <p>Köşe yuvarlaklığını ayarlayın.</p>
                        </div>
                        <div class="select-wrapper">
                            <select bind:value={$cornerRadius}>
                                <option value="rounded">Yuvarlak</option>
                                <option value="medium">Orta</option>
                                <option value="square">Keskin</option>
                            </select>
                            <i class="fas fa-chevron-down dropdown-icon"></i>
                        </div>
                     </div>
                     <div class="divider"></div>
                     <div class="setting-row">
                        <div class="setting-info">
                            <h3>{$t('accentColor')}</h3>
                            <p>Uygulama genelinde vurgu rengini seçin.</p>
                        </div>
                        <input type="color" bind:value={$accentColor} class="color-picker">
                     </div>
                 </div>
            </section>

       {:else if activeTab === 'Arayüz'}
             <section in:slide={{ duration: 300 }}>
                 <h2 class="section-heading">Arayüz ve Navigasyon</h2>
                 <div class="setting-card">
                     <div class="setting-row">
                         <div class="setting-info">
                            <h3>Ana Sayfa Tasarımı</h3>
                            <p>Arama ana sayfasının görünümünü özelleştirin.</p>
                         </div>
                         <div class="select-wrapper">
                             <select bind:value={$searchHomeDesign}>
                                 <option value="simple">Benim için sade (Simple)</option>
                                 <option value="modern">Modern & Canlı</option>
                                 <option value="artistic">Sanatsal</option>
                             </select>
                             <i class="fas fa-chevron-down dropdown-icon"></i>
                         </div>
                     </div>
                     <div class="divider"></div>
                     <div class="setting-row">
                         <div class="setting-info">
                            <h3>Navbar Alt Kategori</h3>
                            <p>Navigasyon çubuğunda ek alt kategori göster.</p>
                         </div>
                         <label class="switch">
                             <input type="checkbox" bind:checked={$showNavbarSubCategory}>
                             <span class="slider"></span>
                         </label>
                     </div>
                 </div>
             </section>

      {:else if activeTab === 'Temalar'}
            <section in:slide={{ duration: 300 }}>
               <h2 class="section-heading">{$t('themes')}</h2>
               <div class="setting-card">
                   <div class="themes-grid">
                       {#each ['klasik', 'koyu', 'mavi', 'pastel', 'doga', 'terminal', 'gece-yarisi', 'gunesli', 'retro', 'komur', 'okyanus'] as theme}
                           <button 
                              class="theme-button" 
                              class:active={$selectedTheme === theme} 
                              on:click={() => selectedTheme.set(theme)}
                           >
                               <div class="theme-preview-box {theme}"></div>
                               <span>{formatThemeName(theme)}</span>
                           </button>
                       {/each}
                   </div>
                   
                   <h3 style="margin-top: 2rem;">Menü Temaları</h3>
                   <div class="themes-grid small">
                       <button class="theme-button" on:click={() => applySidebarTheme('default')}>
                          <div class="theme-preview-box small sidebar-default"></div>
                          <span>Varsayılan</span>
                       </button>
                       <button class="theme-button" on:click={() => applySidebarTheme('gradient')}>
                          <div class="theme-preview-box small sidebar-gradient"></div>
                          <span>Gradient</span>
                       </button>
                       <button class="theme-button" on:click={() => applySidebarTheme('glass')}>
                          <div class="theme-preview-box small sidebar-glass"></div>
                          <span>Cam Efekti</span>
                       </button>
                   </div>
               </div>
            </section>

      {:else if activeTab === 'Özel CSS'}
           <section in:slide={{ duration: 300 }}>
              <h2 class="section-heading">Özel CSS</h2>
              <div class="setting-card">
                  <p>Hızlı başlangıç için hazır CSS şablonları:</p>
                  <div class="preset-buttons">
                      <button on:click={() => applyPresetCSS('minimal')}>Minimal</button>
                      <button on:click={() => applyPresetCSS('glassmorphism')}>Glassmorphism</button>
                      <button on:click={() => applyPresetCSS('neon')}>Neon</button>
                  </div>
                  <textarea 
                     bind:value={$customCssStore} 
                     on:input={(e) => applyCustomCss(e.target.value)}
                     rows="12"
                     placeholder="/* CSS kodunuzu buraya yazın... */"
                     class="css-editor"
                  ></textarea>
                  <button class="button danger" style="margin-top: 1rem;" on:click={() => applyCustomCss('')}>Temizle</button>
              </div>
           </section>

      {:else if activeTab === 'Gelişmiş'}
           <section in:slide={{ duration: 300 }}>
               <h2 class="section-heading">Gelişmiş Ayarlar</h2>
               
               <div class="setting-card">
                   <h3>Yedekleme ve Geri Yükleme</h3>
                   <p>Tüm ayarlarınızı dışa aktarın veya önceden aldığınız bir yedeği geri yükleyin.</p>
                   <div class="action-buttons">
                       <button class="button primary" on:click={backupSettings}>
                           <i class="fas fa-download"></i> Ayarları Yedekle (İndir)
                       </button>
                       <label class="button secondary file-upload-btn">
                           <i class="fas fa-upload"></i> Yedekten Geri Yükle
                           <input type="file" accept=".json" on:change={restoreSettings} style="display: none;">
                       </label>
                   </div>
               </div>

               <div class="setting-card" style="margin-top: 2rem;">
                   <h3>Engellenen / Öne Çıkarılmayan Siteler</h3>
                   <p>Arama sonuçlarında öne çıkarılması engellenen sitelerin listesi.</p>
                   {#if $blockedSites.length > 0}
                       <ul class="blocked-sites-list">
                           {#each $blockedSites as site}
                               <li>
                                   <span>{site}</span>
                                   <button on:click={() => removeBlockedSite(site)} title="Engeli Kaldır">
                                       <i class="fas fa-times"></i>
                                   </button>
                               </li>
                           {/each}
                       </ul>
                   {:else}
                       <p class="empty-state">Henüz engellenen bir site yok.</p>
                   {/if}
               </div>
           </section>

      {:else if activeTab === 'Eklentiler'}
         <section in:slide={{ duration: 300 }}>
             <h2 class="section-heading">Workshop</h2>
             {#if $isLoadingWorkshop}
                 <p>Yükleniyor...</p>
             {:else}
                 <div class="setting-card">
                     <h3>Temalar</h3>
                     {#if $themes.length > 0}
                         <ul class="workshop-list">
                             {#each $themes as theme}
                                 <li>
                                     <strong>{theme.name}</strong> <small>({theme.author})</small>
                                     <button on:click={() => installItem(theme, 'theme')} disabled={installingId === theme.id}>İndir</button>
                                 </li>
                             {/each}
                         </ul>
                     {:else}
                         <p>Eklenti bulunamadı.</p>
                     {/if}
                 </div>
             {/if}
         </section>
      {/if}
       </main>
   </div>
</div>

<style>
   /* Premium Settings Styles */
    .settings-page {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background-color: var(--background-color);
        color: var(--text-color);
        font-family: 'Inter', sans-serif;
    }
    
    .settings-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.5rem 3rem;
        background: var(--card-background);
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        position: sticky;
        top: 0;
        z-index: 100;
        backdrop-filter: blur(10px);
    }
    
    .settings-title {
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0;
        background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
    
    .back-button {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        text-decoration: none;
        color: var(--text-color-secondary);
        font-weight: 500;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        transition: all 0.2s;
        background: var(--input-background);
    }
    .back-button:hover {
        background: var(--hover-background);
        color: var(--primary-color);
        transform: translateX(-3px);
    }

    .settings-content-wrapper {
        display: flex;
        max-width: 1400px;
        margin: 2rem auto;
        width: 95%;
        gap: 2rem;
        align-items: flex-start;
    }
    
    .settings-sidebar {
        width: 260px;
        flex-shrink: 0;
    }
    
    .settings-sidebar nav ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    
    .settings-sidebar nav li { margin-bottom: 0.5rem; }
    
    .settings-sidebar button {
        width: 100%;
        text-align: left;
        background: transparent;
        border: none;
        padding: 1rem 1.2rem;
        border-radius: 12px;
        color: var(--text-color-secondary);
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 1rem;
        font-size: 1rem;
    }
    
    .settings-sidebar button i { width: 20px; text-align: center; }
    
    .settings-sidebar button:hover {
        background: var(--hover-background);
        color: var(--text-color);
    }
    
    .settings-sidebar button.active {
        background: var(--primary-color);
        color: white;
        box-shadow: 0 4px 12px rgba(var(--primary-color-rgb), 0.3);
    }

    .settings-main-content {
        flex-grow: 1;
        min-width: 0;
    }
    
    .section-heading {
        margin-bottom: 1.5rem;
        font-size: 1.8rem;
        font-weight: 700;
    }

    .setting-card {
        background: var(--card-background);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 2rem;
        box-shadow: 0 4px 20px rgba(0,0,0,0.03);
    }

    .setting-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0;
        gap: 2rem;
    }

    .setting-info h3 {
        margin: 0 0 0.5rem 0;
        font-size: 1.1rem;
        font-weight: 600;
    }
    
    .setting-info p {
        margin: 0;
        color: var(--text-color-secondary);
        font-size: 0.9rem;
    }

    .divider {
        height: 1px;
        background: var(--border-color);
        margin: 1.5rem 0;
        opacity: 0.5;
    }

    /* Controls */
    .select-wrapper {
        position: relative;
        min-width: 180px;
    }
    .select-wrapper select {
        width: 100%;
        padding: 0.7rem 2.5rem 0.7rem 1rem;
        border-radius: 8px;
        border: 1px solid var(--border-color);
        background: var(--input-background);
        color: var(--text-color);
        font-size: 0.95rem;
        cursor: pointer;
        appearance: none;
    }
    .select-wrapper .dropdown-icon {
        position: absolute;
        right: 1rem;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        color: var(--text-color-secondary);
    }
    
    .color-picker {
        border: none;
        width: 50px;
        height: 50px;
        padding: 0;
        background: none;
        cursor: pointer;
    }

    /* Switch */
    .switch {
        position: relative;
        display: inline-block;
        width: 50px;
        height: 28px;
    }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider {
        position: absolute;
        cursor: pointer;
        top: 0; left: 0; right: 0; bottom: 0;
        background-color: #ccc;
        transition: .3s;
        border-radius: 34px;
    }
    .slider:before {
        position: absolute;
        content: "";
        height: 20px; width: 20px;
        left: 4px; bottom: 4px;
        background-color: white;
        transition: .3s;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    input:checked + .slider { background-color: var(--primary-color); }
    input:checked + .slider:before { transform: translateX(22px); }

    /* Themes Grid */
    .themes-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
        gap: 1.5rem;
    }
    .theme-button {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.8rem;
        padding: 1rem;
        border: 1px solid var(--border-color);
        border-radius: 12px;
        background: var(--input-background);
        cursor: pointer;
        transition: all 0.2s;
    }
    .theme-button:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(0,0,0,0.05); }
    .theme-button.active { border-color: var(--primary-color); background: rgba(var(--primary-color-rgb), 0.05); }
    
    .theme-preview-box {
        width: 100%;
        height: 80px;
        border-radius: 8px;
        background: #f0f0f0; /* Default */
        box-shadow: inset 0 0 10px rgba(0,0,0,0.05);
    }
    /* Simple color previews for themes */
    .theme-preview-box.koyu { background: #1a1a1a; }
    .theme-preview-box.mavi { background: #e3f2fd; }
    .theme-preview-box.klasik { background: #ffffff; border: 1px solid #ddd; }
    
    /* CSS Editor */
    .css-editor {
        width: 100%;
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid var(--border-color);
        background: var(--input-background);
        color: var(--text-color);
        font-family: monospace;
        margin-top: 1rem;
        resize: vertical;
    }
    .preset-buttons { display: flex; gap: 1rem; margin-bottom: 1rem; }
    .preset-buttons button {
        padding: 0.5rem 1rem;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        background: var(--card-background);
        cursor: pointer;
    }

    /* Buttons */
    .button {
        padding: 0.7rem 1.5rem;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        transition: all 0.2s;
    }
    .button.primary { background: var(--primary-color); color: white; }
    .button.secondary { background: var(--input-background); color: var(--text-color); border: 1px solid var(--border-color); }
    .button.danger { background: #ff4757; color: white; }
    .button:hover { opacity: 0.9; transform: translateY(-1px); }
    
    .file-upload-btn { display: inline-flex; cursor: pointer; }
    
    .blocked-sites-list {
        list-style: none;
        padding: 0;
    }
    .blocked-sites-list li {
        display: flex;
        justify-content: space-between;
        padding: 0.8rem;
        background: var(--input-background);
        margin-bottom: 0.5rem;
        border-radius: 6px;
    }
    .blocked-sites-list button {
        background: none;
        border: none;
        color: #ff4757;
        cursor: pointer;
    }
</style>