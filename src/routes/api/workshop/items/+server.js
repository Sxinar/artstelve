import { json } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Dirent } from 'node:fs'; // Import Dirent for type checking

// Read the external workshop path from environment variable
const WORKSHOP_BASE_PATH = process.env.WORKSHOP_PATH;

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

    if (!WORKSHOP_BASE_PATH) {
        console.error('[API Workshop] WORKSHOP_PATH environment variable is not set.');
        // Return empty lists instead of erroring out, frontend can handle this
        return json({ themes: [], plugins: [] });
        // Or return an error:
        // return json({ error: 'Workshop path not configured on the server.' }, { status: 500 });
    }

    console.log(`[API Workshop] Reading workshop items from: ${WORKSHOP_BASE_PATH}`);

    const themesPath = path.join(WORKSHOP_BASE_PATH, 'themes');
    const pluginsPath = path.join(WORKSHOP_BASE_PATH, 'plugins');

    try {
        const themeManifests = await findManifests(themesPath);
        const pluginManifests = await findManifests(pluginsPath);

        console.log(`[API Workshop] Found ${themeManifests.length} themes and ${pluginManifests.length} plugins.`);

        return json({
            themes: themeManifests,
            plugins: pluginManifests
        });

    } catch (error) {
        // This catch might be redundant if findManifests handles its errors, 
        // but good for catching potential top-level issues.
        console.error('[API Workshop] Unexpected error fetching workshop items:', error);
        return json({ error: 'Failed to fetch workshop items.', details: error.message }, { status: 500 });
    }
} 