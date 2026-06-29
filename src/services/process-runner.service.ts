import { spawn, exec, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { ClipboardService } from './clipboard/clipboard.service';

export class ProcessRunnerService {
    private clipboardService = new ClipboardService();
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

    public copyFilesToClipboard(filePaths: string[], timeoutMs: number = 10000): Promise<string> {
        return this.clipboardService.copyFilesToClipboard(filePaths, timeoutMs);
    }
}
