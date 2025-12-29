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

        // Define target directory relative to current working directory (project root)
        // We put themes in 'themes' folder and plugins in 'plugins' folder in the root
        const targetBaseDir = path.resolve(type === 'theme' ? 'themes' : 'plugins');

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
        }

    } catch (err) {
        console.error('[API Install] Installation error:', err);
        return json({ success: false, error: err.message }, { status: 500 });
    }
}
