# Artado Search - Project Memory

## Project Overview
Artado Search is a SvelteKit-based search engine frontend. It prioritizes privacy (backend proxying), aesthetics (multiple themes), and usability (voice search, AI summaries).

## Tech Stack
- **Framework**: SvelteKit (Vite + Svelte 5)
- **Styling**: Tailwind CSS v4 + Custom CSS Variables for theming (Vanilla CSS approach for themes)
- **Backend/API**: SvelteKit Server Routes (`/api/search`)
- **Key Libraries**: `@sveltejs/kit`, `tailwindcss`

## Project Structure
- `src/routes/+page.svelte`: Home page. Contains the main search input and design variations (Modern, Artistic).
- `src/routes/search/`: Search results page (likely `+page.svelte`).
- `src/routes/api/search/+server.js`: The core search logic.
    - Proxies requests to **Brave Search API** (primary).
    - Supports **DuckDuckGo** (alternative).
    - Includes **Gemini AI** integration for query summarization (`getAiQuerySummary`).
    - Handles "Bang" commands (e.g., `!g`, `!ddg`, `!w`).
- `src/global.css`: Defines extensive CSS variables for themes (Light, Dark, Blue, Pastel, Nature, Terminal, Midnight, Sunny, Retro, Coal, Ocean).

## Key Features
- **Multiple Themes**: Robust theming system using CSS variables controlled by body classes.
- **AI Integration**: Uses Google Gemini to summarize search queries directly in the results.
- **Privacy**: Search requests are proxied through the server; keys are hidden from the client.
- **Voice Search**: Web Speech API integration.
- **Bang Commands**: Direct navigation shortcuts.

## Current Status & Tasks
- **Design**: "Modern" and "Artistic" modes exist.
- **API**: Brave and DuckDuckGo implemented. Google exists as a placeholder.
- **Missing**: "News" and "Video" search might need more specific handling or robust rendering in the frontend.
- **To-Do**: 
    - Beautify design (animations, polish).
    - Fix duplicates in backend code.
    - Add more search engines (Bing).
    - Optimize performance.
