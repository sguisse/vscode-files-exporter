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
        if (state.isInitializing) return;
        const combo = document.getElementById('historyCombo');
        if (!combo) return;
        let currentConfig = state.defaultSettings;
        if (state.currentSelectedId !== 'default') {
            const selected = state.historyList.find(h => h.id === state.currentSelectedId);
            if (selected) currentConfig = selected.config;
        }
        const getVal = (id) => document.getElementById(id)?.value || '';
        const getCheck = (id) => !!document.getElementById(id)?.checked;
        const pathsStr = (document.getElementById('pathList')?.value || '').split('\n').map(p => p.trim()).filter(p => p).join(', ');

        const screenConfig = {
            src: pathsStr, dest: getVal('destDir'), format: getVal('format'),
            max_file: getVal('maxFile'), max_chunk: getVal('maxChunk'),
            groupByExt: getCheck('splitChunkByFileExtension'),
            logConsole: getCheck('generateLogConsole'), logFile: getCheck('generateLogFile'),
            inc_paths: getVal('incPaths'), exc_paths: getVal('excPaths'),
            inc_ext: getVal('incExts'), exc_ext: getVal('excExts')
        };
        const targetConfig = {
            src: currentConfig.src || '', dest: currentConfig.dest || '',
            format: currentConfig.format || 'yaml', max_file: currentConfig.max_file || '50',
            max_chunk: currentConfig.max_chunk || '0', groupByExt: !!currentConfig.groupByExt,
            logConsole: currentConfig.logConsole !== false, logFile: !!currentConfig.logFile,
            inc_paths: currentConfig.inc_paths || '', exc_paths: currentConfig.exc_paths || '',
            inc_ext: currentConfig.inc_ext || '', exc_ext: currentConfig.exc_ext || ''
        };
        let isSync = true;
        for (const key in screenConfig) if (String(screenConfig[key]) !== String(targetConfig[key])) { isSync = false; break; }
        if (!isSync) {
            combo.classList.add('combo-warning');
            combo.setAttribute('data-tooltip', 'config file and screen fields are not sync, to sync unlock and run an export to save the config');
        } else {
            combo.classList.remove('combo-warning');
            combo.removeAttribute('data-tooltip');
        }
    },
    syncButtonsState(val) {
        const btnFreeze = document.getElementById('btn-freeze-history'), btnEdit = document.getElementById('btn-edit-history'), btnDup = document.getElementById('btn-duplicate-history');
        if (!val || val === 'default') {
            if(btnFreeze) { btnFreeze.disabled = true; btnFreeze.innerHTML = '<span class="codicon codicon-unlock"></span>'; }
            if(btnEdit) btnEdit.disabled = true;
            if(btnDup) btnDup.disabled = true;
        } else {
            if(btnFreeze) btnFreeze.disabled = false;
            if(btnDup) btnDup.disabled = false;
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
        `;
        document.body.appendChild(style);
    }
};
