import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const themesDir = path.resolve('static/themes');

    if (!fs.existsSync(themesDir)) {
        return json({ themes: [] });
    }

    try {
        const items = fs.readdirSync(themesDir);
        const localThemes = items
            .filter(item => fs.statSync(path.join(themesDir, item)).isDirectory())
            .map(folder => {
                const configPath = path.join(themesDir, folder, 'theme.json');
                let name = folder;
                let author = 'Local';

                // If a theme.json exists, we can get more info
                if (fs.existsSync(configPath)) {
                    try {
                        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                        name = config.name || name;
                        author = config.author || author;
                    } catch (e) {
                        console.error(`Error reading context for theme ${folder}:`, e);
                    }
                }

                return {
                    id: folder,
                    name: name,
                    author: author,
                    path: `/themes/${folder}/${folder}.css`, // Standard path for CSS
                    isLocal: true
                };
            });

        return json({ themes: localThemes });
    } catch (err) {
        console.error('[API Themes] Error reading directory:', err);
        return json({ themes: [], error: err.message });
    }
}
