import { bridge } from './js/core/vscode.bridge.js';
import { state } from './js/core/state.manager.js';
import { ValidatorService } from './js/services/validator.service.js';
import { UIController } from './js/core/ui.controller.js';
import { ReportTab } from './components/report-tab.js';
import { FilesTab } from './components/files-tab.js';
import { TreeViewTab } from './components/tree-view-tab.js';
import { TerminalTab } from './components/terminal-tab.js';
import { HelpTab } from './components/help-tab.js';

const reportTab = new ReportTab();
const filesTab = new FilesTab();
const treeViewTab = new TreeViewTab();
const terminalTab = new TerminalTab();
const helpTab = new HelpTab();

const setRunButtonLoading = () => {
    const btn = document.getElementById('btn-run');
    if (btn) {
        btn.classList.add('loading');
        btn.disabled = true;
        btn.innerHTML = '<span class="codicon codicon-sync spin-anim"></span> PROCESSING EXPORT...';
    }
};

const resetRunButton = () => {
    const btn = document.getElementById('btn-run');
    if (btn) {
        btn.classList.remove('loading');
        btn.disabled = false;
        btn.innerHTML = '<span class="codicon codicon-play"></span> RUN EXPORT';
    }
};

const updateHistoryViewToggleButton = () => {
    const btn = document.getElementById('btn-toggle-history-view');
    if (btn) {
        btn.innerHTML = state.historyViewMode === 'scope-current-repo' ? '🏠' : '🌐';
    }
};

const cancelInlineHistoryRename = () => {
    const combo = document.getElementById('historyCombo');
    const input = document.getElementById('historyRenameInput');
    if (combo && input) {
        input.style.display = 'none';
        combo.style.display = 'block';
    }
};

const enterInlineRenameMode = () => {
    if (!state.currentSelectedId || state.currentSelectedId === 'default') return;
    const combo = document.getElementById('historyCombo');
    const input = document.getElementById('historyRenameInput');
    const entry = state.historyList.find(h => h.id === state.currentSelectedId);

    if (combo && input && entry) {
        combo.style.display = 'none';
        input.style.display = 'block';
        input.value = entry.display;

        setTimeout(() => {
            const targetBox = input.shadowRoot?.querySelector('input') || input;
            targetBox.focus();
            if (typeof targetBox.select === 'function') targetBox.select();
        }, 50);
    }
};

const init = () => {
    UIController.injectShadowDomStyles();
    UIController.initCursorTooltipTracker();

    helpTab.render();

    document.getElementById('btn-toggle-history-view')?.addEventListener('click', () => {
        state.historyViewMode = state.historyViewMode === 'scope-current-repo' ? 'scope-all-repo' : 'scope-current-repo';
        updateHistoryViewToggleButton();
        updateHistoryCombo(state.currentSelectedId);
        bridge.postMessage('updateHistoryViewMode', { mode: state.historyViewMode });
    });

    document.getElementById('historyCombo')?.addEventListener('change', (e) => {
        const val = e.target.value;
        if (!val || state.isInitializing) return;
        state.currentSelectedId = val;
        applyHistorySelection(val);
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
        resetCurrentConfigFields();
    });

    document.getElementById('btn-edit-history')?.addEventListener('click', enterInlineRenameMode);

    document.getElementById('historyRenameInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const val = e.target.value.trim();
            if (val && state.currentSelectedId && state.currentSelectedId !== 'default') {
                bridge.postMessage('editHistoryName', { id: state.currentSelectedId, newName: val });
            }
            cancelInlineHistoryRename();
        } else if (e.key === 'Escape') {
            cancelInlineHistoryRename();
        }
    });

    document.getElementById('historyRenameInput')?.addEventListener('blur', () => {
        setTimeout(() => {
            cancelInlineHistoryRename();
        }, 180);
    });

    document.getElementById('btn-duplicate-history')?.addEventListener('click', () => {
        if (state.currentSelectedId && state.currentSelectedId !== 'default') bridge.postMessage('duplicateHistory', { id: state.currentSelectedId });
    });

    document.getElementById('btn-add-history')?.addEventListener('click', () => bridge.postMessage('addNewConfigProfile'));
    document.getElementById('btn-open-history-file')?.addEventListener('click', () => bridge.postMessage('openHistoryInVSCode'));
    document.getElementById('btn-reveal-history-folder')?.addEventListener('click', () => bridge.postMessage('revealHistoryInOS'));
    document.getElementById('btn-clear-history')?.addEventListener('click', () => bridge.postMessage('clearHistory', { selectedId: state.currentSelectedId }));

    document.getElementById('btn-clear-paths')?.addEventListener('click', () => {
        state.selectedPaths = [];
        const pathEl = document.getElementById('pathList');
        if (pathEl) pathEl.value = '';
        bridge.postMessage('clearPaths');
        UIController.checkSyncStatus();
    });

    document.getElementById('btn-add-open-files')?.addEventListener('click', () => {
        const currentPaths = (document.getElementById('pathList')?.value || '').split('\n').map(p => p.trim()).filter(p => p);
        bridge.postMessage('addOpenFiles', { currentPaths });
    });

    document.getElementById('btn-add-git-diff')?.addEventListener('click', () => {
        const currentPaths = (document.getElementById('pathList')?.value || '').split('\n').map(p => p.trim()).filter(p => p);
        bridge.postMessage('addGitDiffFiles', { currentPaths });
    });

    document.getElementById('btn-run')?.addEventListener('click', runExport);
    document.getElementById('btn-copy-cmd')?.addEventListener('click', () => terminalTab.copyCommand());

    document.getElementById('btn-gemini')?.addEventListener('click', () => {
        bridge.postMessage('openBrowserTab', { url: 'https://gemini.google.com/' });
    });

    document.getElementById('btn-notebooklm')?.addEventListener('click', () => {
        bridge.postMessage('openBrowserTab', { url: 'https://notebooklm.google.com/' });
    });

    document.getElementById('btn-copy-latest-files')?.addEventListener('click', () => {
        const destDir = document.getElementById('destDir').value;
        if (destDir) bridge.postMessage('copyLatestExportedFiles', { path: destDir });
    });

    document.getElementById('btn-open-finder-dest')?.addEventListener('click', () => {
        const destDir = document.getElementById('destDir').value;
        if (destDir) bridge.postMessage('openFinder', { path: destDir });
    });

    document.getElementById('btn-clear-dest')?.addEventListener('click', () => {
        const destDir = document.getElementById('destDir').value;
        if (destDir) bridge.postMessage('clearDestDirectory', { path: destDir });
    });

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
        if (state.lastGeneratedFilesPayload) {
            filesTab.render(
                state.lastGeneratedFilesPayload,
                document.getElementById('destDir').value,
                (p) => bridge.postMessage('openFile', {path:p}),
                (p) => bridge.postMessage('openFinder', {path:p}),
                document.getElementById('splitChunkByFileExtension').checked,
                state.totalExportedSourceFiles
            );
        }
        if (state.lastReportPayload) {
            treeViewTab.render(state.lastReportPayload, (p) => bridge.postMessage('openFile', {path:p}), (p) => bridge.postMessage('openFinder', {path:p}));
        }
    });

    ['ext', 'exported', 'rejected', 'excluded'].forEach(col => {
        document.getElementById(`th-${col}`)?.addEventListener('click', (e) => reportTab.sort(e, col));
    });

    document.addEventListener('blur', (e) => {
        if (e.target && e.target.id && ValidatorService.validators[e.target.id]) ValidatorService.executeFieldValidation(e.target.id);
    }, true);

    document.addEventListener('input', (e) => {
        if (e.target && e.target.id) {
            if (ValidatorService.validators[e.target.id]) {
                ValidatorService.executeFieldValidation(e.target.id, true);
            }
            if (e.target.id === 'pathList') {
                state.selectedPaths = e.target.value.split('\n').map(p => p.trim()).filter(p => p);
                bridge.postMessage('syncPaths', { paths: state.selectedPaths });
            }
            UIController.checkSyncStatus();
        }
    }, true);

    document.addEventListener('change', (e) => {
        if (e.target && e.target.id) {
            if (ValidatorService.validators[e.target.id]) {
                ValidatorService.executeFieldValidation(e.target.id);
            }
            if (e.target.id === 'pathList') {
                state.selectedPaths = e.target.value.split('\n').map(p => p.trim()).filter(p => p);
                bridge.postMessage('syncPaths', { paths: state.selectedPaths });
            }
            UIController.checkSyncStatus();
        }
    }, true);

    bridge.postMessage('webviewReady');
};

const runExport = () => {
    let isFormValid = true;
    Object.keys(ValidatorService.validators).forEach(id => {
        if (!ValidatorService.executeFieldValidation(id)) isFormValid = false;
    });
    if (state.pathListInvalid) isFormValid = false;
    if (!isFormValid) {
        terminalTab.append("\n❌ Export aborted: Please fix the highlighted fields in red pastel before running.\n");
        return;
    }

    setRunButtonLoading();
    terminalTab.clear();
    terminalTab.append("⏳ Starting export process...\n");
    const pathsArray = (document.getElementById('pathList')?.value || '').split('\n').map(p => p.trim()).filter(p => p);

    bridge.postMessage('runExport', {
        currentHistoryId: state.currentSelectedId,
        data: {
            paths: pathsArray,
            destDir: document.getElementById('destDir')?.value || '',
            format: document.getElementById('format')?.value || 'yaml',
            maxFile: document.getElementById('maxFile')?.value || '50',
            maxChunk: document.getElementById('maxChunk')?.value || '0',
            groupByExt: !!document.getElementById('splitChunkByFileExtension')?.checked,
            copyGeneratedFilesToClipboard: !!document.getElementById('copyGeneratedFilesToClipboard')?.checked,
            logConsole: !!document.getElementById('generateLogConsole')?.checked,
            logFile: !!document.getElementById('generateLogFile')?.checked,
            generateTreeView: !!document.getElementById('generateTreeView')?.checked,
            incPaths: document.getElementById('incPaths')?.value || '',
            excPaths: document.getElementById('excPaths')?.value || '',
            incExts: document.getElementById('incExts')?.value || '',
            excExts: document.getElementById('excExts')?.value || ''
        }
    });
};

const applyHistorySelection = (val) => {
    reportTab.clear(); filesTab.clear(); treeViewTab.clear(); terminalTab.clear();
    const targetConfig = val === 'default' ? state.defaultSettings : state.historyList.find(h => h.id === val)?.config;
    applyFormFields(targetConfig);
    setTimeout(() => ValidatorService.executeFieldValidation('pathList'), 10);
};

const resetCurrentConfigFields = () => {
    const targetConfig = state.currentSelectedId === 'default'
        ? state.defaultSettings
        : state.historyList.find(h => h.id === state.currentSelectedId)?.config;

    applyFormFields(targetConfig);
    ValidatorService.clearAllValidationStyles();
    setTimeout(() => {
        ValidatorService.executeFieldValidation('pathList');
        UIController.checkSyncStatus();
    }, 10);
};

const applyFormFields = (cfg) => {
    if (!cfg) return;
    state.selectedPaths = cfg.src ? cfg.src.split(/[\n,;]/).map(p => p.trim()).filter(p => p) : [];
    document.getElementById('pathList').value = state.selectedPaths.join('\n');
    bridge.postMessage('syncPaths', { paths: state.selectedPaths });

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
    setVal('destDir', cfg.dest); setVal('format', cfg.format || 'yaml');
    setVal('maxFile', cfg.max_file || '50'); setVal('maxChunk', cfg.max_chunk || '0');
    setCheck('splitChunkByFileExtension', !!cfg.groupByExt);
    setCheck('copyGeneratedFilesToClipboard', !!cfg.copyGeneratedFilesToClipboard);
    setCheck('generateLogConsole', cfg.logConsole !== false);
    setCheck('generateLogFile', !!cfg.logFile);
    setCheck('generateTreeView', cfg.generateTreeView !== false);
    setVal('incPaths', cfg.inc_paths); setVal('excPaths', cfg.exc_paths);
    setVal('incExts', cfg.inc_ext); setVal('excExts', cfg.exc_ext);
};

const updateHistoryCombo = (selectedId) => {
    const combo = document.getElementById('historyCombo');
    if (!combo) return;

    while (combo.firstChild) {
        combo.removeChild(combo.firstChild);
    }

    const defOpt = document.createElement('vscode-option');
    defOpt.value = 'default'; defOpt.textContent = '< Default Configuration >';
    if (selectedId === 'default' || !selectedId) defOpt.selected = true;
    combo.appendChild(defOpt);

    let matchCount = 0;
    state.historyList.forEach(item => {
        if (state.historyViewMode === 'scope-current-repo' && item.repo !== state.currentRepo) {
            return;
        }
        matchCount++;
        const opt = document.createElement('vscode-option');
        opt.value = item.id; opt.textContent = item.display;
        if (item.id === selectedId) opt.selected = true;
        combo.appendChild(opt);
    });

    let isSelectedHidden = state.historyViewMode === 'scope-current-repo' &&
        selectedId !== 'default' &&
        !state.historyList.some(h => h.id === selectedId && h.repo === state.currentRepo);

    const finalId = isSelectedHidden ? 'default' : (selectedId || 'default');
    if (isSelectedHidden) {
        state.currentSelectedId = 'default';
        applyHistorySelection('default');
    }

    combo.value = finalId;
    UIController.syncButtonsState(finalId);

    setTimeout(() => {
        combo.value = finalId;
        UIController.syncButtonsState(finalId);
    }, 50);
};

window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.command) {
        case 'checkPathsResult':
            const pathEl = document.getElementById('pathList');
            if (!pathEl) return;
            if (message.invalidPaths && message.invalidPaths.length > 0) {
                state.pathListInvalid = true;
                pathEl.classList.add('field-invalid');
                if (!pathEl.hasAttribute('data-orig-tooltip')) pathEl.setAttribute('data-orig-tooltip', pathEl.getAttribute('data-tooltip') || '');
                pathEl.setAttribute('data-tooltip', `⚠️ Error: The following paths do not exist:\n${message.invalidPaths.join('\n')}`);
            } else {
                state.pathListInvalid = false;
                if (pathEl.value.trim().length > 0) {
                    pathEl.classList.remove('field-invalid');
                    if (pathEl.hasAttribute('data-orig-tooltip')) {
                        pathEl.setAttribute('data-tooltip', pathEl.getAttribute('data-orig-tooltip'));
                        pathEl.removeAttribute('data-orig-tooltip');
                    }
                }
            }
            break;
        case 'updatePaths':
            state.selectedPaths = message.paths || [];
            document.getElementById('pathList').value = state.selectedPaths.join('\n');
            UIController.checkSyncStatus();
            ValidatorService.executeFieldValidation('pathList');
            break;
        case 'initSettings':
            state.defaultSettings = message.defaultSettings || {};
            if (message.tooltipDelay !== undefined) state.tooltipDelayValue = message.tooltipDelay;
            state.isInitializing = true;
            state.historyList = message.history || [];
            state.currentSelectedId = message.selectedId || 'default';
            state.historyViewMode = message.historyViewMode || 'scope-current-repo';
            state.currentRepo = message.currentRepo || '';

            const matchedEntriesCount = state.historyList.filter(h => state.historyViewMode === 'scope-all-repo' || h.repo === state.currentRepo).length;
            console.log(`[History Combo Init] ViewMode: "${state.historyViewMode}" | RepoName: "${state.currentRepo}" | MatchingEntries: ${matchedEntriesCount} / Total: ${state.historyList.length}`);

            updateHistoryViewToggleButton();
            updateHistoryCombo(state.currentSelectedId);
            applyFormFields(message.currentSettings);
            if (message.paths && message.paths.length > 0) {
                state.selectedPaths = message.paths;
                document.getElementById('pathList').value = state.selectedPaths.join('\n');
            }
            setTimeout(() => {
                state.isInitializing = false;
                UIController.checkSyncStatus();
                ValidatorService.executeFieldValidation('pathList');
            }, 50);
            break;
        case 'updateHistory':
            state.historyList = message.history || [];
            state.currentSelectedId = message.selectedId || state.currentSelectedId || 'default';
            updateHistoryCombo(state.currentSelectedId);
            if (!message.skipFieldSync) applyHistorySelection(state.currentSelectedId);
            UIController.checkSyncStatus();

            // ✨ Actionable Hook: Automatically enter inline rename mode if the event was triggered by an Add profile action
            if (state.currentSelectedId && state.currentSelectedId.endsWith('-new')) {
                enterInlineRenameMode();
            }
            break;
        case 'terminalLog':
            terminalTab.append(message.text);
            if (message.text.includes('Export complete!') || message.text.includes('Export aborted') || message.text.includes('ERROR:')) {
                resetRunButton();
            }
            break;
        case 'updateCommand': terminalTab.updateCommand(message.text); break;
        case 'updateExportReport':
            resetRunButton();
            try { reportTab.render(message.data); } catch (e) {}
            try {
                if (message.data) {
                    state.lastReportPayload = message.data;
                    state.totalExportedSourceFiles = message.data.summary?.total_exported || 0;

                    if (message.data.generated_files) {
                        state.lastGeneratedFilesPayload = JSON.parse(JSON.stringify(message.data.generated_files));
                        filesTab.render(
                            state.lastGeneratedFilesPayload,
                            document.getElementById('destDir').value,
                            (p) => bridge.postMessage('openFile',{path:p}),
                            (p) => bridge.postMessage('openFinder',{path:p}),
                            document.getElementById('splitChunkByFileExtension').checked,
                            state.totalExportedSourceFiles
                        );
                    }
                    treeViewTab.render(message.data, (p) => bridge.postMessage('openFile',{path:p}), (p) => bridge.postMessage('openFinder',{path:p}));
                }
            } catch (e) {}
            break;
        case 'filteredFilesResult':
            try {
                const payload = { ...state.lastGeneratedFilesPayload, exports: message.files };
                filesTab.render(
                    payload,
                    document.getElementById('destDir').value,
                    (p) => bridge.postMessage('openFile',{path:p}),
                    (p) => bridge.postMessage('openFinder',{path:p}),
                    document.getElementById('splitChunkByFileExtension').checked,
                    state.totalExportedSourceFiles
                );
            } catch (e) {}
            break;
    }
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
