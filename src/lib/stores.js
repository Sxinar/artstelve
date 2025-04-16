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