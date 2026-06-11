#!/bin/bash

# Overwrite process-runner.service.ts with the optimized native ObjC wrapper logic
cat << 'EOF' > src/services/process-runner.service.ts
import { spawn, exec } from 'child_process';
import { existsSync } from 'fs';

export class ProcessRunnerService {
    public executePython(
        scriptPath: string,
        args: string[],
        onStdout: (data: string) => void,
        onStderr: (data: string) => void
    ): Promise<{ code: number, stdout: string, stderr: string }> {
        return new Promise((resolve, reject) => {
            if (!existsSync(scriptPath)) {
                return reject(new Error(`Le script moteur est introuvable à l'adresse : ${scriptPath}`));
            }

            const command = process.platform === 'win32' ? 'python' : 'python3';
            const processArgs = [scriptPath, ...args];
            const child = spawn(command, processArgs);

            let fullStdout = '';
            let fullStderr = '';

            child.stdout.on('data', (chunk) => {
                const text = chunk.toString('utf8');
                fullStdout += text;
                onStdout(text);
            });

            child.stderr.on('data', (chunk) => {
                const text = chunk.toString('utf8');
                fullStderr += text;
                onStderr(text);
            });

            child.on('close', (code) => resolve({ code: code ?? 0, stdout: fullStdout, stderr: fullStderr }));
            child.on('error', (err) => reject(err));
        });
    }

    /**
     * Copies an array of absolute file paths to the native OS clipboard and poll-verifies their presence.
     * @param filePaths Array of absolute paths to copy.
     * @param timeoutMs Maximum polling time allowed for validation.
     */
    public copyFilesToClipboard(filePaths: string[], timeoutMs: number = 10000): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // Buffer delay to ensure APFS/NTFS disk controllers have flushed all file generation
            setTimeout(() => {
                const platform = process.platform;
                let writePromise: Promise<void>;

                if (platform === 'darwin') {
                    writePromise = new Promise((res, rej) => {
                        const jxaScript = `
                            ObjC.import('AppKit');
                            var pb = $.NSPasteboard.generalPasteboard;
                            var changeCount = pb.clearContents;

                            var paths = ${JSON.stringify(filePaths)};
                            // ✨ The Magic Bullet: ObjC.wrap() pushes the entire array to Objective-C memory atomically
                            // Bypassing JS iteration limits and preventing truncation of large file arrays.
                            pb.setPropertyListForType(ObjC.wrap(paths), 'NSFilenamesPboardType');
                        `.trim().replace(/'/g, "'\\''");

                        exec(`osascript -l JavaScript -e '${jxaScript}'`, (err) => err ? rej(err) : res());
                    });
                } else if (platform === 'win32') {
                    writePromise = new Promise((res, rej) => {
                        const pathsStr = filePaths.map(p => `'${p.replace(/'/g, "''")}'`).join(',');
                        exec(`powershell.exe -NoProfile -Command "Set-Clipboard -LiteralPath ${pathsStr}"`, (err) => err ? rej(err) : res());
                    });
                } else {
                    writePromise = new Promise((res, rej) => {
                        const uriList = filePaths.map(p => `file://${p}`).join('\n');
                        const proc = exec(`xclip -selection clipboard -t text/uri-list -i`, (err) => err ? rej(err) : res());
                        proc.stdin?.write(uriList);
                        proc.stdin?.end();
                    });
                }

                // Execute non-blocking asynchronous verification polling loop
                writePromise.then(() => {
                    const startTime = Date.now();
                    const intervalTime = 250;
                    let lastActualCount = 0;

                    const poll = async () => {
                        const { verified, actualCount } = await this.verifyClipboard(filePaths);
                        lastActualCount = actualCount;

                        if (verified) {
                            resolve();
                        } else if (Date.now() - startTime >= timeoutMs) {
                            // ✨ Improved error log reports exactly how many files were successfully bridged
                            reject(new Error(`Clipboard verification timed out after ${timeoutMs}ms. Expected ${filePaths.length} files, but found ${lastActualCount} in the OS clipboard cache.`));
                        } else {
                            setTimeout(poll, intervalTime);
                        }
                    };

                    setTimeout(poll, 150);
                }).catch(reject);
            }, 800); // ✨ Increased disk flush buffer to 800ms for safety on large batches
        });
    }

    /**
     * Reads back the OS clipboard data structure to verify if all expected file paths are present.
     */
    private verifyClipboard(expectedPaths: string[]): Promise<{ verified: boolean, actualCount: number }> {
        return new Promise((resolve) => {
            const platform = process.platform;

            // Centralized path normalizer to handle URI encoding and separator mismatches securely
            const normalize = (p: string) => {
                let clean = p.toLowerCase().replace(/^file:\/\//, '');
                try { clean = decodeURIComponent(clean); } catch {}
                return clean.replace(/\\/g, '/').replace(/\/+$/, '');
            };
            const expectedSet = new Set(expectedPaths.map(normalize));

            if (platform === 'darwin') {
                const checkScript = `
                    ObjC.import('AppKit');
                    var pb = $.NSPasteboard.generalPasteboard;
                    var pl = pb.propertyListForType('NSFilenamesPboardType');
                    // ✨ ObjC.deepUnwrap converts the native C-array cleanly back into a standard JS array
                    JSON.stringify(ObjC.deepUnwrap(pl) || []);
                `.trim().replace(/'/g, "'\\''");

                exec(`osascript -l JavaScript -e '${checkScript}'`, (err, stdout) => {
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

# Trigger application compilation
npm run compile
