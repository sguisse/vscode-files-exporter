import { bridge } from '../core/vscode.bridge.js';
import { state } from '../core/state.manager.js';
import { ValidatorService } from './validator.service.js';
import { ModalComponent } from '../components/modal.component.js';
import { UIController } from '../core/ui.controller.js';

export const ExportManager = {
    setRunButtonLoading() {
        const btn = document.getElementById('btn-run');
        if (btn) {
            btn.classList.add('loading');
            btn.disabled = false;
            btn.innerHTML = '<span class="codicon codicon-sync spin-anim" style="font-size: 16px;"></span><div style="display: flex; flex-direction: column; align-items: center; gap: 2px;"><span>EXPORTING...</span></div><span id="btn-kill-task" title="Kill active export process immediately" style="margin-left: 12px; background: #b71c1c; color: #ffffff; padding: 2px 6px; border-radius: 3px; font-size: 11px; display: inline-flex; align-items: center; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.4); cursor: pointer !important;">🛑 KILL</span>';

            setTimeout(() => {
                document.getElementById('btn-kill-task')?.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    bridge.postMessage('killExport');
                });
            }, 20);
        }
    },
    resetRunButton() {
        const btn = document.getElementById('btn-run');
        if (btn) {
            btn.classList.remove('loading');
            btn.disabled = false;
            btn.innerHTML = '<span class="codicon codicon-play" style="font-size: 16px;"></span><div style="display: flex; flex-direction: column; align-items: center; gap: 2px;"><span>RUN</span><span>EXPORT</span></div>';
            UIController.checkSyncStatus();
        }
    },
    runExport() {
        const btn = document.getElementById('btn-run');
        if (btn && btn.classList.contains('loading')) return;

        if (window.terminalTab) window.terminalTab.clear();
        let isFormValid = true;

        Object.keys(ValidatorService.validators).forEach(id => {
            const isValid = ValidatorService.executeFieldValidation(id);
            if (!isValid) isFormValid = false;
        });

        if (state.pathListInvalid) isFormValid = false;

        if (!isFormValid) {
            const message = "Export aborted: Please fix the highlighted fields in RED before running.";
            bridge.postMessage("showNotification", { type: "error", text: "❌  " + message });
            ModalComponent.triggerValidationErrorModal("❌  " + message);
            if (window.terminalTab) window.terminalTab.append("\n❌  " + message + "\n");
            return;
        }

        const pathsArray = (document.getElementById('pathList')?.value || '').split('\n').map(p => p.trim()).filter(p => p);

        ModalComponent.triggerGuardrailValidationFlow(pathsArray, () => {
            this.setRunButtonLoading();
            if (window.terminalTab) window.terminalTab.append("⏳ Starting export process...\n");

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
        }, () => {
            if (window.terminalTab) window.terminalTab.append("\n🚫 Operation aborted by user: Target path safely bypassed via layout guardrail definitions.\n");
            this.resetRunButton();
        });
    }
};
