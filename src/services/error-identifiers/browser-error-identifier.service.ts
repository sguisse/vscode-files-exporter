import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { RelatedErrorFilesIdentificator } from './error-identifier.interface';
import { ProcessRunnerService } from '../process-runner.service';

export class BrowserErrorIdentifierService implements RelatedErrorFilesIdentificator {
    constructor(private processRunner: ProcessRunnerService, private scriptPath: string) {}

    public async searchFiles(content: string, workspaceRoot: string, onStderr?: (data: string) => void, includeOutWorkspace?: boolean): Promise<string[]> {
        const tmpFile = path.join(os.tmpdir(), `fe-err-browser-${Date.now()}.txt`);
        fs.writeFileSync(tmpFile, content, 'utf8');
        try {
            const { stdout } = await this.processRunner.executePython(
                this.scriptPath,
                ['browser console', workspaceRoot, tmpFile, includeOutWorkspace ? 'true' : 'false'],
                () => {},
                (err) => { if (onStderr) onStderr(err); }
            );
            return JSON.parse(stdout.trim() || '[]');
        } catch {
            return [];
        } finally {
            try { fs.unlinkSync(tmpFile); } catch {}
        }
    }
}
