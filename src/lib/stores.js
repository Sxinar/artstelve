import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Helper function to create a writable store synced with localStorage
function createPersistentStore(key, startValue) {
    const initialValue = browser ? localStorage.getItem(key) ?? JSON.stringify(startValue) : JSON.stringify(startValue);
    let parsedValue;
    try {
        parsedValue = JSON.parse(initialValue);
    } catch (e) {
        console.error(`Failed to parse localStorage key "${key}":`, e);
        parsedValue = startValue; // Fallback to startValue
    }
    
    const store = writable(parsedValue);

    if (browser) {
        store.subscribe(value => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.error(`Failed to save localStorage key "${key}":`, e);
            }
        });
    }

    return store;
}

// --- Global Stores ---

// Theme Store (persisted)
export const selectedTheme = createPersistentStore('selectedTheme', 'klasik'); // Default theme is klasik (lowercase, kebab-case)

// Sidebar State (not persisted, resets on refresh)
export const isSidebarOpen = writable(false);

// Custom CSS Store (persisted)
export const customCssStore = createPersistentStore('customCSS', ''); // Default empty string

// AI Summary Enabled State (persisted)
export const aiSummaryEnabled = createPersistentStore('aiSummaryEnabled', true); // Default true 

// --- NEW Persisted Stores ---

// Language Store (persisted)
export const selectedLanguage = createPersistentStore('selectedLanguage', 'tr'); // Default key 'tr'

// Search Engine Store (persisted)
export const selectedEngine = createPersistentStore('selectedEngine', 'Brave'); // Default Brave 

export const hybridProxyBaseUrl = createPersistentStore('hybridProxyBaseUrl', 'http://localhost:8787');
export const hybridProxyEngines = createPersistentStore('hybridProxyEngines', 'brave,startpage,qwant');
export const hybridProxyLimitPerEngine = createPersistentStore('hybridProxyLimitPerEngine', 5);
export const hybridProxyTimeoutMs = createPersistentStore('hybridProxyTimeoutMs', 20000);
export const hybridProxyCache = createPersistentStore('hybridProxyCache', true);

// --- Design/Appearance Stores (persisted) ---
// Theme Mode: 'system' | 'light' | 'dark'
export const themeMode = createPersistentStore('themeMode', 'system');

// UI Density: 'comfortable' | 'compact'
export const uiDensity = createPersistentStore('uiDensity', 'comfortable');

// Font Scale (number multiplier, e.g., 1, 0.9, 1.1)
export const fontScale = createPersistentStore('fontScale', 1);

// Corner Radius scale: 'rounded' | 'medium' | 'square'
export const cornerRadius = createPersistentStore('cornerRadius', 'rounded');

// Accent color (hex or preset name)
export const accentColor = createPersistentStore('accentColor', '#1a73e8');

// Safe search (persisted)
export const safeSearch = createPersistentStore('safeSearch', true);

// --- New Features Stores ---
// Search Home Design: 'simple' | 'modern' | 'artistic'
export const searchHomeDesign = createPersistentStore('searchHomeDesign', 'simple');

// Blocked/Boost-Prevented Sites
export const blockedSites = createPersistentStore('blockedSites', []);

// Navbar Customization
export const showNavbarSearch = createPersistentStore('showNavbarSearch', true); // Show search bar in navbar
export const showNavbarSubCategory = createPersistentStore('showNavbarSubCategory', false); // Extra subcategory in navbar