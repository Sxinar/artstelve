import { json } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Dirent } from 'node:fs'; // Import Dirent for type checking

// Configuration: local path or remote URL
// Prefer WORKSHOP_URL (remote), fallback to WORKSHOP_PATH (local), then to user's HOME/artadosearch/workshop
const WORKSHOP_BASE_URL = process.env.WORKSHOP_URL || 'https://artadosearch.com/workshop';
const envPath = process.env.WORKSHOP_PATH;
const HOME_DIR = process.env.USERPROFILE || process.env.HOME || '';
const DEFAULT_WORKSHOP_PATH = HOME_DIR ? path.join(HOME_DIR, 'artadosearch', 'workshop') : null;
const WORKSHOP_BASE_PATH = envPath || DEFAULT_WORKSHOP_PATH;

function isRemoteConfigured() {
    return !!WORKSHOP_BASE_URL && /^https?:\/\//i.test(WORKSHOP_BASE_URL);
}

async function fetchJson(url) {
    try {
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.warn('[API Workshop] Failed to fetch JSON:', url, e);
        return null;
    }
}

// Remote listing helper: expects an index listing of slugs or objects
async function listRemoteItems(baseUrl, type /* 'themes' | 'plugins' */) {
    const results = [];
    // Try multiple index conventions
    const candidateIndexes = [
        `${baseUrl}/${type}/index.json`,
        `${baseUrl}/${type}.json`,
        `${baseUrl}/index.json`
    ];
    let indexData = null;
    for (const idxUrl of candidateIndexes) {
        indexData = await fetchJson(idxUrl);
        if (indexData) break;
    }
    if (!indexData) {
        console.warn(`[API Workshop] No remote index found for ${type} at ${baseUrl}`);
        return [];
    }
    // Normalize list of slugs or objects
    const items = Array.isArray(indexData[type]) ? indexData[type] : (Array.isArray(indexData) ? indexData : []);
    for (const entry of items) {
        let manifestUrl;
        if (typeof entry === 'string') {
            manifestUrl = `${baseUrl}/${type}/${entry}/manifest.json`;
        } else if (entry && typeof entry === 'object') {
            if (entry.manifest) manifestUrl = entry.manifest;
            else if (entry.slug) manifestUrl = `${baseUrl}/${type}/${entry.slug}/manifest.json`;
            else if (entry.path) manifestUrl = `${baseUrl}/${entry.path.replace(/^\//,'')}/manifest.json`;
        }
        if (!manifestUrl) continue;
        const manifest = await fetchJson(manifestUrl);
        if (manifest && manifest.id && manifest.name && manifest.type && manifest.version) {
            manifest.directoryPath = manifestUrl.replace(/\/manifest\.json$/, '');
            results.push(manifest);
        }
    }
    return results;
}

async function readManifest(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const manifest = JSON.parse(content);
        // Basic validation (add more checks as needed)
        if (manifest.id && manifest.name && manifest.type && manifest.version) {
             // Add the directory path to the manifest data for potential future use
             manifest.directoryPath = path.dirname(filePath); 
             return manifest;
        } else {
             console.warn(`[API Workshop] Invalid or incomplete manifest: ${filePath}`);
             return null;
        }
    } catch (error) {
        console.error(`[API Workshop] Error reading or parsing manifest ${filePath}:`, error);
        return null;
    }
}

async function findManifests(dirPath) {
    let items = [];
    try {
        // Check if directory exists
        try {
             await fs.access(dirPath);
        } catch (accessError) {
             console.warn(`[API Workshop] Directory not accessible or does not exist: ${dirPath}`);
             return []; // Return empty if base directory doesn't exist
        }

        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const itemDirPath = path.join(dirPath, entry.name);
                const manifestPath = path.join(itemDirPath, 'manifest.json');
                try {
                    // Check if manifest.json exists
                    await fs.access(manifestPath);
                    const manifestData = await readManifest(manifestPath);
                    if (manifestData) {
                        items.push(manifestData);
                    }
                } catch (manifestAccessError) {
                    // Manifest doesn't exist in this directory, skip it
                    // console.log(`[API Workshop] No manifest found in ${itemDirPath}, skipping.`);
                }
            }
        }
    } catch (error) {
        console.error(`[API Workshop] Error reading directory ${dirPath}:`, error);
        // Don't throw, return empty array or partial results if desired
        // return []; 
    }
    return items;
}

export async function GET() {
    console.log("[API LIFECYCLE] GET /api/workshop/items endpoint hit!");

    // Remote-first
    if (isRemoteConfigured()) {
        console.log(`[API Workshop] Reading remote workshop from: ${WORKSHOP_BASE_URL}`);
        try {
            const [themesRemote, pluginsRemote] = await Promise.all([
                listRemoteItems(WORKSHOP_BASE_URL, 'themes'),
                listRemoteItems(WORKSHOP_BASE_URL, 'plugins')
            ]);
            if ((themesRemote?.length ?? 0) > 0 || (pluginsRemote?.length ?? 0) > 0) {
                return json({ themes: themesRemote, plugins: pluginsRemote });
            }
        } catch (e) {
            console.warn('[API Workshop] Remote workshop fetch failed, will try local fallback.', e);
        }
    }

    // Local fallback
    if (!WORKSHOP_BASE_PATH) {
        console.error('[API Workshop] No local workshop path configured. Returning empty list.');
        return json({ themes: [], plugins: [] });
    }
    console.log(`[API Workshop] Reading workshop items from local path: ${WORKSHOP_BASE_PATH}`);
    const themesPath = path.join(WORKSHOP_BASE_PATH, 'themes');
    const pluginsPath = path.join(WORKSHOP_BASE_PATH, 'plugins');
    try {
        const [themeManifests, pluginManifests] = await Promise.all([
            findManifests(themesPath),
            findManifests(pluginsPath)
        ]);
        console.log(`[API Workshop] Found ${themeManifests.length} themes and ${pluginManifests.length} plugins.`);
        return json({ themes: themeManifests, plugins: pluginManifests });
    } catch (error) {
        console.error('[API Workshop] Unexpected error fetching workshop items:', error);
        return json({ error: 'Failed to fetch workshop items.', details: error.message }, { status: 500 });
    }
} 