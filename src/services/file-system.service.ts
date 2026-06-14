import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';

export class FileSystemService {
    public exists(fsPath: string): boolean {
        return fs.existsSync(fsPath);
    }

    public isDirectory(fsPath: string): boolean {
        try {
            return fs.statSync(fsPath).isDirectory();
        } catch {
            return false;
        }
    }

    public async clearDirectory(dirPath: string): Promise<void> {
        if (!fs.existsSync(dirPath)) return;
        const files = await fsPromises.readdir(dirPath);
        for (const file of files) {
            await fsPromises.rm(path.join(dirPath, file), { recursive: true, force: true });
        }
    }

    public getInvalidPaths(paths: string[], workspaceRoot: string): string[] {
        const invalidPaths: string[] = [];
        for (const rawPath of paths) {
            let cleanPath = rawPath.replace(/^['"]|['"]$/g, '').trim();
            if (!cleanPath) continue;
            if (!path.isAbsolute(cleanPath)) {
                cleanPath = path.join(workspaceRoot, cleanPath);
            }
            if (!fs.existsSync(cleanPath)) {
                invalidPaths.push(rawPath);
            }
        }
        return invalidPaths;
    }
}
