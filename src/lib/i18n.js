import { derived } from 'svelte/store';
import { selectedLanguage } from './stores'; // Import the selected language store

// Simple translation dictionary
const translations = {
    tr: {
        searchPlaceholder: "Artado'da ara...",
        all: "Hepsi",
        images: "Görseller",
        videos: "Videolar",
        settings: "Ayarlar",
        themes: "Temalar",
        language: "Dil",
        searchEngine: "Arama Motoru",
        aiSummary: "AI Özeti",
        showAiSummary: "Arama sonuçlarında AI özetini göster",
        footerCopyright: "Tüm hakları Artado Software'a aittir",
        menu: "Menü",
        closeMenu: "Menüyü kapat",
        basicSettings: "Temel Ayarlar",
        // Add more translations as needed
    },
    en: {
        searchPlaceholder: "Search on Artado...",
        all: "All",
        images: "Images",
        videos: "Videos",
        settings: "Settings",
        themes: "Themes",
        language: "Language",
        searchEngine: "Search Engine",
        aiSummary: "AI Summary",
        showAiSummary: "Show AI summary on search results",
        footerCopyright: "All rights reserved Artado Software",
        menu: "Menu",
        closeMenu: "Close menu",
        basicSettings: "Basic Settings",
        // Add more translations as needed
    },
    fr: {
        searchPlaceholder: "Rechercher sur Artado...",
        all: "Tout",
        images: "Images",
        videos: "Vidéos",
        settings: "Paramètres",
        themes: "Thèmes",
        language: "Langue",
        searchEngine: "Moteur de recherche",
        aiSummary: "Résumé IA",
        showAiSummary: "Afficher le résumé IA sur les résultats",
        footerCopyright: "Tous droits réservés Artado Software",
        menu: "Menu",
        closeMenu: "Fermer le menu",
        basicSettings: "Paramètres de base",
        // Add more translations as needed
    }
};

// Function to get the translation for a key based on the current language
function translate(lang, key) {
    const langKey = lang?.toLowerCase() || 'tr'; // Default to Turkish if undefined/null
    const langTranslations = translations[langKey] || translations.tr; // Fallback to Turkish
    return langTranslations[key] || key; // Return key itself if translation is missing
}

// Create a derived store that provides the translation function `t`
export const t = derived(selectedLanguage, ($selectedLanguage) => {
    return (key) => translate($selectedLanguage, key);
}); 