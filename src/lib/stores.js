import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Helper function to create a writable store synced with localStorage
function createPersistentStore(key, startValue) {
    let initialValue = startValue;

    if (browser) {
        const stored = localStorage.getItem(key);
        if (stored !== null) {
            try {
                initialValue = JSON.parse(stored);
            } catch (e) {
                console.error(`Failed to parse localStorage key "${key}":`, e);
                initialValue = startValue;
            }
        }
    }

    const { subscribe, set, update } = writable(initialValue);

    return {
        subscribe,
        set: (value) => {
            if (browser) {
                localStorage.setItem(key, JSON.stringify(value));
            }
            set(value);
        },
        update: (fn) => {
            update(u => {
                const value = fn(u);
                if (browser) {
                    localStorage.setItem(key, JSON.stringify(value));
                }
                return value;
            });
        }
    };
}

// --- Global Stores ---

// Theme Store (persisted)
export const selectedTheme = createPersistentStore('selectedTheme', 'midnight_glow'); 

// Custom Logo Store (persisted)
export const customLogo = createPersistentStore('customLogo', '/logo.png');

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
export const selectedEngine = createPersistentStore('selectedEngine', 'Hybrid Proxy'); // Default Hybrid Proxy 

export const hybridProxyBaseUrl = createPersistentStore('hybridProxyBaseUrl', 'https://artadoproxy.vercel.app');
export const hybridProxyEngines = createPersistentStore('hybridProxyEngines', 'duckduckgo,brave,startpage,qwant,mojeek,ask,marginalia');
export const hybridProxyLimitPerEngine = createPersistentStore('hybridProxyLimitPerEngine', 5);
export const hybridProxyLimitTotal = createPersistentStore('hybridProxyLimitTotal', 35);
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

// --- Privacy & Features ---
export const enableSuggestions = createPersistentStore('enableSuggestions', true);
export const searchRegion = createPersistentStore('searchRegion', 'TR'); // 'all', 'tr', 'us', etc.

// --- Plugin Controls ---
export const enableTranslatePlugin = createPersistentStore('enableTranslatePlugin', true);

// --- New Features Stores ---
// Search Home Design: 'simple' | 'modern' | 'artistic'
export const searchHomeDesign = createPersistentStore('searchHomeDesign', 'simple');

// Blocked/Boost-Prevented Sites
export const blockedSites = createPersistentStore('blockedSites', []);

// Navbar Customization
export const showNavbarSearch = createPersistentStore('showNavbarSearch', true); // Show search bar in navbar
export const showNavbarSubCategory = createPersistentStore('showNavbarSubCategory', false); // Extra subcategory in navbar

// Custom Homepage Theme (from workshop)
export const searchHomeCustomTheme = createPersistentStore('searchHomeCustomTheme', '');

// --- Translation Stores (Devs only, no local persistence for data) ---
export const translateInput = writable('');
export const translateOutput = writable('');
export const translateTargetLang = writable('tr');
export const isTranslating = writable(false);
