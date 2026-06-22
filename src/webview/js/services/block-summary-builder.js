export const BlockSummaryBuilder = {
    computeBlockSummary(blockId) {
        const truncate = (str, len = 200) => {
            if (!str) return '';
            return str.length > len ? str.substring(0, len) + '...' : str;
        };

        const collectAndFormatValues = (elementsMap) => {
            const pieces = [];
            Object.keys(elementsMap).forEach(key => {
                const rawVal = elementsMap[key];
                let displayString = `${key}: ${truncate(String(rawVal))}`;
                pieces.push({ text: displayString, length: displayString.length });
            });
            // Sort by increasing length (Shorter first)
            pieces.sort((a, b) => a.length - b.length);

            // Reorder to put elements in the exact order specified
            const orderedKeys = ['Max', 'Inc', 'Exc', 'Format', 'Chunk', 'Split', 'Copy2Clip', 'Tree'];
            const orderedPieces = [];
            const remainingPieces = [];

            pieces.forEach(piece => {
                const splitPieceText = piece.text.split(':');
                const key = splitPieceText[0].trim();
                let value = '';
                for (let i = 1; i < splitPieceText.length; i++) {
                    value = value + ":" + splitPieceText[i];
                }
                piece.text = "<strong>" + key + ": </strong>" + value;

                if (orderedKeys.includes(key)) {
                    orderedPieces.push({ key, piece });
                } else {
                    remainingPieces.push(piece);
                }
            });

            // Sort ordered pieces by their position in the orderedKeys array
            orderedPieces.sort((a, b) => orderedKeys.indexOf(a.key) - orderedKeys.indexOf(b.key));

            // Combine ordered pieces with remaining pieces
            const finalPieces = orderedPieces.map(item => item.piece).concat(remainingPieces);

            return finalPieces.map(p => p.text).join('&nbsp;&nbsp;&nbsp;');
        };

        switch (blockId) {
            case 'block-history': {
                const historyCombo = document.getElementById('historyCombo');

                if (!historyCombo) return;

                // Retrieves the textual label of the selected <vscode-option> tag
                let displayValue = '';
                if (historyCombo.options && historyCombo.options.length > 0) {
                    // Get the selected option directly
                    const selectedOption = historyCombo.options[historyCombo.selectedIndex];
                    if (selectedOption) {
                        displayValue = selectedOption.textContent.trim();
                    }
                }

                return collectAndFormatValues({ Profile: displayValue });
            }
            case 'block-sourcepaths': {
                const paths = (document.getElementById('pathList')?.value || '').split('\n').map(p => p.trim()).filter(p => p);
                if (paths.length === 0) return 'No paths defined';
                const lastParts = paths.map(path => path.split('/').pop().split('\\').pop());
                return collectAndFormatValues({
                    Count: `${paths.length} target(s)`,
                    Paths: lastParts.map(part => `/${part}`).join(', ')
                });
            }
            case 'block-filters': {
                const maxF = document.getElementById('maxFile')?.value || '';
                const incP = document.getElementById('incPaths')?.value || '';
                const excP = document.getElementById('excPaths')?.value || '';
                return collectAndFormatValues({
                    Max: `${maxF}KB`,
                    Inc: incP.split('\n').join(', '),
                    Exc: excP.split('\n').join(', ')
                });
            }
            case 'block-destination': {
                return collectAndFormatValues({ Folder: document.getElementById('destDir')?.value || 'Not configured' });
            }
            case 'block-options': {
                const chunk = document.getElementById('maxChunk')?.value || null;

                return collectAndFormatValues({
                    Format: (document.getElementById('format')?.value || 'yaml').toUpperCase(),
                    Chunk: chunk ? `${chunk}KB` : 'Not configured',
                    Split: document.getElementById('splitChunkByFileExtension')?.checked,
                    Copy2Clip: document.getElementById('copyGeneratedFilesToClipboard')?.checked,
                    Tree: document.getElementById('generateTreeView')?.checked,
                    Logs: document.getElementById('generateLogConsole')?.checked,
                    LogsFile: document.getElementById('generateLogFile')?.checked,
                });
            }
            case 'costEstimationSection': {
                const rows = Array.from(document.querySelectorAll('#pricingTableBody tr'));
                if (rows.length === 0) return 'No metrics';
                const metrics = {};
                rows.forEach(r => {
                    const cells = r.querySelectorAll('td');
                    if (cells.length >= 3) {
                        metrics[cells[1].innerText] = cells[2].innerText;
                    }
                });
                return collectAndFormatValues(metrics);
            }
                        case 'reportTableSection': {
                const rows = Array.from(document.querySelectorAll('#reportTableBody tr'));
                let treeStr = '';
                const nodes = Array.from(document.querySelectorAll('#view-tree-content .tree-item, #view-tree-content .tree-folder')).length;
                if (nodes > 0) treeStr = ` | Tree: ${nodes} elements`;
                if (rows.length === 0) return 'Empty Report' + treeStr;
                const summaryExts = {};
                rows.slice(0, 3).forEach(r => {
                    const cells = r.querySelectorAll('td');
                    if (cells.length >= 2) summaryExts[cells[0].innerText] = cells[1].innerText;
                });
                return collectAndFormatValues(summaryExts) + treeStr;
            }
            case 'reportGraphSection':
                return 'Pie-chart active';
            case 'section-exported-files': {
                const links = Array.from(document.querySelectorAll('#exportedFilesList a, #exportedFilesList div'));
                return collectAndFormatValues({ Chunks: `${links.length} files` });
            }
            case 'section-logs-block': {
                const lines = Array.from(document.querySelectorAll('#logsList div')).length;
                return collectAndFormatValues({ Files: `${lines} items` });
            }
            case 'section-reports-block': {
                const rCount = Array.from(document.querySelectorAll('#reportsList div')).length;
                return collectAndFormatValues({ Reports: `${rCount} items` });
            }
            
            case 'section-terminal-cmd': {
                const len = (document.getElementById('terminal-cmd')?.value || '').length;
                return collectAndFormatValues({ CmdSize: `${len} chars` });
            }
            case 'section-terminal-logs': {
                const lines = (document.getElementById('terminal')?.innerText || '').split('\n').filter(l => l.trim()).length;
                return collectAndFormatValues({ Lines: `${lines} log rows` });
            }
            default:
                return '';
        }
    }
};
