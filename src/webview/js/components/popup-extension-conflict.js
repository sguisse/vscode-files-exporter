export const PopupExtensionConflict = {
    show(extensions, conflictSource, targetFieldName, onMove, onAdd, onCancel) {
        const backdrop = document.createElement('div');
        backdrop.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.45); z-index: 21000; display: flex; align-items: center; justify-content: center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground, #cccccc); padding: 16px; border-radius: 4px; border: 1px solid var(--vscode-panel-border); min-width: 400px; max-width: 500px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-family: var(--vscode-font-family, sans-serif);';

        const extList = extensions.map(e => `<code>${e === 'no_ext' ? 'No Extension' : '.' + e}</code>`).join(', ');

        modal.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px; font-size: 13px; color: #ffc107;">⚠️ Extension List Conflict</div>
            <div style="font-size: 12px; margin-bottom: 16px; line-height: 1.5;">
                The extension(s) ${extList} already exist in "<strong>${conflictSource}</strong>".<br/><br/>
                Do you want to <strong>Move</strong> them to "<strong>${targetFieldName}</strong>", <strong>Add</strong> them to both lists, or <strong>Cancel</strong>?
            </div>
            <div style="display: flex; gap: 8px; justify-content: flex-end;">
                <vscode-button id="btn-conflict-move" appearance="primary">Move</vscode-button>
                <vscode-button id="btn-conflict-add" appearance="secondary">Add Anyway</vscode-button>
                <vscode-button id="btn-conflict-cancel" appearance="secondary">Cancel</vscode-button>
            </div>
        `;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        const closeModal = () => document.body.removeChild(backdrop);

        document.getElementById('btn-conflict-move')?.addEventListener('click', () => { closeModal(); onMove(); });
        document.getElementById('btn-conflict-add')?.addEventListener('click', () => { closeModal(); onAdd(); });
        document.getElementById('btn-conflict-cancel')?.addEventListener('click', () => { closeModal(); if(onCancel) onCancel(); });
    }
};
