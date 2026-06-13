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

let isModifierPressed = false;

const setRunButtonLoading = () => {
    const btn = document.getElementById('btn-run');
    if (btn) {
        btn.classList.add('loading');
        btn.disabled = false;
        btn.innerHTML = '<span class="codicon codicon-sync spin-anim"></span> EXPORT IN PROGRESS... <span id="btn-kill-task" title="Kill active export process immediately" style="margin-left: 12px; background: #b71c1c; color: #ffffff; padding: 2px 6px; border-radius: 3px; font-size: 11px; display: inline-flex; align-items: center; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.4); cursor: pointer !important;">🛑 KILL</span>';

        setTimeout(() => {
            document.getElementById('btn-kill-task')?.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                bridge.postMessage('killExport');
            });
        }, 20);
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

const renderExchangeIconButtons = (exchangeItems) => {
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
        }

        const img = document.createElement('img');
        img.src = item.icon;
        img.alt = item.tooltip || 'Exchange Link';
        img.style.width = item.width || '64px';
        img.style.height = item.height || '64px';

        btn.appendChild(img);
        btn.addEventListener('click', () => {
            bridge.postMessage('openBrowserTab', {
                url: item.url,
                openInVSCode: item.openInVSCode !== false
            });
        });

        container.appendChild(btn);
    });
};

const renderPredefinedInclusionsMenu = () => {
    const menu = document.getElementById('predefined-inclusions-menu');
    if (!menu) return;
    menu.innerHTML = '';

    if (!state.predefinedInclusions || state.predefinedInclusions.length === 0) {
        menu.innerHTML = '<div style="padding: 6px 10px; font-size: 11px; font-style: italic; color: var(--vscode-descriptionForeground);">No inclusions configured</div>';
        return;
    }

    state.predefinedInclusions.forEach(item => {
        const row = document.createElement('div');
        row.className = 'predefined-item-row';
        row.style.cssText = 'padding: 6px 10px; cursor: pointer; font-size: 12px; font-family: var(--vscode-font-family); border-radius: 2px; margin: 1px 2px; transition: background 0.15s, color 0.15s;';
        row.innerText = item.label;

        if (isModifierPressed) {
            row.style.background = '#ffcdd2';
            row.style.color = '#b71c1c';
            row.setAttribute('data-tooltip', '⚠️ DESTRUCTIVE: Click to completely OVERWRITE and REPLACE field content!');
        } else {
            row.style.background = 'transparent';
            row.style.color = 'var(--vscode-dropdown-foreground, #cccccc)';
            row.setAttribute('data-tooltip', 'Click to APPEND extensions on a new line.');
        }

        row.addEventListener('mouseenter', () => {
            if (isModifierPressed) {
                row.style.background = '#ef9a9a';
                row.style.color = '#7f0000';
            } else {
                row.style.background = 'var(--vscode-list-hoverBackground, #2a2d2e)';
                row.style.color = 'var(--vscode-list-hoverForeground, #ffffff)';
            }
        });

        row.addEventListener('mouseleave', () => {
            if (isModifierPressed) {
                row.style.background = '#ffcdd2';
                row.style.color = '#b71c1c';
            } else {
                row.style.background = 'transparent';
                row.style.color = 'var(--vscode-dropdown-foreground, #cccccc)';
            }
        });

        row.addEventListener('click', (e) => {
            e.stopPropagation();
            const shouldReplace = e.ctrlKey || e.metaKey || isModifierPressed;
            applyPredefinedExtensions(item.extensions, shouldReplace);
            menu.style.display = 'none';
        });

        menu.appendChild(row);
    });
};

const updateMenuHotkeysLayout = () => {
    const menu = document.getElementById('predefined-inclusions-menu');
    const kebabBtn = document.getElementById('btn-predefined-inclusions');

    if (kebabBtn) {
        if (isModifierPressed) {
            kebabBtn.setAttribute('data-tooltip', 'Predefined extensions (REPLACE mode active)');
        } else {
            kebabBtn.setAttribute('data-tooltip', 'Predefined extension inclusions');
        }
    }

    if (!menu || menu.style.display !== 'block') return;
    renderPredefinedInclusionsMenu();
};

const applyPredefinedExtensions = (extensions, shouldReplace) => {
    const incExtsEl = document.getElementById('incExts');
    if (!incExtsEl || !extensions) return;

    let lines = [];
    if (!shouldReplace) {
        let currentVal = incExtsEl.value.trim();
        lines = currentVal ? currentVal.split('\n').map(l => l.trim()) : [];
    }

    extensions.forEach(ext => {
        let cleanExt = ext.replace(/^\*/, '').trim();
        if (cleanExt.startsWith('.')) {
            cleanExt = cleanExt.slice(1);
        }
        if (!cleanExt) return;

        const pattern = `.*\\.${cleanExt}$`;
        if (!lines.includes(pattern)) {
            lines.push(pattern);
        }
    });

    incExtsEl.value = lines.join('\n');
    incExtsEl.dispatchEvent(new Event('input', { bubbles: true }));
    incExtsEl.dispatchEvent(new Event('change', { bubbles: true }));
    UIController.checkSyncStatus();
};

const triggerGuardrailValidationFlow = (pathsArray, onSuccess) => {
    let outUserHome = false;
    let homeRootBare = false;
    const userHome = '/Users/mac-SGUISS21';
    const normalizedHome = userHome.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');

    pathsArray.forEach(p => {
        let clean = p.replace(/^['"]|['"]$/g, '').trim().toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
        if (!clean) return;

        if (!clean.startsWith(normalizedHome)) {
            outUserHome = true;
        }
        if (clean === normalizedHome) {
            homeRootBare = true;
        }
    });

    if (!outUserHome && !homeRootBare) {
        onSuccess();
        return;
    }

    let titleText = "⚠️ Performance & Scope Warning";
    let warningMsg = "Crawling external system storage folders outside User Home can induce severe indexing lag and memory degradation regressions. Are you sure you want to proceed?";

    if (homeRootBare && !outUserHome) {
        titleText = "🛑 Performance Warning";
        warningMsg = "You have targeted your root User Home directory directly without subfolders. This forces an evaluation across every single app state storage, cache workspace, and document tree asset. This will heavily degrade indexing performance and exhaust token allocations. Do you want to continue?";
    }

    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 999999; display: flex; align-items: center; justify-content: center;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground, #cccccc); padding: 20px; border-radius: 6px; border: 1px solid var(--vscode-panel-border); min-width: 450px; max-width: 550px; box-shadow: 0 4px 16px rgba(0,0,0,0.6); font-family: var(--vscode-font-family); box-sizing: border-box;';

    modal.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 12px; font-size: 14px; color: #ffc107;">${titleText}</div>
        <div style="font-size: 12px; margin-bottom: 20px; line-height: 1.5; white-space: normal; word-wrap: break-word;">${warningMsg}</div>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <vscode-button id="btn-guardrail-proceed" appearance="primary">Proceed Anyway</vscode-button>
            <vscode-button id="btn-guardrail-cancel" appearance="secondary">Cancel Run</vscode-button>
        </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const closeModal = () => document.body.removeChild(backdrop);

    document.getElementById('btn-guardrail-cancel')?.addEventListener('click', () => {
        closeModal();
        terminalTab.append("\n🚫 Operation aborted by user: Target path safely bypassed via layout guardrail definitions.\n");
        resetRunButton();
    });

    document.getElementById('btn-guardrail-proceed')?.addEventListener('click', () => {
        closeModal();
        onSuccess();
    });
};

/**
 * Parses and computes the exact line string index corresponding to absolute cursor selection values
 */
const saveActiveTextareaCursorIndex = () => {
    const textarea = document.getElementById('pathList');
    const hiddenInput = document.getElementById('hiddenPathListCursorIndex');
    if (!textarea || !hiddenInput) return;

    // Retrieve internal textarea reference from underlying Web Component shadow DOM layers if present
    const nativeTextarea = textarea.shadowRoot?.querySelector('textarea') || textarea;
    const selectionStart = nativeTextarea.selectionStart || 0;
    const textContent = nativeTextarea.value || '';

    // Calculate line index by slicing content up to selection position boundaries
    const textUpToCursor = textContent.substring(0, selectionStart);
    const lineIndex = textUpToCursor.split('\n').length;

    hiddenInput.value = lineIndex.toString();
};

const init = () => {
    UIController.injectShadowDomStyles();
    UIController.initCursorTooltipTracker();

    helpTab.render();

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Control' || e.key === 'Meta') {
            if (!isModifierPressed) {
                isModifierPressed = true;
                updateMenuHotkeysLayout();
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'Control' || e.key === 'Meta') {
            if (isModifierPressed) {
                isModifierPressed = false;
                updateMenuHotkeysLayout();
            }
        }
    });

    document.getElementById('btn-predefined-inclusions')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = document.getElementById('predefined-inclusions-menu');
        if (menu) {
            const isOpening = menu.style.display !== 'block';
            if (isOpening) {
                renderPredefinedInclusionsMenu();
                menu.style.display = 'block';
            } else {
                menu.style.display = 'none';
            }
        }
    });

    document.addEventListener('click', () => {
        const menu = document.getElementById('predefined-inclusions-menu');
        if (menu) menu.style.display = 'none';
    });

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

    // Wire selection monitoring listeners across all structural interaction pipelines
    const pathListTextArea = document.getElementById('pathList');
    if (pathListTextArea) {
        const targetTextarea = pathListTextArea.shadowRoot?.querySelector('textarea') || pathListTextArea;
        targetTextarea.addEventListener('blur', saveActiveTextareaCursorIndex);
        targetTextarea.addEventListener('keyup', saveActiveTextareaCursorIndex);
        targetTextarea.addEventListener('click', saveActiveTextareaCursorIndex);
    }

    document.getElementById('btn-open-cursor-line')?.addEventListener('click', () => {
        const textarea = document.getElementById('pathList');
        const hiddenInput = document.getElementById('hiddenPathListCursorIndex');
        if (!textarea || !hiddenInput) return;

        const text = textarea.value || '';
        const lines = text.split('\n');

        // Fetch target index line reference from persistent internal overlay parameter container
        let savedLineIndex = parseInt(hiddenInput.value || '1', 10);
        if (isNaN(savedLineIndex) || savedLineIndex < 1) savedLineIndex = 1;
        if (savedLineIndex > lines.length) savedLineIndex = lines.length;

        const lineContent = (lines[savedLineIndex - 1] || '').trim();
        bridge.postMessage('openPathAtCursor', { path: lineContent, lineNum: savedLineIndex });
    });

    document.getElementById('btn-run')?.addEventListener('click', (e) => {
        const btn = document.getElementById('btn-run');
        if (btn && btn.classList.contains('loading')) return;

        let isFormValid = true;
        Object.keys(ValidatorService.validators).forEach(id => {
            if (!ValidatorService.executeFieldValidation(id)) isFormValid = false;
        });
        if (state.pathListInvalid) isFormValid = false;
        if (!isFormValid) {
            terminalTab.append("\n❌ Export aborted: Please fix the highlighted fields in red pastel before running.\n");
            return;
        }

        const pathsArray = (document.getElementById('pathList')?.value || '').split('\n').map(p => p.trim()).filter(p => p);

        triggerGuardrailValidationFlow(pathsArray, () => {
            runExport();
        });
    });

    document.getElementById('btn-copy-cmd')?.addEventListener('click', () => terminalTab.copyCommand());

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

            case 'excludeExplorerPathSelection':
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
                            if (!lines.includes(regexEntry)) {
                                excPathsEl.value = currentVal + '\n' + regexEntry;
                            }
                        }

                        excPathsEl.dispatchEvent(new Event('input', { bubbles: true }));
                        excPathsEl.dispatchEvent(new Event('change', { bubbles: true }));
                        UIController.checkSyncStatus();

                        bridge.postMessage('showNotification', {
                            type: 'info',
                            text: 'Added pattern to Exclude Paths: ' + regexEntry
                        });
                    }
                } catch(err) { console.error(err); }
                break;
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
            state.predefinedInclusions = message.predefinedInclusions || [];

            const matchedEntriesCount = state.historyList.filter(h => state.historyViewMode === 'scope-all-repo' || h.repo === state.currentRepo).length;
            console.log(`[History Combo Init] ViewMode: "${state.historyViewMode}" | RepoName: "${state.currentRepo}" | MatchingEntries: ${matchedEntriesCount} / Total: ${state.historyList.length}`);

            updateHistoryViewToggleButton();
            updateHistoryCombo(state.currentSelectedId);
            applyFormFields(message.currentSettings);
            if (message.paths && message.paths.length > 0) {
                state.selectedPaths = message.paths;
                document.getElementById('pathList').value = state.selectedPaths.join('\n');
            }

            renderExchangeIconButtons(message.exchange);
            renderPredefinedInclusionsMenu();

            setTimeout(() => {
                state.isInitializing = false;
                UIController.checkSyncStatus();
                ValidatorService.executeFieldValidation('pathList');
            }, 50);
            break;
        case 'updatePredefinedInclusions':
            state.predefinedInclusions = message.predefinedInclusions || [];
            renderPredefinedInclusionsMenu();
            break;
        case 'updateHistory':
            state.historyList = message.history || [];
            state.currentSelectedId = message.selectedId || state.currentSelectedId || 'default';
            updateHistoryCombo(state.currentSelectedId);
            if (!message.skipFieldSync) applyHistorySelection(state.currentSelectedId);
            UIController.checkSyncStatus();

            if (state.currentSelectedId && state.currentSelectedId.endsWith('-new')) {
                enterInlineRenameMode();
            }
            break;
        case 'terminalLog':
            terminalTab.append(message.text);

            if (message.text.includes('Export process killed manually')) {
                resetRunButton();
                resetCurrentConfigFields();
                reportTab.clear();
                filesTab.clear();
                treeViewTab.clear();
                break;
            }

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
                            (p) => bridge.postMessage('openFile', {path:p}),
                            (p) => bridge.postMessage('openFinder', {path:p}),
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
                    (p) => bridge.postMessage('openFile', {path:p}),
                    (p) => bridge.postMessage('openFinder', {path:p}),
                    document.getElementById('splitChunkByFileExtension').checked,
                    state.totalExportedSourceFiles
                );
            } catch (e) {}
            break;
    }
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
