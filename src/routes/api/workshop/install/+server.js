import { json } from '@sveltejs/kit';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST({ request }) {
    try {
        const { downloadUrl, type, name, id } = await request.json();

        if (!downloadUrl || !type || !name) {
            return json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

        console.log(`[API Install] Request to install ${type}: ${name} from ${downloadUrl}`);

<<<<<<< HEAD
        // Define target directory relative to current working directory (project root)
        // We put themes in 'themes' folder and plugins in 'plugins' folder in the root
        const targetBaseDir = path.resolve(type === 'theme' ? 'themes' : 'plugins');
=======
        // We put themes in 'static/themes' folder and plugins in 'static/plugins' folder
        const targetBaseDir = path.resolve(type === 'theme' ? 'static/themes' : 'static/plugins');
>>>>>>> 7f9df2b (İlk commit)

        // Create base directory if it doesn't exist
        if (!fs.existsSync(targetBaseDir)) {
            fs.mkdirSync(targetBaseDir, { recursive: true });
        }

        const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const targetDir = path.join(targetBaseDir, safeName);

        // Create target directory for this item
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

<<<<<<< HEAD
        const tempFilePath = path.join(targetDir, `${safeName}.zip`);

        // Fetch the file
        const response = await fetch(downloadUrl);
        if (!response.ok) {
            throw new Error(`Download failed: ${response.statusText}`);
        }

        // Save to file
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(tempFilePath, buffer);

        console.log(`[API Install] Downloaded to ${tempFilePath}`);

        // Extract using PowerShell (Windows)
        try {
            console.log(`[API Install] Extracting...`);
            // Escape paths for PowerShell
            const psCmd = `powershell -command "Expand-Archive -Force '${tempFilePath}' '${targetDir}'"`;
            await execAsync(psCmd);

            // Delete the zip file after extraction
            fs.unlinkSync(tempFilePath);

            return json({ success: true, message: 'Successfully installed' });
        } catch (extractErr) {
            console.error('[API Install] Extraction failed:', extractErr);
            // Decide whether to keep the zip or not. Let's keep it if extraction failed so user can manually unzip.
            return json({ success: true, message: 'Downloaded, but auto-extraction failed.', path: tempFilePath });
=======
        // Determine extension from downloadUrl
        const urlObj = new URL(downloadUrl);
        const urlPath = urlObj.pathname;
        let ext = path.extname(urlPath) || (type === 'theme' ? '.css' : '.js');

        const isZip = ext.toLowerCase() === '.zip';
        const tempFileName = isZip ? `${safeName}.zip` : `${safeName}${ext}`;
        const tempFilePath = path.join(targetDir, tempFileName);

        console.log(`[API Install] Target file: ${tempFilePath}`);

        // --- ENTEGRE ÇÖZÜM: Önce Yerel Dosya Sistemini Dene ---
        // Madem dosya aynı makinede, internete çıkmadan doğrudan kopyalayalım.
        const workspaceBase = 'c:/Users/Semih/Desktop/l/artstelve/devs';
        const devsPathPattern = /\/public\/uploads\/.*/;
        const match = urlPath.match(devsPathPattern);

        let success = false;
        if (match) {
            const localPath = path.join(workspaceBase, match[0]);
            if (fs.existsSync(localPath)) {
                console.log(`[API Install] Local file found at ${localPath}. Copying direct...`);
                fs.copyFileSync(localPath, tempFilePath);
                success = true;
            }
        }

        // --- İnternet Üzerinden İndirme (Fallback) ---
        if (!success) {
            console.log(`[API Install] Local file not found or path mismatch. Fetching from URL: ${downloadUrl}`);
            const response = await fetch(downloadUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 ArtstelveInstaller/1.0' }
            });

            if (response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && !contentType.includes('text/html')) {
                    const arrayBuffer = await response.arrayBuffer();
                    fs.writeFileSync(tempFilePath, Buffer.from(arrayBuffer));
                    success = true;
                } else if (contentType && contentType.includes('text/html')) {
                    const htmlContent = await response.text();
                    console.error('[API Install] Received HTML error page.');
                    return json({ success: false, error: 'Sunucu hata sayfası döndürdü. Dosya bulunamadı.' }, { status: 500 });
                }
            }
        }

        if (!success) {
            return json({ success: false, error: 'Dosya kopyalanamadı veya indirilemedi.' }, { status: 500 });
        }

        // If it's a ZIP file, extract it
        if (isZip) {
            try {
                console.log(`[API Install] Extracting ZIP...`);
                // Escape paths for PowerShell
                const psCmd = `powershell -command "Expand-Archive -Force '${tempFilePath}' '${targetDir}'"`;
                await execAsync(psCmd);
                fs.unlinkSync(tempFilePath);
                return json({ success: true, message: 'Successfully installed and extracted' });
            } catch (extractErr) {
                console.error('[API Install] Extraction failed:', extractErr);
                return json({ success: true, message: 'Downloaded, but auto-extraction failed.', path: tempFilePath });
            }
        } else {
            // It's a single file
            console.log(`[API Install] Single file detected (${ext}).`);

            // For themes, if the file isn't named [safeName].css, try to make it work
            if (type === 'theme' && ext.toLowerCase() === '.css' && tempFileName !== `${safeName}.css`) {
                const targetFilename = path.join(targetDir, `${safeName}.css`);
                if (!fs.existsSync(targetFilename)) {
                    fs.copyFileSync(tempFilePath, targetFilename);
                }
            }

            return json({ success: true, message: 'Successfully installed' });
>>>>>>> 7f9df2b (İlk commit)
        }

    } catch (err) {
        console.error('[API Install] Installation error:', err);
        return json({ success: false, error: err.message }, { status: 500 });
    }
}
