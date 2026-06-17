#!/bin/bash

# Modify ui.controller.js to enforce the locked icon, tooltip, and cursor state for the default configuration
node << 'EOF'
const fs = require('fs');
const path = 'src/webview/js/core/ui.controller.js';

if (!fs.existsSync(path)) {
    console.error(`❌ Error: ${path} not found.`);
    process.exit(1);
}

let content = fs.readFileSync(path, 'utf8');

const regex = /syncButtonsState\s*\(\s*val\s*\)\s*\{[\s\S]*?if\s*\(\s*!val\s*\|\|\s*val\s*===\s*'default'\s*\)\s*\{[\s\S]*?\}\s*\},/;

const replacement = `syncButtonsState(val) {
        const btnFreeze = document.getElementById('btn-freeze-history');
        const btnEdit = document.getElementById('btn-edit-history');
        const btnDup = document.getElementById('btn-duplicate-history');

        if (btnDup) btnDup.disabled = false;

        if (!val || val === 'default') {
            if(btnFreeze) {
                btnFreeze.disabled = true;
                btnFreeze.innerHTML = '<span class="codicon codicon-lock" style="cursor: not-allowed;"></span>';
                btnFreeze.setAttribute('data-tooltip', 'Default config can only be modified from settings! You can add default seetings config with "+" or you can adapt the default config and duplicate the modified config with AdHoc icon');
                btnFreeze.style.cursor = 'not-allowed';
            }
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
    },`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(path, content, 'utf8');
} else {
    console.error('❌ Error: Could not locate syncButtonsState function in ui.controller.js.');
    process.exit(1);
}
EOF

# Update the initial HTML state in webview.html to prevent any visual icon flash on load
node << 'EOF'
const fs = require('fs');
const path = 'src/webview/webview.html';

if (!fs.existsSync(path)) process.exit(0);

let content = fs.readFileSync(path, 'utf8');

const searchHtml = `<vscode-button id="btn-freeze-history" appearance="secondary" class="tooltip-right icon-btn" data-tooltip="Freeze or unfreeze profile. Unfreezing allows overwriting and re-naming configurations" disabled><span class="codicon codicon-unlock"></span></vscode-button>`;
const replaceHtml = `<vscode-button id="btn-freeze-history" appearance="secondary" class="tooltip-right icon-btn" data-tooltip="Default config can only be modified from settings! You can add default seetings config with &quot;+&quot; or you can adapt the default config and duplicate the modified config with AdHoc icon" style="cursor: not-allowed;" disabled><span class="codicon codicon-lock" style="cursor: not-allowed;"></span></vscode-button>`;

if (content.includes(searchHtml)) {
    content = content.replace(searchHtml, replaceHtml);
    fs.writeFileSync(path, content, 'utf8');
}
EOF

echo "✅ Script modified. The freeze icon now natively locks, disables, and correctly warns the user via an explicit tooltip when selecting the default configuration!"
