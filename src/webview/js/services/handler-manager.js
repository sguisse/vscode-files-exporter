import { state } from '../core/state.manager.js';
import { bridge } from '../core/vscode.bridge.js';
import { ValidatorService } from './validator.service.js';
import { UIController } from '../core/ui.controller.js';
import { HistoryManager } from './history-manager.js';
import { FiltersManager } from './filters-manager.js';
import { ExportManager } from './export-manager.js';

export const HandlerManager = {
    // Réintégration exacte de l'implémentation originale (Boutons images 64x64 + openBrowserTab)
    buildExchangeButtons(exchangeItems) {
        const container = document.getElementById('exchange-buttons-container');
        if (!container) return;
        container.innerHTML = '';

        if (!exchangeItems || !Array.isArray(exchangeItems)) return;

        exchangeItems.forEach(item => {
            const btn = document.createElement('vscode-button');
            btn.setAttribute('appearance', 'icon');
            btn.style.width = item.width || '64px';
            btn.style.height = item.height || '64px';

            if (item.tooltip) {
                btn.setAttribute('data-tooltip', item.tooltip);
                btn.setAttribute('title', item.tooltip);
                btn.classList.add('tooltip-bottom');
            }

            const img = document.createElement('img');
            img.src = item.icon;
            img.alt = item.tooltip || 'Exchange Link';
            img.style.width = item.width || '64px';
            img.style.height = item.height || '64px';

            btn.appendChild(img);
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                bridge.postMessage('openBrowserTab', {
                    url: item.url,
                    openInVSCode: item.openInVSCode !== false
                });
            });

            container.appendChild(btn);
        });
    },

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

        const exchangeList = message.exchange || (message.defaultSettings && message.defaultSettings.exchange) || [];
        this.buildExchangeButtons(exchangeList);

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
        if (state.currentSelectedId && state.currentSelectedId.endsWith('-new')) {
            HistoryManager.enterInlineRenameMode();
        }
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
        if (typeof window.forceGlobalSummariesUpdate === 'function') window.forceGlobalSummariesUpdate();
    },

    handleUpdateCommand(message, tabs) {
        if (tabs.terminalTab) tabs.terminalTab.updateCommand(message.text);
        if (typeof window.forceGlobalSummariesUpdate === 'function') window.forceGlobalSummariesUpdate();
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
        if (typeof window.forceGlobalSummariesUpdate === 'function') window.forceGlobalSummariesUpdate();
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
        if (typeof window.forceGlobalSummariesUpdate === 'function') window.forceGlobalSummariesUpdate();
    },

    handleShowRichNotification(message) {
        const { text, type, position, durationMs, header, actions } = message.payload;

        const toast = document.createElement('div');
        toast.className = `rich-toast toast-${type} toast-${position}`;

        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'warn') icon = '⚠️';
        if (type === 'error') icon = '❌';

        let html = '';
        if (header) {
            html += `<div class="toast-header"><span>${icon}</span> <span>${header}</span></div>`;
        }
        html += `<div class="toast-body">${text}</div>`;

        // Render Action Buttons
        if (actions && actions.length > 0) {
            html += `<div class="toast-actions">`;
            actions.forEach((act, idx) => {
                const appearance = act.label === 'Dismiss' ? 'secondary' : 'primary';
                html += `<vscode-button appearance="${appearance}" data-cmd="${act.command}" data-idx="${idx}">${act.label}</vscode-button>`;
            });
            html += `</div>`;
        }

        toast.innerHTML = html;
        document.body.appendChild(toast);

        // Bind Button Click Events
        if (actions && actions.length > 0) {
            toast.querySelectorAll('vscode-button').forEach(btn => {
                btn.addEventListener('click', () => {
                    const cmd = btn.getAttribute('data-cmd');
                    const idx = btn.getAttribute('data-idx');

                    if (cmd !== 'close_notification') {
                        const act = actions[idx];
                        // Dispatch back to the extension router
                        bridge.postMessage('richNotificationCallback', { actionCommand: cmd, data: act.data });
                    }

                    // Dismiss the toast
                    toast.style.opacity = '0';
                    setTimeout(() => toast.remove(), 300);
                });
            });
        }

        // Animate In
        void toast.offsetWidth;
        toast.style.opacity = '1';

        // Auto-dismiss ONLY if there are no buttons. If there are buttons, wait for the user to click.
        if (!actions || actions.length === 0) {
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.style.opacity = '0';
                    setTimeout(() => toast.remove(), 300);
                }
            }, durationMs || 4000);
        }
    }
};
