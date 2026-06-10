import { spawn } from 'child_process';
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
}
