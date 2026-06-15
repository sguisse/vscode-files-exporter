import { PricingService } from '../js/services/pricing-service.js';
import { bridge } from '../js/core/vscode.bridge.js';

export class ReportTab {
    constructor() {
        this.myChart = null;
        this.currentData = null;
        this.sortConfig = [
            { column: 'exported', direction: 'desc' },
            { column: 'rejected', direction: 'desc' },
            { column: 'excluded', direction: 'desc' }
        ];
        this.lastClickedRow = null;
    }

        render(data, onFileClick) {
        this.currentData = data;
        try { this.renderTable(data); } catch(e) { console.error(e); }
        try { this.renderChart(data);
        this.renderCostEstimation(data); } catch(e) { console.error(e); }
        try { this.renderPricing(data); } catch(e) { console.error(e); }
        if (data.generated_files && typeof this.renderFiles === 'function') {
            this.renderFiles(data.generated_files, onFileClick);
        }
    }

    sort(event, column) {
        const isShift = event.shiftKey;
        const existingIndex = this.sortConfig.findIndex(s => s.column === column);

        if (!isShift) {
            if (existingIndex !== -1 && this.sortConfig[existingIndex].direction === 'desc') {
                this.sortConfig = [{ column: column, direction: 'asc' }];
            } else {
                this.sortConfig = [{ column: column, direction: 'desc' }];
            }
        } else {
            if (existingIndex !== -1) {
                this.sortConfig[existingIndex].direction = this.sortConfig[existingIndex].direction === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortConfig.push({ column: column, direction: 'desc' });
            }
        }
        this.renderTable(this.currentData);
    }

    handleRowClick(event, row) {
        const tbody = document.getElementById('reportTableBody');
        if (!tbody) return;
        const rows = Array.from(tbody.querySelectorAll('tr'));

        if (event.metaKey || event.ctrlKey) {
            row.classList.toggle('selected-row');
            this.lastClickedRow = row;
        } else if (event.shiftKey && this.lastClickedRow) {
            rows.forEach(r => r.classList.remove('selected-row'));
            const start = rows.indexOf(this.lastClickedRow);
            const end = rows.indexOf(row);
            const [min, max] = [Math.min(start, end), Math.max(start, end)];
            for (let i = min; i <= max; i++) rows[i].classList.add('selected-row');
        } else {
            rows.forEach(r => r.classList.remove('selected-row'));
            row.classList.add('selected-row');
            this.lastClickedRow = row;
        }
    }

    renderTable(data) {
        const reportTableSection = document.getElementById('reportTableSection');
        const reportGraphSection = document.getElementById('reportGraphSection');
        const tbody = document.getElementById('reportTableBody');
        const tfoot = document.getElementById('reportTableFooter');

        if (!data || !data.metrics_per_extension) {
            if (reportTableSection) reportTableSection.style.display = 'none';
            if (reportGraphSection) reportGraphSection.style.display = 'none';
            return;
        }

        if (reportTableSection) reportTableSection.style.display = 'block';
        if (reportGraphSection) reportGraphSection.style.display = 'block';
        if (tbody) tbody.innerHTML = '';

        const headers = {'ext': 'Extension', 'exported': 'Exported', 'rejected': 'Size Rejected', 'excluded': 'Excluded'};
        for (const col in headers) {
            const th = document.getElementById(`th-${col}`);
            if (!th) continue;
            const idx = this.sortConfig.findIndex(s => s.column === col);
            let indicator = '↕';
            if (idx !== -1) {
                const dir = this.sortConfig[idx].direction === 'desc' ? '▼' : '▲';
                indicator = `${dir}${this.sortConfig.length > 1 ? (idx + 1) : ''}`;
            }
            th.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                <span>${headers[col]}</span>
                                <span>${indicator}</span>
                            </div>`;
        }

        const metrics = data.metrics_per_extension;
        const allExts = Object.keys(metrics);

        allExts.sort((a, b) => {
            for (const criteria of this.sortConfig) {
                const mA = metrics[a], mB = metrics[b];
                let cmp = 0;
                if (criteria.column === 'ext') cmp = a.localeCompare(b);
                else if (criteria.column === 'exported') cmp = mA.exported - mB.exported;
                else if (criteria.column === 'rejected') cmp = (mA.size_rejected.count || 0) - (mB.size_rejected.count || 0);
                else if (criteria.column === 'excluded') cmp = (mA.regex_excluded || 0) - (mB.regex_excluded || 0);

                if (cmp !== 0) return criteria.direction === 'asc' ? cmp : -cmp;
            }
            return 0;
        });

        allExts.forEach(ext => {
            const m = metrics[ext];
            const row = document.createElement('tr');
            row.onclick = (e) => this.handleRowClick(e, row);

            const e = m.exported; const r = m.size_rejected.count; const x = m.regex_excluded;
            let rowStyle = "";
            if (x > 0 && e === 0 && r === 0) rowStyle = "color: #f44336; background: rgba(244, 67, 54, 0.1);";
            else if (r > 0 && e === 0 && x === 0) rowStyle = "color: #ffc107; background: rgba(255, 193, 7, 0.1);";
            row.setAttribute('style', rowStyle);

            const rejText = r > 0 ? `${r} (<a href="#" class="rej-size-link tooltip-bottom" data-size="${m.size_rejected.min}" data-tooltip="Click to set Max File to ${m.size_rejected.min}" style="color: inherit; text-decoration: underline;">${m.size_rejected.min}</a> / <a href="#" class="rej-size-link tooltip-bottom" data-size="${m.size_rejected.max}" data-tooltip="Click to set Max File to ${m.size_rejected.max}" style="color: inherit; text-decoration: underline;">${m.size_rejected.max}</a>)` : '-';
            const excText = x > 0 ? x : '-';

            row.innerHTML = `<td style="padding: 1px 5px; border: 1px solid var(--vscode-panel-border); font-size: 12px; font-weight: 500;">
                                <a href="#" class="ext-action-link" data-ext="${ext}" data-tooltip="Simple click add extension to &lt;strong&gt;&amp;quot;Include Exts&amp;quot;&lt;/strong&gt;&lt;br\/&gt; Press Cmd/Ctrl + click add extension to &lt;strong&gt;&amp;quot;Exclude Exts&amp;quot;&lt;/strong&gt;" style="color: var(--vscode-textLink-foreground); text-decoration: underline; cursor: pointer;">${ext === 'no_ext' ? 'No Extension' : ext}</a>
                             </td>
                             <td style="padding: 1px 5px; border: 1px solid var(--vscode-panel-border); font-size: 12px;">${e > 0 ? e : '-'}</td>
                             <td style="padding: 1px 5px; border: 1px solid var(--vscode-panel-border); font-size: 12px; ${r > 0 && !rowStyle ? 'color: #ffc107;' : ''}">${rejText}</td>
                             <td style="padding: 1px 5px; border: 1px solid var(--vscode-panel-border); font-size: 12px; ${x > 0 && !rowStyle ? 'color: #f44336;' : ''}">${excText}</td>`;

            row.querySelector('.ext-action-link')?.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const isExcludeRoute = event.metaKey || event.ctrlKey;
                const targetMode = isExcludeRoute ? 'exc' : 'inc';
                this.evaluateAndAppendExtension(ext, targetMode);
            });

            row.querySelectorAll('.rej-size-link').forEach(link => {
                link.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const sizeStr = link.getAttribute('data-size');
                    let valKb = 0;
                    if (sizeStr.endsWith('MB')) {
                        valKb = parseFloat(sizeStr) * 1024;
                    } else if (sizeStr.endsWith('KB')) {
                        valKb = parseFloat(sizeStr);
                    }
                    const maxFileEl = document.getElementById('maxFile');
                    if (maxFileEl) {
                        const valStr = Math.ceil(valKb).toString();
                        maxFileEl.value = valStr;
                        maxFileEl.dispatchEvent(new Event('input', { bubbles: true }));
                        maxFileEl.dispatchEvent(new Event('change', { bubbles: true }));
                        bridge.postMessage('showNotification', { type: 'info', text: `Max File Size has changed to ${valStr} (KB)` });
                    }
                });
            });

            if (tbody) tbody.appendChild(row);
        });

        const s = data.summary;
        if (tfoot && s) {
            tfoot.innerHTML = `<tr style="background: #f0f0f0; font-weight: bold; color: #333;">
                <td style="padding: 8px; border: 1px solid var(--vscode-panel-border);">Total</td>
                <td style="padding: 8px; border: 1px solid var(--vscode-panel-border);">${s.total_exported || '-'}</td>
                <td style="padding: 8px; border: 1px solid var(--vscode-panel-border); color: #ffc107;">${s.total_size_rejected || '-'}</td>
                <td style="padding: 8px; border: 1px solid var(--vscode-panel-border); color: #f44336;">${s.total_regex_excluded || '-'}</td>
            </tr>`;
        }
    }

    evaluateAndAppendExtension(ext, mode) {
        const targetFieldId = mode === 'inc' ? 'incExts' : 'excExts';
        const targetFieldName = mode === 'inc' ? 'Include Exts' : 'Exclude Exts';
        const targetElement = document.getElementById(targetFieldId);
        if (!targetElement) return;

        const incElement = document.getElementById('incExts');
        const excElement = document.getElementById('excExts');

        const incValue = incElement ? incElement.value : '';
        const excValue = excElement ? excElement.value : '';

        const label = ext === 'no_ext' ? 'no_ext' : ext;
        const generatedPattern = ext === 'no_ext' ? '^[^.]+$' : `.*\\.${ext}$`;

        const checkLabelExists = (fieldContent, searchLabel) => {
            if (!fieldContent) return false;
            const escapedLabel = searchLabel.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(escapedLabel);
            return regex.test(fieldContent);
        };

        const existsInInc = checkLabelExists(incValue, label);
        const existsInExc = checkLabelExists(excValue, label);

        if (existsInInc || existsInExc) {
            const conflictSource = existsInInc ? 'Include Exts' : 'Exclude Exts';
            const backdrop = document.createElement('div');
            backdrop.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.45); z-index: 21000; display: flex; align-items: center; justify-content: center;';

            const warningModal = document.createElement('div');
            warningModal.style.cssText = 'background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground, #cccccc); padding: 16px; border-radius: 4px; border: 1px solid var(--vscode-panel-border); min-width: 340px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-family: var(--vscode-font-family, sans-serif);';

            warningModal.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 8px; font-size: 13px; color: #ffc107;">⚠️ Duplicate Label Warning</div>
                <div style="font-size: 12px; margin-bottom: 16px; line-height: 1.4;">Hey the extension already exists in "<strong>${conflictSource}</strong>" confirm the adding to "<strong>${targetFieldName}</strong>"</div>
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <vscode-button id="btn-warn-add" appearance="primary">Add</vscode-button>
                    <vscode-button id="btn-warn-cancel" appearance="secondary">Cancel</vscode-button>
                </div>
            `;

            backdrop.appendChild(warningModal);
            document.body.appendChild(backdrop);

            const closeWarning = () => document.body.removeChild(backdrop);

            document.getElementById('btn-warn-cancel')?.addEventListener('click', closeWarning);
            document.getElementById('btn-warn-add')?.addEventListener('click', () => {
                closeWarning();
                this.executeAppend(targetElement, generatedPattern);
            });
        } else {
            this.executeAppend(targetElement, generatedPattern);
        }
    }

    executeAppend(element, pattern) {
        const currentVal = element.value.trim();
        if (currentVal === '') {
            element.value = pattern;
        } else {
            element.value = currentVal + '\n' + pattern;
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    renderChart(data) {
        const canvas = document.getElementById('reportChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if (this.myChart) this.myChart.destroy();
        const labels = [], values = [];
        for (const [ext, m] of Object.entries(data.metrics_per_extension)) {
            if (m.exported > 0) {
                labels.push(ext === 'no_ext' ? 'None' : ext);
                values.push(m.exported);
            }
        }
        if (typeof Chart !== 'undefined') {
            this.myChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{ data: values, backgroundColor: ['#00bcd4', '#ffc107', '#f44336', '#4caf50', '#9c27b0'] }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    }

        renderCostEstimation(data) {
        const costSection = document.getElementById('costEstimationSection');
        const costTitle = document.getElementById('costEstimationTitle');
        const thCostTokens = document.getElementById('th-cost-tokens');
        const tbody = document.getElementById('pricingTableBody');
        const header = document.getElementById('costEstimationHeader');



        if (!data || !data.metrics_per_extension) {
            if (costSection) costSection.style.display = 'none';
            return;
        }

        if (costSection) costSection.style.display = 'block';

        const totalTokens = data.estimatedInputTokens || 0;
        const pricingData = PricingService.tokensPriceEstimationByAiModels(totalTokens);

        if (costTitle) {
            costTitle.innerText = `💰 Cost Estimation (${pricingData.estimatedInputTokens.toLocaleString()} tokens)`;
        }

        if (thCostTokens) {
            thCostTokens.innerText = `Cost for ${pricingData.estimatedInputTokens.toLocaleString()} tokens`;
        }

        if (tbody) {
            tbody.innerHTML = '';
            pricingData.llms.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="padding: 6px 8px; border: 1px solid var(--vscode-panel-border); font-size: 12px;">${item.label}</td>
                    <td style="padding: 6px 8px; border: 1px solid var(--vscode-panel-border); font-size: 12px;">${item.model}</td>
                    <td style="padding: 6px 8px; border: 1px solid var(--vscode-panel-border); font-size: 12px; font-weight: bold; color: #4caf50;">$${item.price.toFixed(4)}</td>
                `;
                tbody.appendChild(row);
            });
        }
    }

    clear() {
        const costSection = document.getElementById('costEstimationSection');
        const costContent = document.getElementById('costEstimationContent');
        const costIcon = document.getElementById('costEstimationIcon');

        if (costSection) costSection.style.display = 'none';
        if (costContent) costContent.style.display = 'none';
        if (costIcon) {
            costIcon.classList.remove('codicon-chevron-down');
            costIcon.classList.add('codicon-chevron-right');
        }
        if (this.myChart) this.myChart.destroy();
        const tbody = document.getElementById('reportTableBody');
        const tfoot = document.getElementById('reportTableFooter');
        const reportTableSection = document.getElementById('reportTableSection');
        const reportGraphSection = document.getElementById('reportGraphSection');

        if (tbody) tbody.innerHTML = '';
        if (tfoot) tfoot.innerHTML = '';
        if (reportTableSection) reportTableSection.style.display = 'none';
        if (reportGraphSection) reportGraphSection.style.display = 'none';
    }
}
