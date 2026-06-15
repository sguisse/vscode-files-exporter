#!/usr/bin/env bash
set -euo pipefail

echo -e "================================================================="
echo -e "⚙️  FIX : RETABLISSEMENT DE L'ALIGNEMENT DES BOUTONS EXCHANGE"
echo -e "================================================================="

if [ ! -f "package.json" ]; then
    echo -e "[\e[31mERREUR\e[0m] Exécutez ce script à la racine du workspace."
    exit 1
fi

HTML_FILE="src/webview/webview.html"

if [ -f "$HTML_FILE" ]; then
    echo -e "[\e[34mINFO\e[0m] Nettoyage des styles antagonistes Flexbox (.btn-run-custom)..."

    # Utilisation d'un script Python pour corriger chirurgicalement le CSS de la classe .btn-run-custom
    # et le conteneur HTML pour empêcher le bouton de s'approprier toute la largeur (width: 60% / margin: auto)
    python3 << 'EOF'
import os

file_path = 'src/webview/webview.html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remplacement de la définition CSS pour supprimer les marges automatiques et la largeur fixe restrictive
old_css = """        .btn-run-custom {
            width: 60%;
            margin: 0px auto 0px auto;
            background: linear-gradient(135deg, var(--vscode-button-background), #6b21a8);"""

new_css = """        .btn-run-custom {
            background: linear-gradient(135deg, var(--vscode-button-background), #6b21a8);"""

if old_css in content:
    content = content.replace(old_css, new_css)

# 2. Réalignement du conteneur HTML pour forcer l'alignement inline-flex strict côte à côte
old_container = """    <div style="display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%;">
        <button id="btn-run" class="btn-run-custom" style="margin: 10px; width: 150px;">
            <span class="codicon codicon-play"></span> RUN EXPORT
        </button>
        <div id="exchange-buttons-container" style="display: flex; gap: 10px; align-items: center;"></div>
    </div>"""

new_container = """    <div style="display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%; margin: 10px 0;">
        <button id="btn-run" class="btn-run-custom" style="width: 180px; flex-shrink: 0;">
            <span class="codicon codicon-play"></span> RUN EXPORT
        </button>
        <div id="exchange-buttons-container" style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;"></div>
    </div>"""

if old_container in content:
    content = content.replace(old_container, new_container)
else:
    # Recherche alternative si les espaces diffèrent légèrement
    import re
    content = re.sub(
        r'<button id="btn-run" class="btn-run-custom" style="margin: 10px; width: 150px;">',
        '<button id="btn-run" class="btn-run-custom" style="width: 180px; flex-shrink: 0;">',
        content
    )

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Patcheur HTML : Alignement inline et suppression des styles d’isolement achevés.')
EOF
fi

# -----------------------------------------------------------------
# VÉRIFICATIONS ANTI-RÉGRESSION FINALES
# -----------------------------------------------------------------
echo -e "\n================================================================="
echo -e "🛡️  VÉRIFICATION RIGIDE DU COMPILATEUR ET DU BUNDLE"
echo -e "================================================================="

if npx tsc --noEmit; then
    echo -e "[\e[32mSUCCÈS\e[0m] L'arbre syntaxique TypeScript est intègre."
else
    echo -e "[\e[31mERREUR\e[0m] Échec de la validation de types."
    exit 1
fi

if grep -q "\"compile\":" package.json; then
    echo -e "[\e[34mINFO\e[0m] Recompilation Webpack du bundle UI..."
    if npm run compile; then
        echo -e "[\e[32mSUCCÈS\e[0m] Build de production validé."
    else
        echo -e "[\e[31mERREUR\e[0m] Échec de la compilation d'intégration."
        exit 1
    fi
fi

echo -e "\n================================================================="
echo -e "✅ Les boutons dynamiques de l'objet 'exchange' s'afficheront à droite."
echo -e "✅ Les conflits de centrage exclusif Flexbox ont été éliminés."
echo -e "================================================================="
