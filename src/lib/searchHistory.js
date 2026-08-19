import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Maximum number of history items to keep
const MAX_HISTORY_ITEMS = 50;

// Initialize search history from localStorage
function createSearchHistory() {
    const defaultHistory = [];

    const stored = browser ? localStorage.getItem('searchHistory') : null;
    const initial = stored ? JSON.parse(stored) : defaultHistory;

    const { subscribe, set, update } = writable(initial);

    return {
        subscribe,
        addSearch: (query, engine = 'Brave', type = 'web') => {
            if (!query || query.trim() === '') return;

            update(history => {
                // Remove duplicate if exists
                const filtered = history.filter(item =>
                    !(item.query.toLowerCase() === query.toLowerCase() &&
                        item.engine === engine &&
                        item.type === type)
                );

                // Add new search at the beginning
                const newHistory = [
                    {
                        query: query.trim(),
                        engine,
                        type,
                        timestamp: Date.now(),
                        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                    },
                    ...filtered
                ].slice(0, MAX_HISTORY_ITEMS); // Keep only MAX_HISTORY_ITEMS

                // Save to localStorage
                if (browser) {
                    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
                }

                return newHistory;
            });
        },
        removeSearch: (id) => {
            update(history => {
                const newHistory = history.filter(item => item.id !== id);
                if (browser) {
                    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
                }
                return newHistory;
            });
        },
        clearHistory: () => {
            set([]);
            if (browser) {
                localStorage.removeItem('searchHistory');
            }
        },
        getRecent: (limit = 10) => {
            let recent = [];
            update(history => {
                recent = history.slice(0, limit);
                return history;
            });
            return recent;
        }
    };
}

export const searchHistory = createSearchHistory();

// Helper function to format timestamp
export function formatTimestamp(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Az önce';
    if (minutes < 60) return `${minutes} dakika önce`;
    if (hours < 24) return `${hours} saat önce`;
    if (days < 7) return `${days} gün önce`;

    const date = new Date(timestamp);
    return date.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
