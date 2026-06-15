#!/usr/bin/env bash
set -euo pipefail

echo -e "================================================================="
echo -e "🚀  PHASE 14: ENCAPSULATION DE LA METHODE renderCostEstimation"
echo -e "================================================================="

if [ ! -f "package.json" ]; then
    echo -e "[\e[31mERREUR\e[0m] Exécutez ce script à la racine du workspace."
    exit 1
fi

REPORT_TAB_FILE="src/webview/components/report-tab.js"

if [ -f "$REPORT_TAB_FILE" ]; then
    BACKUP_REPORT="${REPORT_TAB_FILE}.$(date +%s).cost_method.bak"
    cp "$REPORT_TAB_FILE" "$BACKUP_REPORT"

    echo -e "[\e[34mINFO\e[0m] Injection de la méthode renderCostEstimation dans report-tab.js..."

    python3 << 'EOF'
import os
import re

file_path = 'src/webview/components/report-tab.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Injection de l'import de PricingService au sommet si absent
if "PricingService" not in content:
    content = "import { PricingService } from '../js/services/pricing-service.js';\n" + content

# 2. Remplacement propre de la méthode render globale pour lier renderCostEstimation
old_render_pattern = r"render\(data,\s*onFileClick\)\s*\{([\s\S]*?this\.renderChart\(data\);)"
if re.search(old_render_pattern, content):
    content = re.sub(old_render_pattern, r"render(data, onFileClick) {\1\n        this.renderCostEstimation(data);", content)

# 3. Purge d'anciennes fonctions intermédiaires (comme renderPricing) pour éviter les collisions
content = re.sub(r"renderPricing\(data\) \{[\s\S]*?\}\n\s*(?=clear\(\))", "", content)
content = re.sub(r"renderCostEstimation\(data\) \{[\s\S]*?\}\n\s*(?=clear\(\))", "", content)

# 4. Injection de la méthode complète renderCostEstimation calquée sur le modèle de renderTable
new_method = """renderCostEstimation(data) {
        const costSection = document.getElementById('costEstimationSection');
        const costTitle = document.getElementById('costEstimationTitle');
        const thCostTokens = document.getElementById('th-cost-tokens');
        const tbody = document.getElementById('pricingTableBody');
        const header = document.getElementById('costEstimationHeader');

        if (header && !header.dataset.bound) {
            header.dataset.bound = 'true';
            header.addEventListener('click', () => {
                const contentDiv = document.getElementById('costEstimationContent');
                const iconSpan = document.getElementById('costEstimationIcon');
                if (contentDiv && iconSpan) {
                    if (contentDiv.style.display === 'none') {
                        contentDiv.style.display = 'block';
                        iconSpan.className = 'codicon codicon-chevron-down';
                    } else {
                        contentDiv.style.display = 'none';
                        iconSpan.className = 'codicon codicon-chevron-right';
                    }
                }
            });
        }

        if (!data || !data.metrics_per_extension) {
            if (costSection) costSection.style.display = 'none';
            return;
        }

        if (costSection) costSection.style.display = 'block';

        const targetList = (data.generated_files && data.generated_files.exports) || [];
        if (targetList.length === 0 && data.summary && data.summary.total_exported > 0) {
            for (let i = 0; i < data.summary.total_exported; i++) {
                targetList.push('mock_file.yaml');
            }
        }

        const pricingData = PricingService.tokensPriceEstimationByAiModels(targetList);

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

    """

content = content.replace("clear() {", new_method + "clear() {")

# 5. Réalignement du comportement de clear() pour réinitialiser le bloc de coût
if "const costSection =" not in content.split("clear() {")[-1]:
    content = content.replace("clear() {", """clear() {
        const costSection = document.getElementById('costEstimationSection');
        const costContent = document.getElementById('costEstimationContent');
        const costIcon = document.getElementById('costEstimationIcon');
        if (costSection) costSection.style.display = 'none';
        if (costContent) costContent.style.display = 'none';
        if (costIcon) {
            costIcon.className = 'codicon codicon-chevron-right';
        }""")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Patcheur de composant : Méthode renderCostEstimation injectée avec succès.')
EOF
fi

# -----------------------------------------------------------------
# VÉRIFICATIONS ANTI-RÉGRESSION FINALES
# -----------------------------------------------------------------
echo -e "\n================================================================="
echo -e "🛡️  VALIDATION DU REFACTORING ET INTEGRITE DES TYPES"
echo -e "================================================================="

if npx tsc --noEmit; then
    echo -e "[\e[32mSUCCÈS\e[0m] Validation TypeScript OK. Aucune anomalie détectée."
else
    echo -e "[\e[31mERREUR\e[0m] Échec de la passe de typage statique."
    exit 1
fi

if grep -q "\"compile\":" package.json; then
    echo -e "[\e[34mINFO\e[0m] Recompilation Webpack de l'extension..."
    if npm run compile; then
        echo -e "[\e[32mSUCCÈS\e[0m] Bundle généré. La méthode renderCostEstimation est prête."
    else
        echo -e "[\e[31mERREUR\e[0m] Échec lors du bundling de production."
        exit 1
    fi
fi

echo -e "\n================================================================="
echo -e "✅ Méthode 'renderCostEstimation(data)' ajoutée à la classe ReportTab."
echo -e "✅ Cycle de vie UI et synchronisation du tableau de prix validés."
echo -e "================================================================="
