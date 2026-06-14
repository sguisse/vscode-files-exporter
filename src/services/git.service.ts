import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface GitDiffResult {
    success: boolean;
    files: string[];
    message: string;
}

export class GitService {
    public getModifiedFiles(wsPath: string): Promise<GitDiffResult> {
        return new Promise((resolve) => {
            exec('git fetch', { cwd: wsPath }, (fetchErr) => {
                const diffCommand = 'git diff $(git merge-base HEAD @{upstream})..HEAD --name-only';

                exec(diffCommand, { cwd: wsPath }, (err, stdout) => {
                    if (err) {
                        exec('git diff origin/HEAD..HEAD --name-only', { cwd: wsPath }, (fallbackErr, fallbackStdout) => {
                            if (!fallbackErr && fallbackStdout) {
                                resolve({ success: true, files: this.parseOutput(fallbackStdout, wsPath), message: '' });
                            } else {
                                resolve({ success: false, files: [], message: '[Git Diff Warning]: No upstream tracking configuration found for the active branch.' });
                            }
                        });
                    } else {
                        if (stdout) {
                            resolve({ success: true, files: this.parseOutput(stdout, wsPath), message: '' });
                        } else {
                            resolve({ success: true, files: [], message: 'Up-to-date. No changes detected between active branch and remote origin.' });
                        }
                    }
                });
            });
        });
    }

    private parseOutput(stdout: string, wsPath: string): string[] {
        return stdout.split('\n')
            .map(l => l.trim())
            .filter(l => l)
            .map(line => path.isAbsolute(line) ? line : path.join(wsPath, line))
            .filter(p => fs.existsSync(p));
    }
}
