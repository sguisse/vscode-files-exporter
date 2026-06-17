import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface GitDiffResult {
    success: boolean;
    files: string[];
    message: string;
}

export class GitService {
    /**
     * Gets all local modified files (staged or unstaged) compared to the last commit (HEAD).
     */
    public getLocalModifiedFilesFromLastCommit(wsPath: string): Promise<GitDiffResult> {
        return new Promise((resolve) => {
            // --porcelain ensures stable output format across git versions
            exec('git status --porcelain', { cwd: wsPath }, (err, stdout) => {
                if (err) {
                    resolve({ success: false, files: [], message: `[Git Status Error]: ${err.message}` });
                    return;
                }

                if (!stdout.trim()) {
                    resolve({ success: true, files: [], message: 'No local modifications detected since last commit.' });
                    return;
                }

                // git status --porcelain outputs: XY path/to/file.ts
                // We need to strip the status codes (first 3 characters) to get the file path
                const relativePaths = stdout
                    .split('\n')
                    .map(line => line.substring(3).trim())
                    .filter(line => line);

                // Convert to full string output for parsing uniformity
                const pathsRawString = relativePaths.join('\n');

                resolve({
                    success: true,
                    files: this.parseOutput(pathsRawString, wsPath),
                    message: ''
                });
            });
        });
    }

    /**
     * Gets all local modified files compared to the remote branch.
     * Includes all unpushed commits AND current modified files (staged or unstaged).
     */
    public getLocalModifiedFilesFromRemoteBranch(wsPath: string): Promise<GitDiffResult> {
        return new Promise((resolve) => {
            exec('git fetch', { cwd: wsPath }, (fetchErr) => {
                // Removing "..HEAD" ensures we diff tracking branch all the way to the working directory
                // (including uncommitted staged/unstaged changes)
                const diffCommand = 'git diff $(git merge-base HEAD @{upstream}) --name-only';

                exec(diffCommand, { cwd: wsPath }, (err, stdout) => {
                    if (err) {
                        exec('git diff origin/HEAD --name-only', { cwd: wsPath }, (fallbackErr, fallbackStdout) => {
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
                            resolve({ success: true, files: [], message: 'Up-to-date. No changes detected between local and remote origin.' });
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
