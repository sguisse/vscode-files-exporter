import { spawn, exec } from 'child_process'; // ✨ Added exec import
import { existsSync } from 'fs';

// 🕒 1 second timeout to ensure file system flush before clipboard access
// If users report clipboard issues, we can consider making this adaptive based on file system events or platform-specific behaviors.
const COPY_FILES_TO_CLIPBOARD_TIMEOUT = 1000;

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
     * Copies an array of absolute file paths to the native OS clipboard.
     * Supports macOS (via JXA), Windows (via PowerShell LiteralPath), and Linux (via xclip).
     */
    public copyFilesToClipboard(filePaths: string[]): Promise<void> {
        return new Promise<void>((resolve, reject) => {

            // 🕒 TEMPO : Safety delay of 1000ms.
            //Allow time for the file system (APFS/NTFS) to completely flush
            //file descriptors before the OS clipboard attempts to validate them.
            setTimeout(() => {
                const platform = process.platform;

                if (platform === 'darwin') {
                    // ✨ Modern macOS approach: Using writeObjects and NSURL
                    const jxaScript = `
                                            ObjC.import('AppKit');
                                            var pb = $.NSPasteboard.generalPasteboard;
                                            var changeCount = pb.clearContents;

                                            var paths = ${JSON.stringify(filePaths)};
                                            // Explicitly creating a native Objective-C array to avoid JXA conversion bugs
                                            var nsArray = $.NSMutableArray.alloc.init;

                                            for (var i = 0; i < paths.length; i++) {
                                                var url = $.NSURL.fileURLWithPath(paths[i]);
                                                nsArray.addObject(url);
                                            }

                                            // writeObjects ensures that Finder recognizes each URL as a physical file to paste
                                            pb.writeObjects(nsArray);
                                      `.trim().replace(/'/g, "'\\''");

                    exec(`osascript -l JavaScript -e '${jxaScript}'`, (err) => {
                        if (err) reject(err); else resolve();
                    });
                } else if (platform === 'win32') {
                    const pathsStr = filePaths.map(p => `'${p.replace(/'/g, "''")}'`).join(',');
                    exec(`powershell.exe -NoProfile -Command "Set-Clipboard -LiteralPath ${pathsStr}"`, (err) => {
                        if (err) reject(err); else resolve();
                    });
                } else {
                    const uriList = filePaths.map(p => `file://${p}`).join('\n');
                    const proc = exec(`xclip -selection clipboard -t text/uri-list -i`, (err) => {
                        if (err) reject(err); else resolve();
                    });
                    proc.stdin?.write(uriList);
                    proc.stdin?.end();
                }
            }, COPY_FILES_TO_CLIPBOARD_TIMEOUT); // Fine you time out
        });
    }

}
