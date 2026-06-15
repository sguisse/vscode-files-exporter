import { state } from '../core/state.manager.js';
import { bridge } from '../core/vscode.bridge.js';
import { ValidatorService } from './validator.service.js';
import { UIController } from '../core/ui.controller.js';

export const HistoryManager = {
    updateHistoryViewToggleButton() {
        const btn = document.getElementById('btn-toggle-history-view');
        if (btn) {
            btn.innerHTML = state.historyViewMode === 'scope-current-repo' ? '🏠' : '🌐';
        }
    },
    cancelInlineHistoryRename() {
        const combo = document.getElementById('historyCombo');
        const input = document.getElementById('historyRenameInput');
        if (combo && input) {
            input.style.display = 'none';
            combo.style.display = 'block';
        }
    },
    enterInlineRenameMode() {
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
    },
    applyHistorySelection(val) {
        if (window.reportTab) window.reportTab.clear();
        if (window.filesTab) window.filesTab.clear();
        if (window.treeViewTab) window.treeViewTab.clear();
        if (window.terminalTab) window.terminalTab.clear();
        const targetConfig = val === 'default' ? state.defaultSettings : state.historyList.find(h => h.id === val)?.config;
        this.applyFormFields(targetConfig);
        setTimeout(() => {
            ValidatorService.executeFieldValidation('pathList');
            ValidatorService.executeFieldValidation('destDir');
        }, 10);
    },
    resetCurrentConfigFields() {
        const targetConfig = state.currentSelectedId === 'default'
            ? state.defaultSettings
            : state.historyList.find(h => h.id === state.currentSelectedId)?.config;

        this.applyFormFields(targetConfig);
        ValidatorService.clearAllValidationStyles();
        setTimeout(() => {
            ValidatorService.executeFieldValidation('pathList');
            ValidatorService.executeFieldValidation('destDir');
            UIController.checkSyncStatus();
        }, 10);
    },
    applyFormFields(cfg) {
        if (!cfg) return;
        state.selectedPaths = cfg.src ? cfg.src.split(/[\n,;]/).map(p => p.trim()).filter(p => p) : [];
        const pathListEl = document.getElementById('pathList');
        if (pathListEl) pathListEl.value = state.selectedPaths.join('\n');
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
    },
    updateHistoryCombo(selectedId) {
        const combo = document.getElementById('historyCombo');
        if (!combo) return;

        while (combo.firstChild) {
            combo.removeChild(combo.firstChild);
        }

        const defOpt = document.createElement('vscode-option');
        defOpt.value = 'default'; defOpt.textContent = '< Default Configuration >';
        combo.appendChild(defOpt);

        state.historyList.forEach(item => {
            if (state.historyViewMode === 'scope-current-repo' && item.repo !== state.currentRepo) {
                return;
            }
            const opt = document.createElement('vscode-option');
            opt.value = item.id; opt.textContent = item.display;
            combo.appendChild(opt);
        });

        let isSelectedHidden = state.historyViewMode === 'scope-current-repo' &&
            selectedId !== 'default' &&
            !state.historyList.some(h => h.id === selectedId && h.repo === state.currentRepo);

        const finalId = isSelectedHidden ? 'default' : (selectedId || 'default');
        if (isSelectedHidden) {
            state.currentSelectedId = 'default';
            this.applyHistorySelection('default');
        }

        // ====================================================================
        // FIX CRITIQUE : Le WebComponent a besoin d'un court délai pour
        // mapper les <vscode-option> créés avec sa propriété interne 'value'.
        // ====================================================================
        setTimeout(() => {
            combo.value = finalId;
            UIController.syncButtonsState(finalId);
        }, 50);
    }
};
