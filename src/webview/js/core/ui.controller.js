import { state } from './state.manager.js';
import { ValidatorService } from '../services/validator.service.js';

export const UIController = {
    initCursorTooltipTracker() {
        const tooltipEl = document.getElementById('global-cursor-tooltip');
        let tooltipTimeout = null;
        let activeTarget = null;
        document.body.addEventListener('mousemove', (e) => {
            const target = e.target.closest('[data-tooltip]');
            if (target) {
                if (activeTarget !== target) {
                    activeTarget = target;
                    if (tooltipTimeout) clearTimeout(tooltipTimeout);
                    if (tooltipEl) tooltipEl.style.display = 'none';
                    tooltipTimeout = setTimeout(() => {
                        if (tooltipEl && activeTarget) {
                            tooltipEl.innerHTML = activeTarget.getAttribute('data-tooltip');
                            tooltipEl.style.display = 'block';
                            this.positionTooltipAtCursor(e, tooltipEl);
                        }
                    }, state.tooltipDelayValue);
                } else {
                    if (tooltipEl && tooltipEl.style.display === 'block') this.positionTooltipAtCursor(e, tooltipEl);
                }
            } else {
                if (activeTarget) {
                    activeTarget = null;
                    if (tooltipTimeout) clearTimeout(tooltipTimeout);
                    if (tooltipEl) tooltipEl.style.display = 'none';
                }
            }
        });
    },

    positionTooltipAtCursor(e, tooltipEl) {
        const mouseX = e.clientX, mouseY = e.clientY, offset = 15;
        const rect = tooltipEl.getBoundingClientRect();
        let targetTop = mouseY - (rect.height / 2);
        if (targetTop < 5) targetTop = 5;
        if (targetTop + rect.height > window.innerHeight - 5) targetTop = window.innerHeight - rect.height - 5;
        tooltipEl.style.top = `${targetTop}px`;
        if (mouseX + offset + rect.width > window.innerWidth) tooltipEl.style.left = `${mouseX - rect.width - offset}px`;
        else tooltipEl.style.left = `${mouseX + offset}px`;
    },

    checkSyncStatus() {
        if (state.isInitializing) return true;
        const combo = document.getElementById('historyCombo');
        const resetBtn = document.getElementById('btn-reset-config');
        if (!combo) return true;

        let currentConfig = state.defaultSettings;
        let isFrozen = false;

        if (state.currentSelectedId !== 'default') {
            const selected = state.historyList.find(h => h.id === state.currentSelectedId);
            if (selected) {
                currentConfig = selected.config;
                isFrozen = !!selected.frozen;
            }
        }

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

        const targetConfig = {
            src: currentConfig.src || '', dest: currentConfig.dest || '',
            format: currentConfig.format || 'yaml', max_file: currentConfig.max_file || '50',
            max_chunk: currentConfig.max_chunk || '0', groupByExt: !!currentConfig.groupByExt,
            copyGeneratedFilesToClipboard: !!currentConfig.copyGeneratedFilesToClipboard,
            generateTreeView: currentConfig.generateTreeView !== false,
            logConsole: currentConfig.logConsole !== false, logFile: !!currentConfig.logFile,
            inc_paths: currentConfig.inc_paths || '', exc_paths: currentConfig.exc_paths || '',
            inc_ext: currentConfig.inc_ext || '', exc_ext: currentConfig.exc_ext || ''
        };

        let isSync = true;
        for (const key in screenConfig) {
            if (String(screenConfig[key]) !== String(targetConfig[key])) {
                isSync = false;
                break;
            }
        }

        if (!isSync) {
            combo.classList.add('combo-warning');
            combo.setAttribute('data-tooltip', 'Config file and screen fields are not synchronized.');
        } else {
            combo.classList.remove('combo-warning');
            combo.removeAttribute('data-tooltip');
        }

        if (resetBtn) resetBtn.disabled = isSync;

        // Defer dynamic button alterations to completely insulate ongoing mouse up/down events from DOM replacement cycles
        setTimeout(() => {
            const runBtn = document.getElementById('btn-run');
            if (runBtn && !runBtn.classList.contains('loading')) {
                const currentSyncAttr = runBtn.getAttribute('data-last-sync');
                const currentFrozenAttr = runBtn.getAttribute('data-last-frozen');
                const isSyncStr = String(isSync);
                const isFrozenStr = String(isFrozen);

                if (currentSyncAttr !== isSyncStr || currentFrozenAttr !== isFrozenStr) {
                    runBtn.setAttribute('data-last-sync', isSyncStr);
                    runBtn.setAttribute('data-last-frozen', isFrozenStr);

                    let iconHtml = '<span class="codicon codicon-play" style="font-size: 16px;"></span>';
                    if (!isSync) {
                        if (!isFrozen) {
                            iconHtml = '<span class="codicon codicon-save" data-tooltip="Configuration is modified and will be auto-saved on run." style="margin-right: 6px; cursor: help;"></span>' + iconHtml;
                        } else {
                            iconHtml = '<span class="codicon codicon-beaker" data-tooltip="Profile is locked. Modifications will not be saved (Test/Tuning mode)." style="margin-right: 6px; cursor: help;"></span>' + iconHtml;
                        }
                    }
                    runBtn.innerHTML = iconHtml + '<div style="display: flex; flex-direction: column; align-items: center; gap: 2px;"><span>RUN</span><span>EXPORT</span></div>';
                }
            }
        }, 150);

        return isSync;
    },

    syncButtonsState(val) {
        const btnFreeze = document.getElementById('btn-freeze-history');
        const btnEdit = document.getElementById('btn-edit-history');
        const btnDup = document.getElementById('btn-duplicate-history');

        if (btnDup) btnDup.disabled = false;

        if (!val || val === 'default') {
            btnFreeze.disabled = true;
            btnFreeze.innerHTML = '<span class="codicon codicon-lock" style="cursor: not-allowed;"></span>';
            btnFreeze.setAttribute('data-tooltip', 'Default config can only be modified from settings!<br/>You can create a new configuration:<br/> - From settings with <span class="codicon codicon-add"></span><br/> - Adapt any config and duplicate it with <span class="codicon codicon-files"></span>');
            btnFreeze.style.cursor = 'not-allowed';

            if(btnEdit) btnEdit.disabled = true;
        } else {
            if(btnFreeze) {
                btnFreeze.disabled = false;
                btnFreeze.setAttribute('data-tooltip', 'Freeze or unfreeze profile. Unfreezing allows overwriting and re-naming configurations');
                btnFreeze.style.cursor = '';
            }
            const entry = state.historyList.find(h => h.id === val);
            if (entry) {
                if(btnFreeze) btnFreeze.innerHTML = entry.frozen ? '<span class="codicon codicon-lock"></span>' : '<span class="codicon codicon-unlock"></span>';
                if(btnEdit) btnEdit.disabled = entry.frozen;
            }
        }
    },

    injectShadowDomStyles() {
        if (document.getElementById('qa-validation-styles')) return;
        const style = document.createElement('style');
        style.id = 'qa-validation-styles';
        style.innerHTML = `
            .field-invalid { border: 2px solid #d32f2f !important; --input-background: #ffcdd2 !important; --background-color: #ffcdd2 !important; }
            .field-invalid::part(control), .field-invalid::part(root) { background-color: #ffcdd2 !important; color: #1e1e1e !important; }
            .combo-warning { border: 2px solid #fbc02d !important; --dropdown-background: #fff9c4 !important; --background-color: #fff9c4 !important; }
            .combo-warning::part(control), .combo-warning::part(indicator) { background-color: #fff9c4 !important; color: #1e1e1e !important; }

            /* Rich Notification Toast Styles */
            .rich-toast { position: fixed; z-index: 9999999; padding: 14px 18px; border-radius: 5px; color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: 13px; box-shadow: 0 4px 16px rgba(0,0,0,0.5); opacity: 0; transition: opacity 0.3s ease; display: flex; flex-direction: column; gap: 8px; background: var(--vscode-editorWidget-background, #252526); border: 1px solid var(--vscode-widget-border, #454545); min-width: 320px; max-width: 450px; pointer-events: auto; }
            .toast-info { border-left: 4px solid var(--vscode-notificationsInfoIcon-foreground, #3794ff); }
            .toast-success { border-left: 4px solid #28a745; }
            .toast-warn { border-left: 4px solid var(--vscode-notificationsWarningIcon-foreground, #cca700); }
            .toast-error { border-left: 4px solid var(--vscode-notificationsErrorIcon-foreground, #f14c4c); }

            .toast-header { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; color: var(--vscode-editorWidget-foreground); }
            .toast-body { font-size: 12px; line-height: 1.5; color: var(--vscode-descriptionForeground, #cccccc); }
            .toast-body b { color: var(--vscode-foreground); }
            .toast-body code { background: var(--vscode-textCodeBlock-background, rgba(0,0,0,0.4)); padding: 2px 5px; border-radius: 3px; font-family: var(--vscode-editor-font-family); word-break: break-all; border: 1px solid var(--vscode-panel-border); }
            .toast-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px; }

            /* Positions */
            .toast-top-left { top: 20px; left: 20px; }
            .toast-top-center { top: 20px; left: 50%; transform: translateX(-50%); }
            .toast-top-right { top: 20px; right: 20px; }
            .toast-center { top: 50%; left: 50%; transform: translate(-50%, -50%); }
            .toast-bottom-left { bottom: 20px; left: 20px; }
            .toast-bottom-center { bottom: 20px; left: 50%; transform: translateX(-50%); }
            .toast-bottom-right { bottom: 20px; right: 20px; }
        `;
        document.body.appendChild(style);
    }
};
