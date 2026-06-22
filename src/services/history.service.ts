import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { HistoryEntry, ExportConfig } from '../interfaces/export.interface';

export class HistoryService {
    constructor(private readonly historyFilePath: string) {}

    public async getFullWrapper(currentRepo?: string): Promise<any> {
        let parsed: any = {};
        if (existsSync(this.historyFilePath)) {
            try {
                const fileData = await fs.readFile(this.historyFilePath, 'utf8');
                parsed = JSON.parse(fileData.trim() || '{}');
            } catch (e) {}
        }

        if (!parsed.config) {
            parsed.config = {};
        }
        if (!parsed.config.repo) {
            parsed.config.repo = [];
        }
        if (!parsed.history) {
            parsed.history = [];
        }

        if (currentRepo) {
            let repoEntry = parsed.config.repo.find((r: any) => r.repo === currentRepo);
            if (!repoEntry) {
                repoEntry = {
                    repo: currentRepo,
                    lastRunConfigId: parsed.config.lastRunConfigId || 'default',
                    historyViewMode: parsed.config.historyViewMode || 'scope-current-repo'
                };
                parsed.config.repo.push(repoEntry);
            }
        }

        return parsed;
    }

    private async writeWrapper(wrapper: any): Promise<void> {
        await fs.mkdir(path.dirname(this.historyFilePath), { recursive: true });
        wrapper.history = wrapper.history.map((h: any) => ({
            id: h.id,
            repo: h.repo || 'unknown',
            display: h.display,
            frozen: h.frozen || false,
            config: h.config
        }));
        await fs.writeFile(this.historyFilePath, JSON.stringify(wrapper, null, 2), 'utf8');
    }

    public async loadHistory(): Promise<HistoryEntry[]> {
        const wrapper = await this.getFullWrapper();
        return wrapper.history;
    }

    public async getLastRunConfigId(repo: string): Promise<string> {
        const wrapper = await this.getFullWrapper(repo);
        const repoEntry = wrapper.config.repo.find((r: any) => r.repo === repo);
        return repoEntry ? repoEntry.lastRunConfigId : 'default';
    }

    public async setHistoryViewMode(mode: string, repo: string): Promise<void> {
        const wrapper = await this.getFullWrapper(repo);
        const repoEntry = wrapper.config.repo.find((r: any) => r.repo === repo);
        if (repoEntry) {
            repoEntry.historyViewMode = mode;
        }
        await this.writeWrapper(wrapper);
    }

    public async saveHistory(formData: any, currentHistoryId: string | undefined, repo: string): Promise<{ history: HistoryEntry[], selectedId: string }> {
        const wrapper = await this.getFullWrapper(repo);
        const uiConfig = this.mapFormDataToConfig(formData);

        if (currentHistoryId && currentHistoryId !== 'default') {
            const existingIndex = wrapper.history.findIndex((h: any) => h.id === currentHistoryId);
            if (existingIndex !== -1 && !wrapper.history[existingIndex].frozen) {
                wrapper.history[existingIndex].config = uiConfig;
                // ✨ Fix: We DO NOT overwrite wrapper.history[existingIndex].repo here.
                // It must retain its original creation scope.

                const repoEntry = wrapper.config.repo.find((r: any) => r.repo === repo);
                if (repoEntry) {
                    repoEntry.lastRunConfigId = currentHistoryId;
                }

                await this.writeWrapper(wrapper);
                return { history: wrapper.history, selectedId: currentHistoryId };
            }
        }

        const finalSelectedId = currentHistoryId || 'default';
        const repoEntry = wrapper.config.repo.find((r: any) => r.repo === repo);
        if (repoEntry) {
            repoEntry.lastRunConfigId = finalSelectedId;
        }

        await this.writeWrapper(wrapper);
        return { history: wrapper.history, selectedId: finalSelectedId };
    }

    public async duplicateEntry(id: string, repo: string): Promise<{ history: HistoryEntry[], newId: string }> {
        const wrapper = await this.getFullWrapper(repo);
        const target = wrapper.history.find((h: any) => h.id === id);
        if (!target) return { history: wrapper.history, newId: id };

        const newId = new Date().toISOString() + "-copy";
        const newEntry: HistoryEntry = {
            id: newId,
            repo: repo,
            display: `${target.display} copy`,
            frozen: false,
            config: JSON.parse(JSON.stringify(target.config))
        };

        wrapper.history = [newEntry, ...wrapper.history];
        await this.writeWrapper(wrapper);
        return { history: wrapper.history, newId };
    }

    public async addNewEntry(defaultConfig: ExportConfig, workspaceName: string, repo: string, customName?: string): Promise<{ history: HistoryEntry[], newId: string }> {
        const wrapper = await this.getFullWrapper(repo);
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const displayName = customName || `${pad(now.getMonth() + 1)}/${pad(now.getDate())}-${pad(now.getHours())}:${pad(now.getMinutes())} --> ${workspaceName} --> ⚙️ New config`;

        const newId = now.toISOString();
        const newEntry: HistoryEntry = {
            id: newId,
            repo: repo,
            display: displayName,
            frozen: false,
            config: JSON.parse(JSON.stringify(defaultConfig))
        };

        wrapper.history = [newEntry, ...wrapper.history];
        await this.writeWrapper(wrapper);
        return { history: wrapper.history, newId };
    }

    public async toggleFreeze(id: string, isFrozen: boolean): Promise<HistoryEntry[]> {
        const wrapper = await this.getFullWrapper();
        const entry = wrapper.history.find((h: any) => h.id === id);
        if (entry) {
            entry.frozen = isFrozen;
            await this.writeWrapper(wrapper);
        }
        return wrapper.history;
    }

    public async updateEntryDisplay(id: string, newDisplay: string): Promise<HistoryEntry[]> {
        const wrapper = await this.getFullWrapper();
        const entry = wrapper.history.find((h: any) => h.id === id);
        if (entry) {
            entry.display = newDisplay;
            await this.writeWrapper(wrapper);
        }
        return wrapper.history;
    }

    public async removeEntry(id: string): Promise<HistoryEntry[]> {
        const wrapper = await this.getFullWrapper();
        wrapper.history = wrapper.history.filter((h: any) => h.id !== id);

        if (wrapper.config && wrapper.config.repo) {
            wrapper.config.repo.forEach((r: any) => {
                if (r.lastRunConfigId === id) {
                    r.lastRunConfigId = 'default';
                }
            });
        }

        await this.writeWrapper(wrapper);
        return wrapper.history;
    }

    public async clearHistory(): Promise<void> {
        const wrapper = await this.getFullWrapper();
        wrapper.history = [];
        if (wrapper.config && wrapper.config.repo) {
            wrapper.config.repo.forEach((r: any) => {
                r.lastRunConfigId = 'default';
            });
        }
        await this.writeWrapper(wrapper);
    }

    public async softClearHistory(): Promise<void> {
        if (existsSync(this.historyFilePath)) {
            const now = new Date();
            const pad = (n: number) => n.toString().padStart(2, '0');
            const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_\${pad(now.getHours())}-\${pad(now.getMinutes())}-\${pad(now.getSeconds())}`;
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
            copyGeneratedFilesToClipboard: formData.copyGeneratedFilesToClipboard,
            generateTreeView: formData.generateTreeView,
            logConsole: formData.logConsole,
            logFile: formData.logFile,
            inc_paths: formData.incPaths,
            exc_paths: formData.excPaths,
            inc_ext: formData.incExts,
            exc_ext: formData.excExts
        };
    }
}
