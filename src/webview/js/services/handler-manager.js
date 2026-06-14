import { state } from '../core/state.manager.js';
import { bridge } from '../core/vscode.bridge.js';
import { ValidatorService } from './validator.service.js';
import { UIController } from '../core/ui.controller.js';
import { HistoryManager } from './history-manager.js';
import { FiltersManager } from './filters-manager.js';
import { ExportManager } from './export-manager.js';

export const HandlerManager = {
    handleExcludeExplorerPathSelection(message, tabs) {
        try {
            const excPathsEl = document.getElementById('excPaths');
            if (excPathsEl && message.path) {
                const currentVal = excPathsEl.value.trim();
                const cleanRaw = message.path.replace(/\\/g, '/');
                const wsRootPath = state.defaultSettings?.src ? state.defaultSettings.src.replace(/\\/g, '/') : '';

                let relativePath = cleanRaw;
                if (wsRootPath && cleanRaw.startsWith(wsRootPath)) {
                    relativePath = cleanRaw.slice(wsRootPath.length);
                }
                relativePath = relativePath.replace(/^\/+/, '');
                const escapedPath = relativePath.replace(/[-\\^\$*+?.()|[\]{}]/g, '\\$&');

                let isFolder = true;
                if (cleanRaw.includes('.')) {
                    const lastSegment = cleanRaw.split('/').pop();
                    if (lastSegment && lastSegment.includes('.')) isFolder = false;
                }

                const regexEntry = isFolder ? `.*/${escapedPath}/.*` : `.*/${escapedPath}$`;

                if (currentVal === '') {
                    excPathsEl.value = regexEntry;
                } else {
                    const lines = currentVal.split('\n');
                    if (!lines.includes(regexEntry)) excPathsEl.value = currentVal + '\n' + regexEntry;
                }

                excPathsEl.dispatchEvent(new Event('input', { bubbles: true }));
                excPathsEl.dispatchEvent(new Event('change', { bubbles: true }));
                UIController.checkSyncStatus();

                bridge.postMessage('showNotification', { type: 'info', text: 'Added pattern to Exclude Paths: ' + regexEntry });
            }
        } catch(err) { console.error(err); }
    },

    handleCheckPathsResult(message, tabs) {
        state.invalidPathsPayload = message.invalidPaths || [];
        ValidatorService.executeFieldValidation('pathList', false, true);
    },

    handleUpdatePaths(message, tabs) {
        state.selectedPaths = message.paths || [];
        const pathListEl = document.getElementById('pathList');
        if (pathListEl) pathListEl.value = state.selectedPaths.join('\n');
        UIController.checkSyncStatus();
        ValidatorService.executeFieldValidation('pathList');
    },

    handleInitSettings(message, tabs, isModifierPressed) {
        state.defaultSettings = message.defaultSettings || {};
        if (message.tooltipDelay !== undefined) state.tooltipDelayValue = message.tooltipDelay;
        state.isInitializing = true;
        state.historyList = message.history || [];
        state.currentSelectedId = message.selectedId || 'default';
        state.historyViewMode = message.historyViewMode || 'scope-current-repo';
        state.currentRepo = message.currentRepo || '';
        state.fileExtsCategoryGroups = FiltersManager.processFileExtsCategoryGroups(message.fileExtsCategoryGroups);

        HistoryManager.updateHistoryViewToggleButton();
        HistoryManager.updateHistoryCombo(state.currentSelectedId);
        HistoryManager.applyFormFields(message.currentSettings);
        if (message.paths && message.paths.length > 0) {
            state.selectedPaths = message.paths;
            const pathListEl = document.getElementById('pathList');
            if (pathListEl) pathListEl.value = state.selectedPaths.join('\n');
        }

        FiltersManager.renderPredefinedMenu('predefined-inclusions-menu', 'incExts', 'includeExtsMenuEnabled', isModifierPressed);
        FiltersManager.renderPredefinedMenu('predefined-exclusions-menu', 'excExts', 'excludeExtsMenuEnabled', isModifierPressed);

        setTimeout(() => {
            state.isInitializing = false;
            UIController.checkSyncStatus();
            ValidatorService.executeFieldValidation('pathList');
            ValidatorService.executeFieldValidation('destDir');
        }, 50);
    },

    handleUpdateFileExtsCategoryGroups(message, tabs, isModifierPressed) {
        state.fileExtsCategoryGroups = FiltersManager.processFileExtsCategoryGroups(message.fileExtsCategoryGroups);
        FiltersManager.renderPredefinedMenu('predefined-inclusions-menu', 'incExts', 'includeExtsMenuEnabled', isModifierPressed);
        FiltersManager.renderPredefinedMenu('predefined-exclusions-menu', 'excExts', 'excludeExtsMenuEnabled', isModifierPressed);
    },

    handleUpdateHistory(message, tabs) {
        state.historyList = message.history || [];
        state.currentSelectedId = message.selectedId || state.currentSelectedId || 'default';
        HistoryManager.updateHistoryCombo(state.currentSelectedId);
        if (!message.skipFieldSync) HistoryManager.applyHistorySelection(state.currentSelectedId);
        UIController.checkSyncStatus();
        if (state.currentSelectedId && state.currentSelectedId.endsWith('-new')) HistoryManager.enterInlineRenameMode();
    },

    handleTerminalLog(message, tabs) {
        if (tabs.terminalTab) tabs.terminalTab.append(message.text);
        if (message.text.includes('Export process killed manually')) {
            ExportManager.resetRunButton();
            HistoryManager.resetCurrentConfigFields();
            if (tabs.reportTab) tabs.reportTab.clear();
            if (tabs.filesTab) tabs.filesTab.clear();
            if (tabs.treeViewTab) tabs.treeViewTab.clear();
        } else if (message.text.includes('Export complete!') || message.text.includes('Export aborted') || message.text.includes('ERROR:')) {
            ExportManager.resetRunButton();
        }
    },

    handleUpdateCommand(message, tabs) {
        if (tabs.terminalTab) tabs.terminalTab.updateCommand(message.text);
    },

    handleUpdateExportReport(message, tabs) {
        ExportManager.resetRunButton();
        try { if (tabs.reportTab) tabs.reportTab.render(message.data); } catch (e) {}
        try {
            if (message.data) {
                state.lastReportPayload = message.data;
                state.totalExportedSourceFiles = message.data.summary?.total_exported || 0;

                if (message.data.generated_files && tabs.filesTab) {
                    state.lastGeneratedFilesPayload = JSON.parse(JSON.stringify(message.data.generated_files));
                    tabs.filesTab.render(
                        state.lastGeneratedFilesPayload,
                        document.getElementById('destDir').value,
                        (p) => bridge.postMessage('openFile', {path:p}),
                        (p) => bridge.postMessage('openFinder', {path:p}),
                        document.getElementById('splitChunkByFileExtension').checked,
                        state.totalExportedSourceFiles
                    );
                }
                if (tabs.treeViewTab) tabs.treeViewTab.render(message.data, (p) => bridge.postMessage('openFile',{path:p}), (p) => bridge.postMessage('openFinder',{path:p}));
            }
        } catch (e) {}
    },

    handleFilteredFilesResult(message, tabs) {
        try {
            const payload = { ...state.lastGeneratedFilesPayload, exports: message.files };
            if (tabs.filesTab) {
                tabs.filesTab.render(
                    payload,
                    document.getElementById('destDir').value,
                    (p) => bridge.postMessage('openFile', {path:p}),
                    (p) => bridge.postMessage('openFinder', {path:p}),
                    document.getElementById('splitChunkByFileExtension').checked,
                    state.totalExportedSourceFiles
                );
            }
        } catch (e) {}
    }
};
