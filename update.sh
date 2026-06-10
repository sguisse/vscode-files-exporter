#!/bin/bash

# Create necessary directories
mkdir -p src/webview/components

# Create the Pricing Tab component
cat << 'EOF' > src/webview/components/pricing-tab.js
export class PricingTab {
    constructor() {
        this.containerId = 'view-pricing';
        this.data = [
            { model: 'GPT-4o', tokens: 1250000, color: '#10a37f' },
            { model: 'Claude 3.5 Sonnet', tokens: 850000, color: '#d97757' },
            { model: 'Llama 3 70B', tokens: 420000, color: '#0668E1' },
            { model: 'Mistral Large', tokens: 200000, color: '#ff7000' }
        ];
        this.currentMode = 'table';
        this.initDOM();
    }

    initDOM() {
        setTimeout(() => {
            let tabContainer = document.querySelector('.tabs') || document.querySelector('.tab-buttons') || document.body;
            let tabBtn = document.querySelector(`[data-target="${this.containerId}"]`);

            if (!tabBtn) {
                tabBtn = document.createElement('div');
                tabBtn.className = 'tab-button';
                tabBtn.setAttribute('data-target', this.containerId);
                tabBtn.innerHTML = 'Pricing';

                tabBtn.addEventListener('click', () => {
                    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                    tabBtn.classList.add('active');
                    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
                    const target = document.getElementById(this.containerId);
                    if(target) target.style.display = 'block';
                });

                tabContainer.appendChild(tabBtn);
            }

            let container = document.getElementById(this.containerId);
            if (!container) {
                container = document.createElement('div');
                container.id = this.containerId;
                container.className = 'tab-content';
                container.style.display = 'none';
                document.body.appendChild(container);
            }

            this.renderContent();
        }, 100);
    }

    render() {
        this.renderContent();
    }

    renderContent() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        let content = `
            <div style="padding: 20px; color: var(--vscode-foreground); font-family: var(--vscode-font-family);">
                <h2 style="margin-top:0;">AI Tokens Consumption</h2>
                <div style="margin-bottom: 20px; display: flex; gap: 10px;">
                    <button id="btn-mode-table" style="cursor:pointer; padding:8px 12px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px;">Table View</button>
                    <button id="btn-mode-camenbert" style="cursor:pointer; padding:8px 12px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px;">Camenbert</button>
                    <button id="btn-mode-histobar" style="cursor:pointer; padding:8px 12px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px;">Histobar</button>
                </div>
                <div id="pricing-content-area" style="min-height: 350px; background: var(--vscode-editor-background); padding: 20px; border: 1px solid var(--vscode-panel-border); border-radius: 6px;"></div>
            </div>
        `;
        container.innerHTML = content;

        document.getElementById('btn-mode-table').addEventListener('click', () => this.setMode('table'));
        document.getElementById('btn-mode-camenbert').addEventListener('click', () => this.setMode('camenbert'));
        document.getElementById('btn-mode-histobar').addEventListener('click', () => this.setMode('histobar'));

        this.updateView();
    }

    setMode(mode) {
        this.currentMode = mode;
        this.updateView();
    }

    updateView() {
        const area = document.getElementById('pricing-content-area');
        if (!area) return;

        if (this.currentMode === 'table') {
            let tableHtml = `
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--vscode-panel-border);">
                            <th style="padding: 10px;">AI Model</th>
                            <th style="padding: 10px;">Tokens Consumed</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            this.data.forEach(item => {
                tableHtml += `
                    <tr style="border-bottom: 1px solid var(--vscode-panel-border);">
                        <td style="padding: 10px; color: ${item.color}; font-weight: bold;">${item.model}</td>
                        <td style="padding: 10px;">${item.tokens.toLocaleString()}</td>
                    </tr>
                `;
            });
            tableHtml += `</tbody></table>`;
            area.innerHTML = tableHtml;

        } else if (this.currentMode === 'camenbert') {
            const total = this.data.reduce((sum, item) => sum + item.tokens, 0);
            let gradientString = [];
            let currentAngle = 0;
            this.data.forEach(item => {
                const angle = (item.tokens / total) * 360;
                gradientString.push(`${item.color} ${currentAngle}deg ${currentAngle + angle}deg`);
                currentAngle += angle;
            });

            let legendHtml = this.data.map(item => `
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                    <div style="width: 18px; height: 18px; background: ${item.color}; margin-right: 10px; border-radius: 4px;"></div>
                    <span style="font-size: 14px;">${item.model} <strong>(${item.tokens.toLocaleString()})</strong></span>
                </div>
            `).join('');

            area.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 60px; height: 100%; margin-top: 20px;">
                    <div style="width: 250px; height: 250px; border-radius: 50%; background: conic-gradient(${gradientString.join(', ')}); box-shadow: 0 4px 10px rgba(0,0,0,0.3);"></div>
                    <div>${legendHtml}</div>
                </div>
            `;

        } else if (this.currentMode === 'histobar') {
            const maxTokens = Math.max(...this.data.map(i => i.tokens));
            let barsHtml = this.data.map(item => {
                const heightPercent = (item.tokens / maxTokens) * 100;
                return `
                    <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
                        <div style="width: 100%; height: 250px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 10px;">
                            <div style="width: 50%; background: ${item.color}; height: ${heightPercent}%; border-radius: 6px 6px 0 0; transition: height 0.4s ease-out; box-shadow: inset 0 0 10px rgba(0,0,0,0.1);"></div>
                        </div>
                        <span style="font-weight: bold; font-size: 13px; text-align: center;">${item.model}</span>
                        <span style="font-size: 12px; opacity: 0.8; margin-top: 5px;">${item.tokens.toLocaleString()}</span>
                    </div>
                `;
            }).join('');

            area.innerHTML = `
                <div style="display: flex; width: 100%; max-width: 600px; height: 300px; justify-content: space-around; align-items: flex-end; margin: 0 auto;">
                    ${barsHtml}
                </div>
            `;
        }
    }
}
EOF

# Update main entry point to register PricingTab natively
cat << 'EOF' > src/webview/main.js
import { bridge } from './js/core/vscode.bridge.js';
import { state } from './js/core/state.manager.js';
import { ValidatorService } from './js/services/validator.service.js';
import { UIController } from './js/core/ui.controller.js';
import { ReportTab } from './components/report-tab.js';
import { FilesTab } from './components/files-tab.js';
import { TreeViewTab } from './components/tree-view-tab.js';
import { TerminalTab } from './components/terminal-tab.js';
import { HelpTab } from './components/help-tab.js';
import { PricingTab } from './components/pricing-tab.js';

const reportTab = new ReportTab();
const filesTab = new FilesTab();
const treeViewTab = new TreeViewTab();
const terminalTab = new TerminalTab();
const helpTab = new HelpTab();
const pricingTab = new PricingTab();

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

const init = () => {
    UIController.injectShadowDomStyles();
    UIController.initCursorTooltipTracker();
    pricingTab.render();
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
};

const applyHistorySelection = (val) => {
    reportTab.clear();
    filesTab.clear();
    treeViewTab.clear();
    terminalTab.clear();
    const targetConfig = val === 'default' ? state.defaultSettings : state.historyList.find(h => h.id === val)?.config;
    applyFormFields(targetConfig);
    setTimeout(() => ValidatorService.executeFieldValidation('pathList'), 10);
};

const applyFormFields = (cfg) => {
    if (!cfg) return;
    state.selectedPaths = cfg.src ? cfg.src.split(/[\n,;]/).map(p => p.trim()).filter(p => p) : [];
    const pathListEl = document.getElementById('pathList');
    if(pathListEl) pathListEl.value = state.selectedPaths.join('\n');
    bridge.postMessage('syncPaths', { paths: state.selectedPaths });
};

const updateHistoryCombo = (selectedId) => {
    const combo = document.getElementById('historyCombo');
    if (!combo) return;
    combo.innerHTML = '';
    const defOpt = document.createElement('vscode-option');
    defOpt.value = 'default';
    defOpt.textContent = '< Default Configuration >';
    if (selectedId === 'default' || !selectedId) defOpt.selected = true;
    combo.appendChild(defOpt);
    state.historyList.forEach(item => {
        const opt = document.createElement('vscode-option');
        opt.value = item.id;
        opt.textContent = item.display;
        if (item.id === selectedId) opt.selected = true;
        combo.appendChild(opt);
    });
    setTimeout(() => {
        combo.value = selectedId || 'default';
        UIController.syncButtonsState(selectedId || 'default');
    }, 0);
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
            const pList = document.getElementById('pathList');
            if(pList) pList.value = state.selectedPaths.join('\n');
            UIController.checkSyncStatus();
            ValidatorService.executeFieldValidation('pathList');
            break;
        case 'initSettings':
            state.defaultSettings = message.defaultSettings || {};
            if (message.tooltipDelay !== undefined) state.tooltipDelayValue = message.tooltipDelay;
            state.isInitializing = true;
            state.historyList = message.history || [];
            state.currentSelectedId = message.selectedId || 'default';
            updateHistoryCombo(state.currentSelectedId);
            applyFormFields(message.currentSettings);
            if (message.paths && message.paths.length > 0) {
                state.selectedPaths = message.paths;
                const pListInit = document.getElementById('pathList');
                if(pListInit) pListInit.value = state.selectedPaths.join('\n');
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
            break;
        case 'terminalLog':
            terminalTab.append(message.text);
            if (message.text.includes('Export complete!') || message.text.includes('Export aborted') || message.text.includes('ERROR:')) {
                resetRunButton();
            }
            break;
        case 'updateCommand':
            if(terminalTab.updateCommand) terminalTab.updateCommand(message.text);
            break;
        case 'updateExportReport':
            resetRunButton();
            try {
                if(reportTab.render) reportTab.render(message.data);
            } catch (e) {}
            try {
                if (message.data) {
                    state.lastReportPayload = message.data;
                    if (message.data.generated_files) {
                        state.lastGeneratedFilesPayload = JSON.parse(JSON.stringify(message.data.generated_files));
                        const destDirEl = document.getElementById('destDir');
                        const splitChunkEl = document.getElementById('splitChunkByFileExtension');
                        if(filesTab.render && destDirEl && splitChunkEl) {
                            filesTab.render(state.lastGeneratedFilesPayload, destDirEl.value, (p) => bridge.postMessage('openFile',{path:p}), (p) => bridge.postMessage('openFinder',{path:p}), splitChunkEl.checked);
                        }
                    }
                    if(treeViewTab.render) treeViewTab.render(message.data, (p) => bridge.postMessage('openFile',{path:p}), (p) => bridge.postMessage('openFinder',{path:p}));
                }
            } catch (e) {}
            break;
        case 'filteredFilesResult':
            try {
                const payload = { ...state.lastGeneratedFilesPayload, exports: message.files };
                const destDirEl = document.getElementById('destDir');
                const splitChunkEl = document.getElementById('splitChunkByFileExtension');
                if(filesTab.render && destDirEl && splitChunkEl) {
                    filesTab.render(payload, destDirEl.value, (p) => bridge.postMessage('openFile',{path:p}), (p) => bridge.postMessage('openFinder',{path:p}), splitChunkEl.checked);
                }
            } catch (e) {}
            break;
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
EOF

echo "Modifications applied successfully. Pricing tab logic instantiated."
