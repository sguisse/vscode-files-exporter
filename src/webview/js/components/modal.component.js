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
        backdrop.innerHTML = `<div style="padding: 20px; border-radius: 6px; border: 1px solid var(--vscode-panel-border); min-width: 450px;">
            <div style="font-weight:600; color:#ffc107; margin-bottom:12px;">⚠️ Performance & Scope Warning</div>
            <div style="margin-bottom:20px; font-size:12px;">Crawling risk detected. Proceed?</div>
            <div style="display:flex; gap:10px; justify-content:flex-end;">
                <vscode-button id="btn-guardrail-proceed" appearance="primary">Proceed Anyway</vscode-button>
                <vscode-button id="btn-guardrail-cancel" appearance="secondary">Cancel Run</vscode-button>
            </div>
        </div>`;
        document.body.appendChild(backdrop);
        document.getElementById('btn-guardrail-cancel')?.addEventListener('click', () => { document.body.removeChild(backdrop); onCancel(); });
        document.getElementById('btn-guardrail-proceed')?.addEventListener('click', () => { document.body.removeChild(backdrop); onSuccess(); });
    },
    triggerValidationErrorModal(errorText) {
        const backdrop = document.createElement('div');
        backdrop.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 999999; display: flex; align-items: center; justify-content: center;';
        backdrop.innerHTML = `<div style="padding: 20px; border-radius: 6px; border: 1px solid var(--vscode-panel-border); min-width: 400px;">
            <div style="font-weight:600; color:#f44336; margin-bottom:12px;">🛑 Validation Failure</div>
            <div style="margin-bottom:20px; font-size:12px;">${errorText}</div>
            <div style="display:flex; justify-content:flex-end;"><vscode-button id="btn-validation-error-close" appearance="primary">Close</vscode-button></div>
        </div>`;
        document.body.appendChild(backdrop);
        document.getElementById('btn-validation-error-close')?.addEventListener('click', () => document.body.removeChild(backdrop));
    }
};
