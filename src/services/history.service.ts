import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { HistoryEntry, ExportConfig } from '../interfaces/export.interface';

export class HistoryService {
    constructor(private readonly historyFilePath: string) {}

    public async loadHistory(): Promise<HistoryEntry[]> {
        try {
            if (!existsSync(this.historyFilePath)) return [];
            const rawContent = await fs.readFile(this.historyFilePath, 'utf8');
            const parsed = JSON.parse(rawContent.trim() || '{}');
            return parsed.history || [];
        } catch {
            return [];
        }
    }

    public async getLastRunConfigId(): Promise<string> {
        try {
            if (!existsSync(this.historyFilePath)) return 'default';
            const rawContent = await fs.readFile(this.historyFilePath, 'utf8');
            const parsed = JSON.parse(rawContent.trim() || '{}');
            return parsed.config?.lastRunConfigId || parsed.defaults?.lastRunConfigId || 'default';
        } catch {
            return 'default';
        }
    }

    public async saveHistory(formData: any, currentHistoryId?: string): Promise<{ history: HistoryEntry[], selectedId: string }> {
        let fullWrapper: any = { config: { lastRunConfigId: 'default' }, history: [] };

        if (existsSync(this.historyFilePath)) {
            try {
                const fileData = await fs.readFile(this.historyFilePath, 'utf8');
                fullWrapper = JSON.parse(fileData.trim() || '{}');
            } catch (e) {}
        }

        if (!fullWrapper.config) {
            fullWrapper.config = fullWrapper.defaults || {};
            delete fullWrapper.defaults;
        }

        let history: HistoryEntry[] = fullWrapper.history || [];
        const uiConfig = this.mapFormDataToConfig(formData);

        if (currentHistoryId && currentHistoryId !== 'default') {
            const existingIndex = history.findIndex(h => h.id === currentHistoryId);
            if (existingIndex !== -1 && !history[existingIndex].frozen) {
                history[existingIndex].config = uiConfig;
                fullWrapper.config.lastRunConfigId = currentHistoryId;
                fullWrapper.history = history;

                await fs.mkdir(path.dirname(this.historyFilePath), { recursive: true });
                await fs.writeFile(this.historyFilePath, JSON.stringify(fullWrapper, null, 2), 'utf8');
                return { history, selectedId: currentHistoryId };
            }
        }

        const finalSelectedId = currentHistoryId || 'default';
        fullWrapper.config.lastRunConfigId = finalSelectedId;
        fullWrapper.history = history;

        await fs.mkdir(path.dirname(this.historyFilePath), { recursive: true });
        await fs.writeFile(this.historyFilePath, JSON.stringify(fullWrapper, null, 2), 'utf8');

        return { history, selectedId: finalSelectedId };
    }

    public async duplicateEntry(id: string): Promise<{ history: HistoryEntry[], newId: string }> {
        let fullWrapper: any = { config: {}, history: [] };
        if (existsSync(this.historyFilePath)) {
            try {
                const fileData = await fs.readFile(this.historyFilePath, 'utf8');
                fullWrapper = JSON.parse(fileData.trim() || '{}');
            } catch (e) {}
        }
        let history: HistoryEntry[] = fullWrapper.history || [];
        const target = history.find(h => h.id === id);
        if (!target) return { history, newId: id };

        const newId = new Date().toISOString() + "-copy";
        const newEntry: HistoryEntry = {
            id: newId,
            display: `${target.display} copy`,
            config: JSON.parse(JSON.stringify(target.config)),
            frozen: false
        };

        history = [newEntry, ...history];
        fullWrapper.history = history;
        await fs.writeFile(this.historyFilePath, JSON.stringify(fullWrapper, null, 2), 'utf8');
        return { history, newId };
    }

    public async addNewEntry(defaultConfig: ExportConfig, workspaceName: string = 'Workspace'): Promise<{ history: HistoryEntry[], newId: string }> {
        let fullWrapper: any = { config: {}, history: [] };
        if (existsSync(this.historyFilePath)) {
            try {
                const fileData = await fs.readFile(this.historyFilePath, 'utf8');
                fullWrapper = JSON.parse(fileData.trim() || '{}');
            } catch (e) {}
        }
        let history: HistoryEntry[] = fullWrapper.history || [];

        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const displayName = `${pad(now.getMonth() + 1)}/${pad(now.getDate())}-${pad(now.getHours())}:${pad(now.getMinutes())} --> ${workspaceName} --> ⚙️ New config`;

        const newId = now.toISOString() + "-new";
        const newEntry: HistoryEntry = {
            id: newId,
            display: displayName,
            config: JSON.parse(JSON.stringify(defaultConfig)),
            frozen: false
        };

        history = [newEntry, ...history];
        fullWrapper.history = history;
        await fs.writeFile(this.historyFilePath, JSON.stringify(fullWrapper, null, 2), 'utf8');
        return { history, newId };
    }

    public async toggleFreeze(id: string, isFrozen: boolean): Promise<HistoryEntry[]> {
        let fullWrapper: any = { config: {}, history: [] };
        if (existsSync(this.historyFilePath)) {
            try {
                const fileData = await fs.readFile(this.historyFilePath, 'utf8');
                fullWrapper = JSON.parse(fileData.trim() || '{}');
            } catch (e) {}
        }
        const history: HistoryEntry[] = fullWrapper.history || [];
        const entry = history.find(h => h.id === id);
        if (entry) {
            entry.frozen = isFrozen;
            fullWrapper.history = history;
            await fs.writeFile(this.historyFilePath, JSON.stringify(fullWrapper, null, 2), 'utf8');
        }
        return history;
    }

    public async updateEntryDisplay(id: string, newDisplay: string): Promise<HistoryEntry[]> {
        let fullWrapper: any = { config: {}, history: [] };
        if (existsSync(this.historyFilePath)) {
            try {
                const fileData = await fs.readFile(this.historyFilePath, 'utf8');
                fullWrapper = JSON.parse(fileData.trim() || '{}');
            } catch (e) {}
        }
        const history: HistoryEntry[] = fullWrapper.history || [];
        const entry = history.find(h => h.id === id);
        if (entry) {
            entry.display = newDisplay;
            fullWrapper.history = history;
            await fs.writeFile(this.historyFilePath, JSON.stringify(fullWrapper, null, 2), 'utf8');
        }
        return history;
    }

    public async removeEntry(id: string): Promise<HistoryEntry[]> {
        let fullWrapper: any = { config: {}, history: [] };
        if (existsSync(this.historyFilePath)) {
            try {
                const fileData = await fs.readFile(this.historyFilePath, 'utf8');
                fullWrapper = JSON.parse(fileData.trim() || '{}');
            } catch (e) {}
        }
        const history: HistoryEntry[] = fullWrapper.history || [];
        const updatedHistory = history.filter(h => h.id !== id);

        if (!fullWrapper.config) {
            fullWrapper.config = fullWrapper.defaults || {};
        }

        if (fullWrapper.config?.lastRunConfigId === id) {
            fullWrapper.config.lastRunConfigId = 'default';
        }

        fullWrapper.history = updatedHistory;
        await fs.writeFile(this.historyFilePath, JSON.stringify(fullWrapper, null, 2), 'utf8');
        return updatedHistory;
    }

    public async clearHistory(): Promise<void> {
        const emptyData = { config: { lastRunConfigId: 'default' }, history: [] };
        await fs.mkdir(path.dirname(this.historyFilePath), { recursive: true });
        await fs.writeFile(this.historyFilePath, JSON.stringify(emptyData, null, 2), 'utf8');
    }

    public async softClearHistory(): Promise<void> {
        if (existsSync(this.historyFilePath)) {
            const now = new Date();
            const pad = (n: number) => n.toString().padStart(2, '0');
            const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
            const backupPath = `${this.historyFilePath}.${timestamp}.del`;
            await fs.copyFile(this.historyFilePath, backupPath);
        }
    }

    private mapFormDataToConfig(formData: any): ExportConfig {
        return {
            src: formData.paths.join(', '),
            dest: formData.destDir,
            format: formData.format,
            max_file: formData.maxFile,
            max_chunk: formData.maxChunk,
            groupByExt: formData.groupByExt,
            logConsole: formData.logConsole,
            logFile: formData.logFile,
            inc_paths: formData.incPaths,
            exc_paths: formData.excPaths,
            inc_ext: formData.incExts,
            exc_ext: formData.excExts
        };
    }
}
