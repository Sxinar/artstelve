import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const itemsDir = path.resolve('static/plugins');

    if (!fs.existsSync(itemsDir)) {
        return json({ plugins: [] });
    }

    try {
        const items = fs.readdirSync(itemsDir);
        const localPlugins = items
            .filter(item => fs.statSync(path.join(itemsDir, item)).isDirectory())
            .map(folder => {
                const configPath = path.join(itemsDir, folder, 'plugin.json');
                let name = folder;
                let author = 'Local';

                if (fs.existsSync(configPath)) {
                    try {
                        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                        name = config.name || name;
                        author = config.author || author;
                    } catch (e) {
                        console.error(`Error reading context for plugin ${folder}:`, e);
                    }
                }

                return {
                    id: folder,
                    name: name,
                    author: author,
                    isLocal: true
                };
            });

        return json({ plugins: localPlugins });
    } catch (err) {
        console.error('[API Plugins] Error reading directory:', err);
        return json({ plugins: [], error: err.message });
    }
}
