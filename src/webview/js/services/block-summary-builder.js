export const BlockSummaryBuilder = {
    computeBlockSummary(blockId) {
        const truncate = (str, len = 24) => {
            if (!str) return '';
            return str.length > len ? str.substring(0, len) + '...' : str;
        };

        const collectAndFormatValues = (elementsMap) => {
            const pieces = [];
            Object.keys(elementsMap).forEach(key => {
                const rawVal = elementsMap[key];
                if (rawVal !== undefined && rawVal !== null && rawVal !== '' && rawVal !== false) {
                    let displayString = typeof rawVal === 'boolean' ? key : `${key}: ${truncate(String(rawVal))}`;
                    pieces.push({ text: displayString, length: displayString.length });
                }
            });
            // Tri par longueur croissante (Shorter first)
            pieces.sort((a, b) => a.length - b.length);
            return pieces.map(p => p.text).join(' | ');
        };

        switch (blockId) {
            case 'block-history': {
                const combo = document.getElementById('historyCombo');
                const activeProfile = combo ? combo.value : 'default';
                return collectAndFormatValues({ Profile: activeProfile === 'default' ? 'Default Config' : activeProfile });
            }
            case 'block-sourcepaths': {
                const paths = (document.getElementById('pathList')?.value || '').split('\n').map(p => p.trim()).filter(p => p);
                if (paths.length === 0) return 'No paths defined';
                return collectAndFormatValues({ Count: `${paths.length} target(s)`, First: paths[0].split('/').pop() || paths[0] });
            }
            case 'block-filters': {
                const maxF = document.getElementById('maxFile')?.value || '';
                const incP = document.getElementById('incPaths')?.value || '';
                const excP = document.getElementById('excPaths')?.value || '';
                return collectAndFormatValues({ [`Max ${maxF}KB`]: true, Inc: incP.split('\n')[0], Exc: excP.split('\n')[0] });
            }
            case 'block-destination': {
                return collectAndFormatValues({ Target: document.getElementById('destDir')?.value || 'Not configured' });
            }
            case 'block-options': {
                return collectAndFormatValues({
                    Format: (document.getElementById('format')?.value || 'yaml').toUpperCase(),
                    Split: document.getElementById('splitChunkByFileExtension')?.checked,
                    Tree: document.getElementById('generateTreeView')?.checked
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
                if (rows.length === 0) return 'Empty Report';
                const summaryExts = {};
                rows.slice(0, 3).forEach(r => {
                    const cells = r.querySelectorAll('td');
                    if (cells.length >= 2) summaryExts[cells[0].innerText] = cells[1].innerText;
                });
                return collectAndFormatValues(summaryExts);
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
            case 'section-tree-explorer': {
                const nodes = Array.from(document.querySelectorAll('#view-tree-content div')).length;
                return collectAndFormatValues({ TreeElements: `${nodes} elements` });
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
