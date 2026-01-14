<script>
	import { onMount, setContext, getContext } from "svelte";
	import { writable } from "svelte/store";
	import { page } from "$app/stores"; // Import page store
	import { slide, fade } from "svelte/transition"; // Import transitions
	import { browser } from "$app/environment"; // Import browser check
	import { goto, afterNavigate } from "$app/navigation";
	import { searchHistory } from "$lib/searchHistory.js";
	import "../app.css";
	import "../global.css";

	// --- Navigation Handling ---
	afterNavigate(() => {
		isSidebarOpen.set(false);
	});

	// --- Import Stores ---
	import {
		selectedTheme,
		isSidebarOpen,
		customCssStore,
		aiSummaryEnabled,
		selectedLanguage,
		selectedEngine,
		themeMode,
		uiDensity,
		fontScale,
		cornerRadius,
		accentColor,
		showNavbarSubCategory,
	} from "$lib/stores.js";
	import { t } from "$lib/i18n.js"; // Import translation function

	// REMOVED: Local store definitions are now imported
	// const selectedTheme = writable('Klasik');
	// const isSidebarOpen = writable(false);

	// Provide stores to child components via context
	setContext("theme", selectedTheme);
	setContext("sidebar", isSidebarOpen);
	setContext("customCSS", customCssStore);

	// --- Define possible themes (kebab-case, lowercase) ---
	const themes = [
		"klasik",
		"koyu",
		"mavi",
		"pastel",
		"doga",
		"terminal",
		"gece-yarisi",
		"gunesli",
		"retro",
		"komur",
		"okyanus",
	]; // Added new themes

	// Helper function to format theme names for display
	function formatThemeName(kebabCaseName) {
		if (!kebabCaseName) return "";
		return kebabCaseName
			.split("-")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	}

	// Function to apply the theme class to the body
	function applyTheme(theme) {
		if (browser && document.body) {
			// Remove all known theme classes
			document.body.classList.remove(...themes);
			// Add the new theme class if it's valid
			if (theme && themes.includes(theme)) {
				document.body.classList.add(theme); // Already lowercase
			}
			// console.log('Layout: Applied theme class:', theme);
		} else if (browser) {
			window.requestAnimationFrame(() => applyTheme(theme));
		}
	}

	function applySidebarClass(isOpen) {
		if (browser && document.body) {
			if (isOpen) {
				document.body.classList.add("sidebar-open");
			} else {
				document.body.classList.remove("sidebar-open");
			}
		}
	}

	// --- External Theme Application ---
	let externalThemeElement;
	function applyExternalTheme(theme) {
		if (!browser) return;

		// Remove existing external theme link if it exists
		if (externalThemeElement) {
			externalThemeElement.remove();
			externalThemeElement = null;
		}

		// If it's a built-in theme, applyTheme handles classes (it's already subscribed)
		if (themes.includes(theme)) {
			return;
		}

		// Otherwise, try to load it as an external theme
		// Assuming external themes are in /themes/[themeName]/[themeName].css
		console.log("Layout: Applying external theme:", theme);
		externalThemeElement = document.createElement("link");
		externalThemeElement.rel = "stylesheet";
		externalThemeElement.href = `/themes/${theme}/${theme}.css`;
		externalThemeElement.onerror = () => {
			console.error(`Failed to load external theme: ${theme}`);
			// Fallback to default if load fails? Maybe not, just logo error
		};
		document.head.appendChild(externalThemeElement);
	}

	// --- Custom CSS Application ---
	let customStyleElement;

	// --- Keyboard Shortcuts ---
	function handleKeyDown(event) {
		// Ctrl+K or / to focus search
		if (
			(event.ctrlKey && event.key === "k") ||
			(event.key === "/" &&
				event.target.tagName !== "INPUT" &&
				event.target.tagName !== "TEXTAREA")
		) {
			event.preventDefault();
			const searchInput = document.querySelector(
				".search-input, .search-input-header",
			);
			if (searchInput) searchInput.focus();
		}

		// Esc to close sidebar
		if (event.key === "Escape" && $isSidebarOpen) {
			isSidebarOpen.set(false);
		}

		// Ctrl+, to open settings
		if (event.ctrlKey && event.key === ",") {
			event.preventDefault();
			goto("/settings");
		}
	}

	// Initialize on mount
	onMount(() => {
		if (browser) {
			window.addEventListener("keydown", handleKeyDown);
			return () => window.removeEventListener("keydown", handleKeyDown);
		}
	});

	// Subscribe might be called before body exists, applyTheme handles this now.
	selectedTheme.subscribe(applyTheme);
	selectedTheme.subscribe(applyExternalTheme);
	isSidebarOpen.subscribe(applySidebarClass);

	// --- Apply design variables to body ---
	function applyDesignVariables() {
		if (!browser || !document?.body) return;
		const bodyStyle = document.body.style;
		// Accent color maps to primary color
		bodyStyle.setProperty("--accent-color", $accentColor);
		bodyStyle.setProperty("--primary-color", $accentColor);
		// Font scale and density
		const densityScale = $uiDensity === "compact" ? 0.9 : 1;
		bodyStyle.setProperty("--font-scale", String($fontScale ?? 1));
		bodyStyle.setProperty("--density-scale", String(densityScale));
		// Corner radius mapping
		const radiusMap = { rounded: "10px", medium: "6px", square: "0px" };
		const radius = radiusMap[$cornerRadius] ?? "6px";
		bodyStyle.setProperty("--radius-base", radius);
	}

	onMount(() => {
		// Ensure initial theme/class is applied after mount
		applyTheme($selectedTheme);
		applySidebarClass($isSidebarOpen);
		applyDesignVariables();

		// Apply themeMode (system/light/dark) class
		const applyThemeMode = () => {
			if (!browser || !document?.body) return;
			document.body.classList.remove("light", "dark");
			let mode = $themeMode;
			if (mode === "system") {
				const prefersDark =
					window.matchMedia &&
					window.matchMedia("(prefers-color-scheme: dark)").matches;
				mode = prefersDark ? "dark" : "light";
			}
			document.body.classList.add(mode);
		};
		applyThemeMode();

		// Listen changes
		const unsubscribers = [
			accentColor.subscribe(() => applyDesignVariables()),
			uiDensity.subscribe(() => applyDesignVariables()),
			fontScale.subscribe(() => applyDesignVariables()),
			cornerRadius.subscribe(() => applyDesignVariables()),
			themeMode.subscribe(() => applyThemeMode()),
		];

		// React to system theme changes when in system mode
		let media;
		if (window.matchMedia) {
			media = window.matchMedia("(prefers-color-scheme: dark)");
			const handler = () => $themeMode === "system" && applyThemeMode();
			media.addEventListener?.("change", handler);
		}

		// --- Apply Custom CSS on Mount ---
		if (browser) {
			customStyleElement = document.getElementById("custom-user-css");
			if (!customStyleElement) {
				customStyleElement = document.createElement("style");
				customStyleElement.id = "custom-user-css";
				document.head.appendChild(customStyleElement);
			}
			// Apply initial CSS from store
			customStyleElement.textContent = $customCssStore;

			// Subscribe to store changes for custom CSS
			const unsubscribeCustomCss = customCssStore.subscribe((value) => {
				if (customStyleElement) {
					customStyleElement.textContent = value;
				}
			});

			// Return cleanup function for custom CSS subscription
			return () => {
				unsubscribeCustomCss();
				unsubscribers.forEach((u) => u && u());
				if (media) {
					media.removeEventListener?.("change", () => {});
				}
				// Optionally remove the style tag on layout destroy,
				// but might cause FOUC if navigating between layouts?
				// if (customStyleElement && customStyleElement.parentNode) {
				//     customStyleElement.parentNode.removeChild(customStyleElement);
				// }
			};
		}
	});

	function toggleSidebar() {
		isSidebarOpen.update((open) => !open);
	}

	function scrollToFooter() {
		// Select the correct footer element
		const footer = document.querySelector(".footer.complex-footer");
		if (footer) {
			footer.scrollIntoView({ behavior: "smooth" });
		}
	}
</script>

<svelte:head>
	<!-- Ensure FontAwesome is loaded -->
	<link
		rel="stylesheet"
		href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
	/>
	<!-- Placeholder for custom CSS, managed in onMount -->
	<style id="custom-user-css"></style>
</svelte:head>

<!-- Sidebar -->
<aside
	class="sidebar"
	class:open={$isSidebarOpen}
	aria-labelledby="sidebar-title"
>
	<div class="sidebar-header">
		<h2 id="sidebar-title">Menü</h2>
		<button
			class="close-sidebar"
			on:click={toggleSidebar}
			aria-label={$t("closeMenu")}
		>
			<i class="fas fa-times" aria-hidden="true"></i>
		</button>
	</div>

	<div class="sidebar-content">
		<section class="sidebar-section">
			<h3 class="section-title">
				<i class="fas fa-palette icon" aria-hidden="true"></i>
				{$t("themes")}
			</h3>
			<div class="select-wrapper">
				<select bind:value={$selectedTheme} aria-label={$t("themes")}>
					{#each themes as themeName (themeName)}
						<option value={themeName}
							>{formatThemeName(themeName)}</option
						>
					{/each}
				</select>
				<i class="fas fa-chevron-down dropdown-icon" aria-hidden="true"
				></i>
			</div>
		</section>

		<hr class="divider" />

		<section class="sidebar-section">
			<h3 class="section-title">
				<i class="fas fa-language icon" aria-hidden="true"></i>
				{$t("language")}
			</h3>
			<div class="select-wrapper">
				<select
					bind:value={$selectedLanguage}
					aria-label={$t("language")}
				>
					<option value="tr">Türkçe</option>
					<option value="en">English</option>
					<option value="fr">Français</option>
				</select>
				<i class="fas fa-chevron-down dropdown-icon" aria-hidden="true"
				></i>
			</div>
		</section>

		<hr class="divider" />

		<section class="sidebar-section">
			<h3 class="section-title">
				<i class="fas fa-cogs icon" aria-hidden="true"></i>
				{$t("searchEngine")}
			</h3>
			<div class="select-wrapper">
				<select
					bind:value={$selectedEngine}
					aria-label="Arama Motoru Seçimi"
				>
					<option value="Hybrid Proxy">Hybrid Proxy Sonuçları</option>
					<option value="Brave">Brave Search</option>
					<option value="DuckDuckGo">DuckDuckGo</option>
					<option value="Google">Google</option>
					<option value="Bing">Bing</option>
					<option value="Yahoo">Yahoo</option>
					<option value="Yandex">Yandex</option>
				</select>
				<i class="fas fa-chevron-down dropdown-icon" aria-hidden="true"
				></i>
			</div>
		</section>

		<hr class="divider" />

		{#if $showNavbarSubCategory}
			<section class="sidebar-section">
				<h3 class="section-title">
					<i class="fas fa-magic icon" aria-hidden="true"></i> Özelleştirme
				</h3>
				<nav class="sidebar-links" style="margin-top: 0;">
					<a
						href="/settings#arayuz"
						on:click={() => {
							if ($page.url.pathname === "/settings")
								document
									.getElementById("arayuz")
									?.scrollIntoView();
						}}
					>
						<i class="fas fa-desktop icon"></i> Ana Sayfa Düzeni
					</a>
				</nav>
			</section>
			<hr class="divider" />
		{/if}

		<nav class="sidebar-links" aria-label="Site Bağlantıları">
			<a href="/settings"
				><i class="fas fa-sliders icon" aria-hidden="true"></i>
				{$t("settings")}</a
			>
			<a href="/workshop"
				><i class="fas fa-flask icon" aria-hidden="true"></i> Workshop</a
			>
			<a href="/forum"
				><i class="fas fa-comments icon" aria-hidden="true"></i> Forum</a
			>
			<a href="/manifesto"
				><i class="fas fa-scroll icon" aria-hidden="true"></i> Manifesto</a
			>
			<a href="/privacy"
				><i class="fas fa-shield-halved icon" aria-hidden="true"></i> Gizlilik</a
			>
			<a href="/developers"
				><i class="fas fa-code icon" aria-hidden="true"></i> Developers</a
			>
			<a
				href="https://github.com/artadosearch"
				target="_blank"
				rel="noopener noreferrer"
				><i class="fab fa-github icon" aria-hidden="true"></i> Github</a
			>
			<a
				href="https://discord.gg/artado"
				target="_blank"
				rel="noopener noreferrer"
				><i class="fab fa-discord icon" aria-hidden="true"></i> Discord</a
			>
		</nav>
	</div>
</aside>

<!-- Overlay for closing sidebar -->
{#if $isSidebarOpen}
	<div
		class="overlay"
		on:click={toggleSidebar}
		on:keydown={(e) => e.key === "Escape" && toggleSidebar()}
		role="button"
		tabindex="0"
		aria-label="Menüyü kapatmak için tıklayın"
	></div>
{/if}

<div class="page-container">
	<!-- Ensure the right-aligned class is applied -->
	<header class="header right-aligned">
		<button
			class="menu-button"
			on:click={toggleSidebar}
			aria-label="Menüyü aç"
		>
			<i class="fas fa-bars"></i>
		</button>
	</header>

	<!-- Page Content -->
	<div class="main-content-area">
		<slot />
	</div>

	<!-- NEW Simplified Footer -->
	<footer class="minimal-footer simple-footer">
		<span>{$t("footerCopyright")}</span>
	</footer>
</div>

<style>
	/* Styles specific to the layout (sidebar, header, footer, page-container, overlay) */
	/* Using :global for theme variables on body */

	.page-container {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		/* Background/color transitions applied via global.css on body */
	}

	.header {
		display: flex;
		justify-content: flex-start; /* Default to left */
		padding: 1rem;
		position: absolute;
		top: 0;
		left: 0; /* Default to left */
		right: auto;
		z-index: 10;
	}

	.menu-button {
		background: transparent;
		border: none;
		font-size: 1.6rem; /* Slightly smaller */
		cursor: pointer;
		padding: 0.6rem;
		border-radius: 50%;
		transition: background-color 0.2s ease;
		color: var(--text-color-secondary);
		line-height: 1; /* Prevent layout shifts */
	}

	.menu-button:hover {
		background-color: var(--hover-background);
		color: var(--text-color);
	}

	/* Enhanced Sidebar Styles */
	.sidebar {
		position: fixed;
		top: 0;
		left: auto;
		right: 0;
		width: 300px; /* Wider for better content */
		height: 100vh;
		max-height: 100vh;
		background: var(--card-background);
		box-shadow: -4px 0 25px rgba(0, 0, 0, 0.12);
		transform: translateX(100%);
		transition: transform 0.3s ease-out;
		z-index: 1001;
		border-left: 1px solid var(--border-color);
		display: flex;
		flex-direction: column;
		color: var(--text-color);
		overflow: hidden;
	}

	.sidebar.open {
		transform: translateX(0);
		overflow-y: auto; /* Allow scrolling only when open */
	}

	.sidebar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.2rem 1.5rem;
		border-bottom: 1px solid var(--border-color);
		flex-shrink: 0;
		position: sticky;
		top: 0;
		background: inherit;
		z-index: 1;
		background: linear-gradient(
			135deg,
			var(--primary-color),
			rgba(var(--primary-color-rgb), 0.8)
		);
		color: white;
	}

	.sidebar-header h2 {
		margin: 0;
		font-size: 1.4rem;
		font-weight: 600;
		color: white;
	}

	.close-sidebar {
		background: transparent;
		border: none;
		font-size: 1.3rem;
		cursor: pointer;
		padding: 0.5rem;
		color: rgba(255, 255, 255, 0.8);
		border-radius: 50%;
		transition: all 0.2s ease;
		line-height: 1;
	}
	.close-sidebar:hover {
		background-color: rgba(255, 255, 255, 0.2);
		color: white;
	}

	.sidebar-content {
		padding: 1.2rem 1.5rem; /* Slightly more comfortable padding */
		flex-grow: 1; /* Take remaining space */
		overflow-y: auto; /* Enable scrolling for content */
	}

	.sidebar-section {
		margin-bottom: 1.2rem; /* Reduce vertical rhythm */
	}
	.section-title {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.95rem; /* Slightly larger for readability */
		font-weight: 600;
		color: var(--text-color-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin: 0 0 0.7rem 0;
	}
	.section-title .icon {
		font-size: 1em; /* Match text size */
		width: 18px; /* Fixed width for alignment */
		text-align: center;
		color: var(--text-color-secondary);
	}

	/* Select Dropdown Styling */
	.select-wrapper {
		position: relative;
		display: block; /* Take full width */
		width: 100%;
	}
	.select-wrapper select {
		width: 100%;
		padding: 0.6rem 2.2rem 0.6rem 0.8rem; /* Adjusted padding */
		border: 1px solid var(--border-color);
		border-radius: 6px;
		background-color: var(--input-background);
		color: var(--text-color);
		font-size: 0.95rem;
		appearance: none;
		cursor: pointer;
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
	}
	.select-wrapper select:focus {
		outline: none;
		border-color: var(--primary-color);
		box-shadow: 0 0 0 1px var(--primary-color);
	}
	.select-wrapper .dropdown-icon {
		position: absolute;
		right: 0.8rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-color-secondary);
		pointer-events: none;
		font-size: 0.8rem;
	}

	.divider {
		border: none;
		border-top: 1px solid var(--border-color);
		margin: 1.5rem 0;
	}

	/* Navigation Links */
	.sidebar-links {
		display: flex;
		flex-direction: column;
		margin-top: 0.5rem; /* Space above nav links */
	}

	.sidebar-links a {
		color: var(--text-color);
		text-decoration: none;
		padding: 0.6rem 0.5rem; /* Tighter vertical padding */
		margin-bottom: 0.2rem;
		border-radius: 6px;
		transition:
			background-color 0.2s ease,
			color 0.2s ease;
		display: flex;
		align-items: center;
		gap: 0.9rem;
		font-size: 0.95rem;
	}

	.sidebar-links a:hover {
		background-color: var(--hover-background);
		color: var(--primary-color); /* Highlight on hover */
	}
	.sidebar-links a .icon {
		width: 18px; /* Match section title icon width */
		text-align: center;
		font-size: 1.1em;
		color: var(--text-color-secondary);
		transition: color 0.2s ease;
	}
	.sidebar-links a:hover .icon {
		color: var(--primary-color);
	}

	/* Overlay Style */
	.overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.4); /* Darker overlay */
		z-index: 1000; /* Below sidebar */
		opacity: 0;
		transition: opacity 0.3s ease-out;
		pointer-events: none;
	}
	.sidebar.open + .overlay {
		opacity: 1;
		pointer-events: auto;
	}

	.main-content-area {
		flex-grow: 1;
		display: flex;
		flex-direction: column;
		position: relative;
		padding-bottom: 0; /* Remove bottom padding */
	}

	/* Styles for the NEW simple footer */
	.minimal-footer.simple-footer {
		text-align: center;
		padding: 1rem;
		font-size: 0.85rem;
		color: var(--text-color-secondary);
		margin-top: auto; /* Push to bottom */
		flex-shrink: 0;
		border-top: 1px solid var(--border-color);
		background-color: var(
			--card-background
		); /* Use card background or specific footer var */
	}

	/* Styles for right-aligned button */
	.header.right-aligned {
		justify-content: flex-end; /* Push button to the right */
		left: auto; /* Ensure it's positioned from the right */
		right: 0;
	}

	/* Add styles for toggle switch within sidebar */
	.sidebar .toggle-section .setting-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.2rem 0; /* Reduced padding */
	}
	.sidebar .toggle-section .toggle-label {
		flex-grow: 1;
		margin-right: 1rem;
		font-size: 0.9rem; /* Slightly smaller label */
		color: var(--text-color); /* Ensure label color */
	}

	/* Re-use toggle switch styles (consider moving to global.css if used widely) */
	.switch {
		position: relative;
		display: inline-block;
		width: 44px; /* Smaller switch */
		height: 24px;
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
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: var(--toggle-background, #ccc);
		transition: 0.3s;
	}
	.slider:before {
		position: absolute;
		content: "";
		height: 18px; /* Smaller circle */
		width: 18px;
		left: 3px;
		bottom: 3px;
		background-color: white;
		transition: 0.3s;
	}
	input:checked + .slider {
		background-color: var(--primary-color);
	}
	input:focus + .slider {
		box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.3);
	}
	input:checked + .slider:before {
		transform: translateX(20px); /* Adjust movement */
	}
	.slider.round {
		border-radius: 24px;
	}
	.slider.round:before {
		border-radius: 50%;
	}
</style>
