#!/bin/bash
set -e

# Ensure target directory exists
mkdir -p src/webview/js/components

# 1. Create the new mutualized utility file: src/webview/js/components/popup-modal-utils.js
cat << 'EOF' > src/webview/js/components/popup-modal-utils.js
export const PopupModalUtils = {
    makeResizable(modal) {
        modal.style.position = 'relative';
        modal.style.overflow = 'hidden';
        modal.style.display = 'flex';
        modal.style.flexDirection = 'column';

        const handle = document.createElement('div');
        handle.style.cssText = 'position: absolute; right: 4px; bottom: 4px; width: 10px; height: 10px; cursor: se-resize; border-right: 2px solid var(--vscode-panel-border); border-bottom: 2px solid var(--vscode-panel-border); opacity: 0.6; z-index: 1000000;';
        modal.appendChild(handle);

        let isResizing = false;
        let startWidth, startHeight, startX, startY;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = modal.getBoundingClientRect().width;
            startHeight = modal.getBoundingClientRect().height;

            modal.style.width = `${startWidth}px`;
            modal.style.height = `${startHeight}px`;

            e.preventDefault();
            e.stopPropagation();

            const doResize = (moveEvent) => {
                if (!isResizing) return;
                modal.style.width = `${startWidth + (moveEvent.clientX - startX)}px`;
                modal.style.height = `${startHeight + (moveEvent.clientY - startY)}px`;
            };

            const stopResize = () => {
                isResizing = false;
                window.removeEventListener('mousemove', doResize);
                window.removeEventListener('mouseup', stopResize);
            };

            window.addEventListener('mousemove', doResize);
            window.addEventListener('mouseup', stopResize);
        });
    }
};
EOF

# 2. Fully rewrite src/webview/js/components/modal.component.js to import and use the shared utility
cat << 'EOF' > src/webview/js/components/modal.component.js
import { state } from '../core/state.manager.js';
import { PopupModalUtils } from './popup-modal-utils.js';

export const ModalComponent = {
    triggerGuardrailValidationFlow(pathsArray, onSuccess, onCancel) {
        let outUserHome = false; let homeRootBare = false;
        const normalizedHome = '/users/mac-sguiss21';
        pathsArray.forEach(p => {
            let clean = p.replace(/^['"]|['"]$/g, '').trim().toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
            if (!clean) return;
            if (!clean.startsWith(normalizedHome)) outUserHome = true;
            if (clean === normalizedHome) homeRootBare = true;
        });
        if (!outUserHome && !homeRootBare) { onSuccess(); return; }
        const backdrop = document.createElement('div');
        backdrop.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 999999; display: flex; align-items: center; justify-content: center;';
        backdrop.innerHTML = `<div style="background: var(--panel-view-background); padding: 20px; border-radius: 6px; border: 1px solid var(--vscode-panel-border); min-width: 450px; min-height: 160px; box-sizing: border-box;">
            <div style="font-weight:600; color:#ffc107; margin-bottom:12px;">⚠️ Performance & Scope Warning</div>
            <div style="margin-bottom:20px; font-size:12px;">Crawling risk detected. Proceed?</div>
            <div style="display:flex; gap:10px; justify-content:flex-end; margin-top: auto;">
                <vscode-button id="btn-guardrail-proceed" appearance="primary">Proceed Anyway</vscode-button>
                <vscode-button id="btn-guardrail-cancel" appearance="secondary">Cancel Run</vscode-button>
            </div>
        </div>`;
        document.body.appendChild(backdrop);

        if (backdrop.firstElementChild) {
            PopupModalUtils.makeResizable(backdrop.firstElementChild);
        }

        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeGuardrail();
                onCancel();
            }
        };
        window.addEventListener('keydown', handleEsc);

        const closeGuardrail = () => {
            if (backdrop.parentElement) document.body.removeChild(backdrop);
            window.removeEventListener('keydown', handleEsc);
        };

        document.getElementById('btn-guardrail-cancel')?.addEventListener('click', () => { closeGuardrail(); onCancel(); });
        document.getElementById('btn-guardrail-proceed')?.addEventListener('click', () => { closeGuardrail(); onSuccess(); });
    },
    triggerValidationErrorModal(errorText) {
        const backdrop = document.createElement('div');
        backdrop.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 999999; display: flex; align-items: center; justify-content: center;';
        backdrop.innerHTML = `<div style="background: var(--vscode-editor-background, #1e1e1e); padding: 20px; border-radius: 6px; border: 1px solid var(--vscode-panel-border); min-width: 400px; min-height: 140px; box-sizing: border-box;">
            <div style="font-weight:600; color:#f44336; margin-bottom:12px;">🛑 Validation Failure</div>
            <div style="margin-bottom:20px; font-size:12px;">${errorText}</div>
            <div style="display:flex; justify-content:flex-end; margin-top: auto;"><vscode-button id="btn-validation-error-close" appearance="primary">Close</vscode-button></div>
        </div>`;
        document.body.appendChild(backdrop);

        if (backdrop.firstElementChild) {
            PopupModalUtils.makeResizable(backdrop.firstElementChild);
        }

        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeError();
            }
        };
        window.addEventListener('keydown', handleEsc);

        const closeError = () => {
            if (backdrop.parentElement) document.body.removeChild(backdrop);
            window.removeEventListener('keydown', handleEsc);
        };

        document.getElementById('btn-validation-error-close')?.addEventListener('click', closeError);
    }
};
EOF

# 3. Fully rewrite src/webview/js/components/error-files-modal.component.js to use the shared utility
cat << 'EOF' > src/webview/js/components/error-files-modal.component.js
import { bridge } from '../core/vscode.bridge.js';
import { PopupModalUtils } from './popup-modal-utils.js';

export const ErrorFilesModalComponent = {
    render() {
        if (document.getElementById('error-files-modal-backdrop')) return;

        const backdrop = document.createElement('div');
        backdrop.id = 'error-files-modal-backdrop';
        backdrop.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 999999; display: flex; align-items: center; justify-content: center; font-family: var(--vscode-font-family);';

        backdrop.innerHTML = `
            <div style="background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground, #ccc); padding: 20px; border-radius: 6px; border: 1px solid var(--vscode-panel-border); width: 600px; min-height: 480px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); box-sizing: border-box;">
                <div style="font-weight: 600; color: #00bcd4; font-size: 14px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 6px;">⚠️ Error files identification</div>

                <div>
                    <label style="display: block; margin-bottom: 4px; font-size: 12px; font-weight: 500;">Stack Type / Engine Runtime Selection:</label>
                    <div style="display: flex; gap: 15px; align-items: center; width: 100%;">
                        <vscode-dropdown id="error-stack-type" style="flex-grow: 1;">
                            <vscode-option value="Java">Java</vscode-option>
                            <vscode-option value="Browser console">Browser console</vscode-option>
                            <vscode-option value="python">Python</vscode-option>
                        </vscode-dropdown>
                        <vscode-checkbox id="error-include-out-workspace" style="flex-shrink: 0;">Include out workspace files</vscode-checkbox>
                    </div>
                </div>

                <div>
                    <label style="display: block; margin-bottom: 4px; font-size: 12px; font-weight: 500;">Stack Trace Context Input logs:</label>
                    <vscode-text-area id="error-stack-content" rows="6" style="width: 100%;" resize="vertical" placeholder="Logs matching standard engine dumps..."></vscode-text-area>
                </div>

                <div style="display: flex; justify-content: flex-start;">
                    <button id="btn-error-analyze" class="btn-run-custom" style="padding: 6px 16px; font-size: 12px; height: auto;">🔍 Analyze Stack Trace</button>
                </div>

                <div>
                    <label style="display: block; margin-bottom: 4px; font-size: 12px; font-weight: 500;">Identified Target Sources Paths Result Matrix:</label>
                    <div style="display: flex; flex-direction: row; align-items: flex-start; gap: 8px; width: 100%; box-sizing: border-box;">
                        <vscode-text-area id="error-analysis-result" rows="4" style="flex: 1; min-width: 0;" resize="vertical" placeholder="Discovered matching workspace paths files lists..."></vscode-text-area>
                        <div style="flex-shrink: 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 2px;">
                            <vscode-button id="btn-copy-error-result" appearance="icon" class="tooltip-right icon-btn" data-tooltip="Copy result paths to clipboard">
                                <span class="codicon codicon-copy"></span>
                            </vscode-button>
                        </div>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end; border-top: 1px solid var(--vscode-panel-border); padding-top: 10px; margin-top: auto;">
                    <vscode-button id="btn-error-add" appearance="primary">Add Paths</vscode-button>
                    <vscode-button id="btn-error-cancel" appearance="secondary">Cancel</vscode-button>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);

        if (backdrop.firstElementChild) {
            PopupModalUtils.makeResizable(backdrop.firstElementChild);
        }

        this.initListeners(backdrop);
    },

    async initListeners(backdrop) {
        const contentTextArea = document.getElementById('error-stack-content');
        const resultTextArea = document.getElementById('error-analysis-result');
        const stackTypeCombo = document.getElementById('error-stack-type');
        const includeOutCb = document.getElementById('error-include-out-workspace');
        const analyzeBtn = document.getElementById('btn-error-analyze');
        const copyResultBtn = document.getElementById('btn-copy-error-result');
        const addBtn = document.getElementById('btn-error-add');
        const cancelBtn = document.getElementById('btn-error-cancel');

        try {
            const clipboardText = await navigator.clipboard.readText();
            if (clipboardText && contentTextArea) {
                contentTextArea.value = clipboardText;
            }
        } catch (err) {
            console.warn("Clipboard read operations bypassed via layout definitions:", err);
        }

        const closePopup = () => {
            if (backdrop.parentElement) document.body.removeChild(backdrop);
            window.removeEventListener('keydown', handleEsc);
        };

        const handleEsc = (e) => {
            if (e.key === 'Escape') closePopup();
        };

        window.addEventListener('keydown', handleEsc);
        cancelBtn?.addEventListener('click', closePopup);

        analyzeBtn?.addEventListener('click', () => {
            if (analyzeBtn.innerHTML.includes('spin-anim')) return;

            const stackType = stackTypeCombo?.value || 'Java';
            const content = contentTextArea?.value || '';
            const includeOutWorkspace = !!includeOutCb?.checked;
            if (!content.trim()) return;

            analyzeBtn.innerHTML = '<span class="codicon codicon-sync spin-anim"></span> ANALYZING... <span id="btn-kill-analysis" title="Kill active analysis process immediately" style="margin-left: 12px; background: #b71c1c; color: #ffffff; padding: 2px 6px; border-radius: 3px; font-size: 11px; display: inline-flex; align-items: center; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.4); cursor: pointer !important;">🛑 KILL</span>';

            setTimeout(() => {
                document.getElementById('btn-kill-analysis')?.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    bridge.postMessage('killErrorAnalysis');
                });
            }, 20);

            bridge.postMessage('analyzeErrorStack', { stackType, content, includeOutWorkspace });
        });

        copyResultBtn?.addEventListener('click', () => {
            const pathsContent = resultTextArea?.value || '';
            if (pathsContent.trim()) {
                navigator.clipboard.writeText(pathsContent.trim()).then(() => {
                    bridge.postMessage('showNotification', { type: 'info', text: 'Identified paths successfully copied to clipboard.' });
                });
            }
        });

        addBtn?.addEventListener('click', () => {
            const targetPaths = resultTextArea?.value || '';
            const pathListEl = document.getElementById('pathList');
            if (targetPaths.trim() && pathListEl) {
                const existingText = pathListEl.value.trim();
                pathListEl.value = existingText ? `${existingText}\n${targetPaths.trim()}` : targetPaths.trim();
                pathListEl.dispatchEvent(new Event('input', { bubbles: true }));
                pathListEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
            closePopup();
        });

        window.handleErrorAnalysisResponse = (paths) => {
            if (analyzeBtn) {
                analyzeBtn.innerHTML = '🔍 Analyze Stack Trace';
            }
            if (resultTextArea) {
                resultTextArea.value = (paths || []).join('\n');
                resultTextArea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        };
    }
};
EOF

echo "✅ Refactoring complete: Created popup-modal-utils.js and successfully mutualized the resizable window logic across all modal components!"
