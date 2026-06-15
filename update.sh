#!/usr/bin/env bash
set -euo pipefail

echo -e "================================================================="
echo -e "⚙️  REFIXTURING PRO : RE-ALIGNEMENT DES ICONES ET VALIDATIONS"
echo -e "================================================================="

if [ ! -f "package.json" ]; then
    echo -e "[\e[31mERREUR\e[0m] Exécutez ce script à la racine du workspace."
    exit 1
fi

SVC_DIR="src/webview/js/services"
CORE_DIR="src/webview/js/core"
HANDLER_MANAGER_FILE="${SVC_DIR}/handler-manager.js"
INIT_MANAGER_FILE="${CORE_DIR}/initialization.manager.js"

# -----------------------------------------------------------------
# 1. RECONSTRUCTION DE HANDLER-MANAGER (Slotting d'icônes & Clics robustes)
# -----------------------------------------------------------------
echo -e "[\e[34mINFO\e[0m] Correction du générateur de boutons dans $HANDLER_MANAGER_FILE..."

cat << 'EOF_HANDLER_FIX' > "$HANDLER_MANAGER_FILE"
import { state } from '../core/state.manager.js';
import { bridge } from '../core/vscode.bridge.js';
import { ValidatorService } from './validator.service.js';
import { UIController } from '../core/ui.controller.js';
import { HistoryManager } from './history-manager.js';
import { FiltersManager } from './filters-manager.js';
import { ExportManager } from './export-manager.js';

export const HandlerManager = {
    buildExchangeButtons(exchangeList) {
        const exContainer = document.getElementById('exchange-buttons-container');
        if (!exContainer) return;

        exContainer.innerHTML = '';
        const list = exchangeList || [];

        list.forEach(btn => {
            const vscodeBtn = document.createElement('vscode-button');
            vscodeBtn.setAttribute('appearance', btn.appearance || 'secondary');
            if (btn.id) vscodeBtn.id = `btn-exchange-${btn.id}`;

            // Gestion native des Tooltips VS Code
            const tooltipText = btn.tooltip || btn.description || btn.title || '';
            if (tooltipText) {
                vscodeBtn.setAttribute('data-tooltip', tooltipText);
                vscodeBtn.setAttribute('title', tooltipText);
                vscodeBtn.classList.add('tooltip-bottom');
            }

            // Injection des dimensions personnalisées
            if (btn.width) vscodeBtn.style.width = typeof btn.width === 'number' ? `${btn.width}px` : btn.width;
            if (btn.height) vscodeBtn.style.height = typeof btn.height === 'number' ? `${btn.height}px` : btn.height;
            if (btn.style) {
                if (typeof btn.style === 'object') {
                    Object.assign(vscodeBtn.style, btn.style);
                } else if (typeof btn.style === 'string') {
                    vscodeBtn.style.cssText += `; ${btn.style}`;
                }
            }

            // FIX ICONES : Utilisation obligatoire de slot="start" pour traverser le Shadow DOM du Toolkit
            let iconHtml = '';
            if (btn.icon) {
                iconHtml = `<span class="codicon codicon-${btn.icon}" slot="start"></span>`;
            }

            vscodeBtn.innerHTML = `${iconHtml}${btn.label || btn.name || 'Exchange'}`;

            // Liaison sécurisée de l'action de clic
            vscodeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log(`[Exchange Action] Triggered for button ID: ${btn.id}`);

                const pathListValue = document.getElementById('pathList')?.value || '';
                const pathsArray = pathListValue.split('\n').map(p => p.trim()).filter(p => p);

                try {
                    bridge.postMessage('exchangeAction', {
                        id: btn.id,
                        actionId: btn.id,
                        command: btn.command,
                        payload: {
                            paths: pathsArray,
                            destDir: document.getElementById('destDir')?.value || '',
                            format: document.getElementById('format')?.value || 'yaml',
                            maxFile: document.getElementById('maxFile')?.value || '50',
                            maxChunk: document.getElementById('maxChunk')?.value || '0',
                            groupByExt: !!document.getElementById('splitChunkByFileExtension')?.checked,
                            incPaths: document.getElementById('incPaths')?.value || '',
                            excPaths: document.getElementById('excPaths')?.value || '',
                            incExts: document.getElementById('incExts')?.value || '',
                            excExts: document.getElementById('excExts')?.value || ''
                        }
                    });
                } catch (err) {
                    console.error('[Exchange Action] Critical error sending postMessage:', err);
                }
            });
            exContainer.appendChild(vscodeBtn);
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
EOF_HANDLER_FIX

# -----------------------------------------------------------------
# 2. RECONSTRUCTION DE INITIALIZATION-MANAGER (Validation sur l'élément hôte)
# -----------------------------------------------------------------
echo -e "[\e[34mINFO\e[0m] Correction de l'écouteur de validation dans $INIT_MANAGER_FILE..."

cat << 'EOF_INIT_FIX' > "$INIT_MANAGER_FILE"
import { bridge } from './vscode.bridge.js';
import { state } from './state.manager.js';
import { ValidatorService } from '../services/validator.service.js';
import { UIController } from './ui.controller.js';
import { HistoryManager } from '../services/history-manager.js';
import { SourcePathsManager } from '../services/source-paths-manager.js';
import { FiltersManager } from '../services/filters-manager.js';
import { DestinationManager } from '../services/destination-manager.js';
import { ExportManager } from '../services/export-manager.js';
import { HandlerManager } from '../services/handler-manager.js';

let isModifierPressed = false;

export const InitializationManager = {
    init(tabs) {
        window.reportTab = tabs.reportTab;
        window.filesTab = tabs.filesTab;
        window.treeViewTab = tabs.treeViewTab;
        window.terminalTab = tabs.terminalTab;

        UIController.injectShadowDomStyles();
        UIController.initCursorTooltipTracker();

        if (tabs.helpTab) tabs.helpTab.render();

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Control' || e.key === 'Meta') {
                if (!isModifierPressed) {
                    isModifierPressed = true;
                    FiltersManager.updateMenuHotkeysLayout(isModifierPressed);
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.key === 'Control' || e.key === 'Meta') {
                if (isModifierPressed) {
                    isModifierPressed = false;
                    FiltersManager.updateMenuHotkeysLayout(isModifierPressed);
                }
            }
        });

        document.getElementById('btn-sort-incPaths')?.addEventListener('click', () => FiltersManager.sortTextAreaLines('incPaths'));
        document.getElementById('btn-sort-excPaths')?.addEventListener('click', () => FiltersManager.sortTextAreaLines('excPaths'));
        document.getElementById('btn-sort-incExts')?.addEventListener('click', () => FiltersManager.sortTextAreaLines('incExts'));
        document.getElementById('btn-sort-excExts')?.addEventListener('click', () => FiltersManager.sortTextAreaLines('excExts'));

        document.getElementById('btn-explode-incExts')?.addEventListener('click', () => FiltersManager.explodeTextAreaRegex('incExts'));
        document.getElementById('btn-explode-incPaths')?.addEventListener('click', () => FiltersManager.explodeTextAreaRegex('incPaths'));
        document.getElementById('btn-explode-excPaths')?.addEventListener('click', () => FiltersManager.explodeTextAreaRegex('excPaths'));
        document.getElementById('btn-explode-excExts')?.addEventListener('click', () => FiltersManager.explodeTextAreaRegex('excExts'));

        document.getElementById('btn-group-incExts')?.addEventListener('click', () => FiltersManager.groupTextAreaExtensions('incExts'));
        document.getElementById('btn-group-excExts')?.addEventListener('click', () => FiltersManager.groupTextAreaExtensions('excExts'));

        document.getElementById('btn-predefined-inclusions')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = document.getElementById('predefined-inclusions-menu');
            if (menu) {
                const isOpening = menu.style.display !== 'block';
                if (isOpening) {
                    FiltersManager.renderPredefinedMenu('predefined-inclusions-menu', 'incExts', 'includeExtsMenuEnabled', isModifierPressed);
                    menu.style.display = 'block';
                } else {
                    menu.style.display = 'none';
                }
            }
        });

        document.getElementById('btn-predefined-exclusions')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = document.getElementById('predefined-exclusions-menu');
            if (menu) {
                const isOpening = menu.style.display !== 'block';
                if (isOpening) {
                    FiltersManager.renderPredefinedMenu('predefined-exclusions-menu', 'excExts', 'excludeExtsMenuEnabled', isModifierPressed);
                    menu.style.display = 'block';
                } else {
                    menu.style.display = 'none';
                }
            }
        });

        document.addEventListener('click', () => {
            const incMenu = document.getElementById('predefined-inclusions-menu');
            const excMenu = document.getElementById('predefined-exclusions-menu');
            if (incMenu) incMenu.style.display = 'none';
            if (excMenu) excMenu.style.display = 'none';
        });

        document.getElementById('btn-toggle-history-view')?.addEventListener('click', () => {
            state.historyViewMode = state.historyViewMode === 'scope-current-repo' ? 'scope-all-repo' : 'scope-current-repo';
            HistoryManager.updateHistoryViewToggleButton();
            HistoryManager.updateHistoryCombo(state.currentSelectedId);
            bridge.postMessage('updateHistoryViewMode', { mode: state.historyViewMode });
        });

        document.getElementById('historyCombo')?.addEventListener('change', (e) => {
            const val = e.target.value;
            if (!val || state.isInitializing) return;
            state.currentSelectedId = val;
            HistoryManager.applyHistorySelection(val);
            UIController.syncButtonsState(val);
            ValidatorService.clearAllValidationStyles();
            UIController.checkSyncStatus();
        });

        document.getElementById('btn-freeze-history')?.addEventListener('click', () => {
            if (state.currentSelectedId && state.currentSelectedId !== 'default') {
                const entry = state.historyList.find(h => h.id === state.currentSelectedId);
                if (entry) bridge.postMessage('toggleFreezeHistory', { id: state.currentSelectedId, frozen: !entry.frozen });
            }
        });

        document.getElementById('btn-reset-config')?.addEventListener('click', () => {
            HistoryManager.resetCurrentConfigFields();
        });

        document.getElementById('btn-edit-history')?.addEventListener('click', HistoryManager.enterInlineRenameMode);

        document.getElementById('historyRenameInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = e.target.value.trim();
                if (val && state.currentSelectedId && state.currentSelectedId !== 'default') {
                    bridge.postMessage('editHistoryName', { id: state.currentSelectedId, newName: val });
                }
                HistoryManager.cancelInlineHistoryRename();
            } else if (e.key === 'Escape') {
                HistoryManager.cancelInlineHistoryRename();
            }
        });

        document.getElementById('historyRenameInput')?.addEventListener('blur', () => {
            setTimeout(() => { HistoryManager.cancelInlineHistoryRename(); }, 180);
        });

        document.getElementById('btn-duplicate-history')?.addEventListener('click', () => {
            const getVal = (id) => document.getElementById(id)?.value || '';
            const getCheck = (id) => !!document.getElementById(id)?.checked;
            const pathsStr = (document.getElementById('pathList')?.value || '').split('\n').map(p => p.trim()).filter(p => p).join(', ');

            const screenConfig = {
                src: pathsStr, dest: getVal('destDir'), format: getVal('format'),
                max_file: getVal('maxFile'), max_chunk: getVal('maxChunk'),
                groupByExt: getCheck('splitChunkByFileExtension'),
                copyGeneratedFilesToClipboard: getCheck('copyGeneratedFilesToClipboard'),
                generateTreeView: getCheck('generateTreeView'),
                logConsole: getCheck('generateLogConsole'), logFile: getCheck('generateLogFile'),
                inc_paths: getVal('incPaths'), exc_paths: getVal('excPaths'),
                inc_ext: getVal('incExts'), exc_ext: getVal('excExts')
            };

            let customDisplayName = null;
            if (state.currentSelectedId && state.currentSelectedId !== 'default') {
                const selectedEntry = state.historyList.find(h => h.id === state.currentSelectedId);
                if (selectedEntry) customDisplayName = `${selectedEntry.display} - copy`;
            }

            bridge.postMessage('addNewConfigProfile', { duplicateConfig: screenConfig, customName: customDisplayName });
        });

        document.getElementById('btn-add-history')?.addEventListener('click', () => bridge.postMessage('addNewConfigProfile'));
        document.getElementById('btn-open-history-file')?.addEventListener('click', () => bridge.postMessage('openHistoryInVSCode'));
        document.getElementById('btn-reveal-history-folder')?.addEventListener('click', () => bridge.postMessage('revealHistoryInOS'));
        document.getElementById('btn-clear-history')?.addEventListener('click', () => bridge.postMessage('clearHistory', { selectedId: state.currentSelectedId }));

        document.getElementById('btn-clear-paths')?.addEventListener('click', SourcePathsManager.clearPaths);
        document.getElementById('btn-add-open-files')?.addEventListener('click', SourcePathsManager.addOpenFiles);
        document.getElementById('btn-add-git-diff')?.addEventListener('click', SourcePathsManager.addGitDiffFiles);

        const pathListTextArea = document.getElementById('pathList');
        if (pathListTextArea) {
            const targetTextarea = pathListTextArea.shadowRoot?.querySelector('textarea') || pathListTextArea;
            targetTextarea.addEventListener('blur', SourcePathsManager.saveActiveTextareaCursorIndex);
            targetTextarea.addEventListener('keyup', SourcePathsManager.saveActiveTextareaCursorIndex);
            targetTextarea.addEventListener('click', SourcePathsManager.saveActiveTextareaCursorIndex);
        }

        document.getElementById('btn-open-cursor-line')?.addEventListener('click', SourcePathsManager.openPathAtCursor);
        document.getElementById('btn-run')?.addEventListener('click', () => ExportManager.runExport());

        document.getElementById('btn-copy-cmd')?.addEventListener('click', () => tabs.terminalTab?.copyCommand());
        document.getElementById('btn-copy-latest-files')?.addEventListener('click', DestinationManager.copyLatestExportedFiles);
        document.getElementById('btn-open-finder-dest')?.addEventListener('click', DestinationManager.openFinder);
        document.getElementById('btn-clear-dest')?.addEventListener('click', DestinationManager.clearDestDirectory);

        document.getElementById('btn-filter-files')?.addEventListener('click', () => {
            if (!state.lastGeneratedFilesPayload) return;
            bridge.postMessage('applyFileFilter', {
                data: {
                    fileNameRegex: document.getElementById('filterFileName').value,
                    fileContentRegex: document.getElementById('filterFileContent').value,
                    destDir: document.getElementById('destDir').value,
                    files: state.lastGeneratedFilesPayload.exports || []
                }
            });
        });

        document.getElementById('btn-reset-filter')?.addEventListener('click', () => {
            if (document.getElementById('filterFileName')) document.getElementById('filterFileName').value = '';
            if (document.getElementById('filterFileContent')) document.getElementById('filterFileContent').value = '';
            if (state.lastGeneratedFilesPayload && tabs.filesTab) {
                tabs.filesTab.render(
                    state.lastGeneratedFilesPayload,
                    document.getElementById('destDir').value,
                    (p) => bridge.postMessage('openFile', {path:p}),
                    (p) => bridge.postMessage('openFinder', {path:p}),
                    document.getElementById('splitChunkByFileExtension').checked,
                    state.totalExportedSourceFiles
                );
            }
            if (state.lastReportPayload && tabs.treeViewTab) {
                tabs.treeViewTab.render(state.lastReportPayload, (p) => bridge.postMessage('openFile',{path:p}), (p) => bridge.postMessage('openFinder',{path:p}));
            }
        });

        // FIX VALIDATION : Rattachement direct à l'élément pour contourner l'asynchronisme du Shadow DOM
        const observedFields = ['pathList', 'destDir', 'maxFile', 'maxChunk', 'incPaths', 'excPaths', 'incExts', 'excExts'];
        observedFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('blur', () => {
                    ValidatorService.executeFieldValidation(id);
                    UIController.checkSyncStatus();
                });

                el.addEventListener('input', () => {
                    ValidatorService.executeFieldValidation(id);
                    UIController.checkSyncStatus();
                });
            }
        });

        bridge.postMessage('webviewReady');
    },

    handleMessage(message, tabs) {
        switch (message.command) {
            case 'excludeExplorerPathSelection': HandlerManager.handleExcludeExplorerPathSelection(message, tabs); break;
            case 'checkPathsResult': HandlerManager.handleCheckPathsResult(message, tabs); break;
            case 'updatePaths': HandlerManager.handleUpdatePaths(message, tabs); break;
            case 'initSettings': HandlerManager.handleInitSettings(message, tabs, isModifierPressed); break;
            case 'updateFileExtsCategoryGroups': HandlerManager.handleUpdateFileExtsCategoryGroups(message, tabs, isModifierPressed); break;
            case 'updateHistory': HandlerManager.handleUpdateHistory(message, tabs); break;
            case 'terminalLog': HandlerManager.handleTerminalLog(message, tabs); break;
            case 'updateCommand': HandlerManager.handleUpdateCommand(message, tabs); break;
            case 'updateExportReport': HandlerManager.handleUpdateExportReport(message, tabs); break;
            case 'filteredFilesResult': HandlerManager.handleFilteredFilesResult(message, tabs); break;
        }
    }
};
EOF_INIT_FIX

# -----------------------------------------------------------------
# VALIDATION FINAL
# -----------------------------------------------------------------
echo -e "\n================================================================="
echo -e "🛡️  VERIFICATION FINALE DE LA COMPILATION"
echo -e "================================================================="

if npx tsc --noEmit; then
    echo -e "[\e[32mSUCCÈS\e[0m] Arbre TypeScript statique intègre."
else
    echo -e "[\e[31mERREUR\e[0m] Anomalie détectée lors de la compilation."
    exit 1
fi

if grep -q "\"compile\":" package.json; then
    echo -e "[\e[34mINFO\e[0m] Exécution du bundling Webpack..."
    if npm run compile; then
        echo -e "[\e[32mSUCCÈS\e[0m] Build complet opérationnel."
    else
        echo -e "[\e[31mERREUR\e[0m] Échec de la compilation d'intégration."
        exit 1
    fi
fi
