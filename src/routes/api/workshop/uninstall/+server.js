import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';

export async function POST({ request }) {
    try {
        const { id, type } = await request.json();

        if (!id || !type) {
            return json({ success: false, error: 'Eksik parametreler.' }, { status: 400 });
        }

        const targetBaseDir = path.resolve(type === 'theme' ? 'static/themes' : 'static/plugins');
        const targetDir = path.join(targetBaseDir, id);

        if (fs.existsSync(targetDir)) {
            // Remove directory and its contents
            fs.rmSync(targetDir, { recursive: true, force: true });
            console.log(`[API Uninstall] Removed ${type}: ${id}`);
            return json({ success: true, message: 'Başarıyla silindi.' });
        } else {
            return json({ success: false, error: 'Dosya bulunamadı.' }, { status: 404 });
        }
    } catch (err) {
        console.error('[API Uninstall] Error:', err);
        return json({ success: false, error: err.message }, { status: 500 });
    }
}
