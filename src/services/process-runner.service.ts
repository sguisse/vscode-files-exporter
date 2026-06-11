import { spawn, exec } from 'child_process'; // ✨ Added exec import
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
     * Supports macOS (via JXA), Windows (via PowerShell LiteralPath), and Linux (via xclip).
     * @param filePaths Array of absolute paths to copy.
     * @param timeoutMs Maximum polling time allowed for validation before throwing an exception error.
     */
    public copyFilesToClipboard(filePaths: string[], timeoutMs: number = 10000): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const platform = process.platform;
            let writePromise: Promise<void>;

            // Step 1: Write file payloads to the native clipboard stack
            if (platform === 'darwin') {
                writePromise = new Promise((res, rej) => {
                    const jxaScript = `
                        ObjC.import('AppKit');
                        var pb = $.NSPasteboard.generalPasteboard;
                        var changeCount = pb.clearContents;
                        var paths = ${JSON.stringify(filePaths)};
                        var nsArray = $.NSMutableArray.alloc.init;
                        for (var i = 0; i < paths.length; i++) {
                            nsArray.addObject($.NSURL.fileURLWithPath(paths[i]));
                        }
                        pb.writeObjects(nsArray);
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

            // Step 2: Execute non-blocking asynchronous verification polling loop
            writePromise.then(() => {
                const startTime = Date.now();
                const intervalTime = 250; // Verification check interval spacing execution footprint

                const poll = async () => {
                    const isVerified = await this.verifyClipboard(filePaths);
                    if (isVerified) {
                        resolve(); // Success: All target file paths confirmed in clipboard registry cache
                    } else if (Date.now() - startTime >= timeoutMs) {
                        reject(new Error(`Clipboard verification timed out after ${timeoutMs}ms. Expected ${filePaths.length} files, but the OS clipboard payload cache is incomplete.`));
                    } else {
                        setTimeout(poll, intervalTime); // Asynchronously schedule next non-blocking check pass
                    }
                };

                setTimeout(poll, 100); // Initial quick buffer pass delay to handle disk write flushes
            }).catch(reject);
        });
    }

    /**
     * Reads back the OS clipboard data structure to verify if all expected file paths are present.
     */
    private verifyClipboard(expectedPaths: string[]): Promise<boolean> {
        return new Promise((resolve) => {
            const platform = process.platform;

            if (platform === 'darwin') {
                const checkScript = `
                    ObjC.import('AppKit');
                    var pl = $.NSPasteboard.generalPasteboard.propertyListForType('NSFilenamesPboardType');
                    var out = [];
                    if (pl && pl.count) {
                        for (var i = 0; i < pl.count; i++) { out.push(String(pl.objectAtIndex(i))); }
                    }
                    JSON.stringify(out);
                `.trim().replace(/'/g, "'\\''");

                exec(`osascript -l JavaScript -e '${checkScript}'`, (err, stdout) => {
                    if (err || !stdout.trim()) return resolve(false);
                    try {
                        const actualPaths = JSON.parse(stdout.trim()) as string[];
                        const actualSet = new Set(actualPaths.map(p => p.toLowerCase()));
                        resolve(expectedPaths.every(p => actualSet.has(p.toLowerCase())));
                    } catch { resolve(false); }
                });
            } else if (platform === 'win32') {
                exec(`powershell.exe -NoProfile -Command "(Get-Clipboard -Format FileDropList).Path | ConvertTo-Json -Compress"`, (err, stdout) => {
                    if (err || !stdout.trim()) return resolve(false);
                    try {
                        let actualPaths = JSON.parse(stdout.trim());
                        if (!Array.isArray(actualPaths)) actualPaths = [actualPaths]; // Handle singular return objects safely
                        const actualSet = new Set(actualPaths.map((p: string) => p.toLowerCase()));
                        resolve(expectedPaths.every(p => actualSet.has(p.toLowerCase())));
                    } catch { resolve(false); }
                });
            } else {
                exec(`xclip -selection clipboard -o -t text/uri-list`, (err, stdout) => {
                    if (err || !stdout.trim()) return resolve(false);
                    const actualPaths = stdout.split('\n')
                        .map(line => line.trim().replace(/^file:\/\//, ''))
                        .filter(Boolean);
                    const actualSet = new Set(actualPaths.map(p => p.toLowerCase()));
                    resolve(expectedPaths.every(p => actualSet.has(p.toLowerCase())));
                });
            }
        });
    }

}
