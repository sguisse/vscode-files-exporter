import { spawn, exec, ChildProcess } from 'child_process';
import { existsSync } from 'fs';

export class ProcessRunnerService {
    private activeProcesses: Map<string, ChildProcess> = new Map();

    public executePython(
        scriptPath: string,
        args: string[],
        onStdout: (data: string) => void,
        onStderr: (data: string) => void
    ): Promise<{ code: number | null, signal: string | null, stdout: string, stderr: string }> {
        return new Promise((resolve, reject) => {
            if (!existsSync(scriptPath)) {
                return reject(new Error(`Le script moteur est introuvable à l'adresse : ${scriptPath}`));
            }

            const command = process.platform === 'win32' ? 'python' : 'python3';
            const processArgs = [scriptPath, ...args];
            const child = spawn(command, processArgs);

            const processTrackingKey = scriptPath;
            this.activeProcesses.set(processTrackingKey, child);

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

            // Capture both termination exit code and close signals atomically without masking overrides
            child.on('close', (code, signal) => {
                this.activeProcesses.delete(processTrackingKey);
                resolve({ code, signal, stdout: fullStdout, stderr: fullStderr });
            });

            child.on('error', (err) => {
                this.activeProcesses.delete(processTrackingKey);
                reject(err);
            });
        });
    }

    public killActivePythonScript(scriptPath: string): boolean {
        const child = this.activeProcesses.get(scriptPath);
        if (child) {
            child.kill('SIGKILL');
            this.activeProcesses.delete(scriptPath);
            return true;
        }
        return false;
    }

    public copyFilesToClipboard(filePaths: string[], timeoutMs: number = 10000): Promise<void> {
        return new Promise<void>((resolve, reject) => {
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
                            reject(new Error(`Clipboard verification timed out after ${timeoutMs}ms. Expected ${filePaths.length} files, but found ${lastActualCount} in the OS clipboard cache.`));
                        } else {
                            setTimeout(poll, intervalTime);
                        }
                    };

                    setTimeout(poll, 150);
                }).catch(reject);
            }, 800);
        });
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
                const checkScript = `
                    ObjC.import('AppKit');
                    var pb = $.NSPasteboard.generalPasteboard;
                    var pl = pb.propertyListForType('NSFilenamesPboardType');
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
