import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const themesDir = path.resolve('static/themes');
    const homeThemesDir = path.join(themesDir, 'home');

    if (!fs.existsSync(themesDir)) {
        return json({ themes: [] });
    }

    try {
        const getThemesFromDir = (dir, isHome = false) => {
            if (!fs.existsSync(dir)) return [];
            return fs.readdirSync(dir)
                .filter(item => fs.statSync(path.join(dir, item)).isDirectory())
                .map(folder => {
                    const configPath = path.join(dir, folder, 'theme.json');
                    let name = folder;
                    let author = 'Local';
                    let category = isHome ? 'home' : 'site';

                    if (fs.existsSync(configPath)) {
                        try {
                            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                            name = config.name || name;
                            author = config.author || author;
                            category = config.category || category;
                        } catch (e) {
                            console.error(`Error reading config for theme ${folder}:`, e);
                        }
                    }

                    return {
                        id: folder,
                        name: name,
                        author: author,
                        category: category,
                        path: isHome ? `/themes/home/${folder}/${folder}.css` : `/themes/${folder}/${folder}.css`,
                        isLocal: true
                    };
                });
        };

        const generalThemes = getThemesFromDir(themesDir).filter(t => t.id !== 'home');
        const homeThemes = getThemesFromDir(homeThemesDir, true);

        return json({ themes: [...generalThemes, ...homeThemes] });
    } catch (err) {
        console.error('[API Themes] Error:', err);
        return json({ themes: [], error: err.message });
    }
}
