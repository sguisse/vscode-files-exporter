#!/bin/bash

# 1. Écriture du script Python (JXA via stdin : Contourne les limites de taille et évite les doublons)
cat << 'EOF' > scripts/copy-files-to-clipboard.py
#!/usr/bin/env python3
import sys
import os
import json
import subprocess

def copyFilesToClipboard(filePaths):
    if not filePaths:
        return

    platform = sys.platform
    if platform == 'darwin':
        # JXA pur via stdin : Évite les doublons (1 seul writeObjects) et contourne les limites de taille shell
        jxa_script = f"""
        ObjC.import('AppKit');
        var pb = $.NSPasteboard.generalPasteboard;
        pb.clearContents;

        var paths = {json.dumps(filePaths)};
        var urls = $.NSMutableArray.alloc.init;
        for (var i = 0; i < paths.length; i++) {{
            urls.addObject($.NSURL.fileURLWithPath(paths[i]));
        }}

        // Use strictly NSURL objects to prevent Finder duplications
        pb.writeObjects(urls);

        // Keep process alive momentarily to let the OS Pasteboard server absorb the data
        $.NSThread.sleepForTimeInterval(0.5);
        """

        subprocess.run(['osascript', '-l', 'JavaScript', '-'], input=jxa_script.encode('utf-8'), check=True)

    elif platform == 'win32':
        paths_str = ",".join([f"'{p.replace(chr(39), chr(39)+chr(39))}'" for p in filePaths])
        cmd = f"Set-Clipboard -LiteralPath {paths_str}"
        subprocess.run(["powershell.exe", "-NoProfile", "-Command", cmd], check=True)

    else:
        uris = "\n".join([f"file://{p}" for p in filePaths])
        subprocess.run(["xclip", "-selection", "clipboard", "-t", "text/uri-list", "-i"], input=uris.encode('utf-8'), check=True)

def main():
    if len(sys.argv) < 2:
        sys.exit(1)

    input_file = sys.argv[1]
    if not os.path.exists(input_file):
        sys.exit(1)

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            file_paths = json.load(f)

        copyFilesToClipboard(file_paths)
        print(f"✅ Successfully copied {len(file_paths)} file(s) to the OS clipboard.")
    except Exception as e:
        print(f"Error copying to clipboard: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
EOF

# 2. Remplacement du ClipboardService TS (Vérification propre, non-bloquante via fichier temp)
cat << 'EOF' > src/services/clipboard.service.ts
import { exec } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export class ClipboardService {
    public async copyFilesToClipboard(filePaths: string[], timeoutMs: number = 10000): Promise<string> {
        await this.waitForFileSystemStabilization(filePaths);

        return new Promise<string>((resolve, reject) => {
            const tmpFile = path.join(os.tmpdir(), `fe-paths-${Date.now()}.json`);
            fs.writeFileSync(tmpFile, JSON.stringify(filePaths), 'utf8');

            let currentDir = __dirname;
            let scriptPath = '';
            while (currentDir !== path.dirname(currentDir)) {
                const testPath = path.join(currentDir, 'scripts', 'copy-files-to-clipboard.py');
                if (fs.existsSync(testPath)) {
                    scriptPath = testPath;
                    break;
                }
                currentDir = path.dirname(currentDir);
            }

            if (!scriptPath) {
                try { fs.unlinkSync(tmpFile); } catch (e) {}
                return reject(new Error("Could not locate scripts/copy-files-to-clipboard.py"));
            }

            const command = process.platform === 'win32' ? 'python' : 'python3';
            const fullCommand = `"${command}" "${scriptPath}" "${tmpFile}"`;

            exec(fullCommand, (err, stdout, stderr) => {
                try { fs.unlinkSync(tmpFile); } catch (e) {}

                if (err) {
                    return reject(new Error(`Python clipboard script failed: ${stderr || err.message}`));
                }

                const startTime = Date.now();
                const intervalTime = 250;
                let lastActualCount = 0;

                const poll = async () => {
                    const { verified, actualCount } = await this.verifyClipboard(filePaths);
                    lastActualCount = actualCount;

                    if (verified) {
                        resolve(stdout ? stdout.trim() : "");
                    } else if (Date.now() - startTime >= timeoutMs) {
                        reject(new Error(`Clipboard verification timed out. Expected ${filePaths.length} files, but found ${lastActualCount} in the OS clipboard cache.`));
                    } else {
                        setTimeout(poll, intervalTime);
                    }
                };

                setTimeout(poll, 150);
            });
        });
    }

    private async waitForFileSystemStabilization(paths: string[]): Promise<void> {
        for (const p of paths) {
            for (let i = 0; i < 20; i++) {
                try {
                    const stat = await fs.promises.stat(p);
                    if (stat.size >= 0) break;
                } catch {
                    // Ignore missing files until buffer clears
                }
                await new Promise(r => setTimeout(r, 100));
            }
        }
    }

    private verifyClipboard(expectedPaths: string[]): Promise<{ verified: boolean, actualCount: number }> {
        return new Promise((resolve) => {
            const platform = process.platform;
            const normalize = (p: string) => {
                let clean = p.toLowerCase().replace(/^file:\/\//, '');
                try { clean = decodeURIComponent(clean); } catch {}
                return clean.replace(/\\/g, '/').replace(/\/+$/, '');
            };
            const expectedSet = new Set(expectedPaths.map(normalize));

            if (platform === 'darwin') {
                const tmpFile = path.join(os.tmpdir(), `fe-verify-${Date.now()}.js`);
                // Match the Python writing logic: Read NSURL classes accurately
                const checkScript = `
                    ObjC.import('AppKit');
                    var pb = $.NSPasteboard.generalPasteboard;
                    var classes = $.NSArray.arrayWithObject($.NSURL.class);
                    var urls = pb.readObjectsForClassesOptions(classes, $());
                    var res = [];
                    if (urls != undefined) {
                        for (var i = 0; i < urls.count; i++) {
                            var url = urls.objectAtIndex(i);
                            if (url && url.path) res.push(url.path.js);
                        }
                    }
                    JSON.stringify(res);
                `;
                fs.writeFileSync(tmpFile, checkScript, 'utf8');

                exec(`osascript -l JavaScript "${tmpFile}"`, (err, stdout) => {
                    try { fs.unlinkSync(tmpFile); } catch (e) {}
                    if (err || !stdout.trim()) return resolve({ verified: false, actualCount: 0 });
                    try {
                        const actualPaths = JSON.parse(stdout.trim()) as string[];
                        const actualSet = new Set(actualPaths.map(normalize));
                        const verified = Array.from(expectedSet).every(p => actualSet.has(p));
                        resolve({ verified, actualCount: actualSet.size });
                    } catch { resolve({ verified: false, actualCount: 0 }); }
                });
            } else if (platform === 'win32') {
                exec(`powershell.exe -NoProfile -Command "(Get-Clipboard -Format FileDropList).Path | ConvertTo-Json -Compress"`, (err, stdout) => {
                    if (err || !stdout.trim()) return resolve({ verified: false, actualCount: 0 });
                    try {
                        let actualPaths = JSON.parse(stdout.trim());
                        if (!Array.isArray(actualPaths)) actualPaths = [actualPaths];
                        const actualSet = new Set(actualPaths.map(normalize));
                        const verified = Array.from(expectedSet).every(p => actualSet.has(p));
                        resolve({ verified, actualCount: actualSet.size });
                    } catch { resolve({ verified: false, actualCount: 0 }); }
                });
            } else {
                exec(`xclip -selection clipboard -o -t text/uri-list`, (err, stdout) => {
                    if (err || !stdout.trim()) return resolve({ verified: false, actualCount: 0 });
                    const actualPaths = stdout.split('\n').filter(Boolean);
                    const actualSet = new Set(actualPaths.map(normalize));
                    const verified = Array.from(expectedSet).every(p => actualSet.has(p));
                    resolve({ verified, actualCount: actualSet.size });
                });
            }
        });
    }
}
EOF

echo "✅ Fichiers mis à jour : Les doublons sont éliminés, la vérification est corrigée, et la surcharge de console (Extension Host crash) a été nettoyée !"
