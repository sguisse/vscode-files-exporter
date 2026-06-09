export class FilesTab {
    render(files, destDir, onFileClick, onFinderClick, isSplitActive) {
        const lists = {
            'exports': document.getElementById('exportedFilesList'),
            'logs': document.getElementById('logsList'),
            'reports': document.getElementById('reportsList')
        };

        const cleanDestDir = (destDir || '').replace(/[\\/]$/, '');
        const sep = cleanDestDir.includes('\\') ? '\\' : '/';

        // Stable thematic VS Code color palette
        const colorPalette = [
            'var(--vscode-textLink-foreground)',       // Blue
            'var(--vscode-charts-orange)',             // Orange
            'var(--vscode-charts-purple)',             // Purple
            'var(--vscode-charts-green)',              // Green
            'var(--vscode-charts-blue)'                // Light Blue
        ];

        for (const key in lists) {
            const listEl = lists[key];
            if (!listEl) continue;

            let fileItems = files[key] || [];

            if (fileItems.length === 0) {
                listEl.innerHTML = '<div style="padding: 6px; color: var(--vscode-descriptionForeground); font-style: italic; font-size: 11px;">No files generated</div>';
                continue;
            }

            // Alphabetical sorting by filename
            fileItems.sort((a, b) => {
                const nameA = a.split(/[\\/]/).pop() || '';
                const nameB = b.split(/[\\/]/).pop() || '';
                return nameA.localeCompare(nameB);
            });

            let currentPaletteIndex = 0;
            let lastSemanticType = '';

            listEl.innerHTML = fileItems.map(item => {
                const fileName = item.split(/[\\/]/).pop() || '';
                const fullPath = `${cleanDestDir}${sep}${fileName}`;
                const escapedPath = fullPath.replace(/\\/g, '\\\\');

                //─── ANCHOR REGEX QA: Extraction of the nested semantic type before the chunk number ───
                //Match everything between the timestamp and the '_number.extension' block
                const match = fileName.match(/export-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_(.+)_\d+\.\w+$/);
                const currentSemanticType = match ? match[1] : 'unknown';

                // Color alternation only if the semantic extension changes
                if (isSplitActive && key === 'exports') {
                    if (lastSemanticType !== '' && currentSemanticType !== lastSemanticType) {
                        currentPaletteIndex = (currentPaletteIndex + 1) % colorPalette.length;
                    }
                    lastSemanticType = currentSemanticType;
                }

                const displayTextColor = (isSplitActive && key === 'exports')
                    ? colorPalette[currentPaletteIndex]
                    : 'var(--vscode-textLink-foreground)';

                return `
                    <div style="padding: 2px 6px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--vscode-panel-border);" class="file-item-row">
                        <div style="cursor: pointer; display: flex; align-items: center; gap: 6px; flex-grow: 1; padding: 4px 0;"
                             class="file-link-item"
                             data-path="${escapedPath}"
                             title="${fullPath}">
                            📄 <span style="color: ${displayTextColor}; font-size: 12px; font-family: var(--vscode-editor-font-family); font-weight: 500;">${fileName}</span>
                        </div>
                        <vscode-button appearance="icon" class="btn-reveal-finder tooltip-right" data-path="${escapedPath}" data-tooltip="Reveal this file in OS Explorer" style="height: 22px; width: 22px; flex-shrink: 0;">📂</vscode-button>
                    </div>
                `;
            }).join('');

            // Event re-wiring
            listEl.querySelectorAll('.file-link-item').forEach(item => {
                item.addEventListener('click', () => {
                    const pathToOpen = item.getAttribute('data-path');
                    if (pathToOpen) onFileClick(pathToOpen);
                });
                const span = item.querySelector('span');
                item.addEventListener('mouseenter', () => { if(span) span.style.textDecoration = 'underline'; });
                item.addEventListener('mouseleave', () => { if(span) span.style.textDecoration = 'none'; });
            });

            listEl.querySelectorAll('.btn-reveal-finder').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const pathToReveal = btn.getAttribute('data-path');
                    if (pathToReveal) onFinderClick(pathToReveal);
                });
            });
        }
    }

    clear() {
        ['exportedFilesList', 'logsList', 'reportsList'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
    }
}
