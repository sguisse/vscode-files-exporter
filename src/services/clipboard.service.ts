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
