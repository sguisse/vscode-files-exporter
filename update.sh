#!/bin/bash

# ===================================================================================================
# CONFIGURATION PROFILE: HOIST FILES EXPORTER MENU ACTIONS TO ABSOLUTE TOP (NAVIGATION GROUP)
# ===================================================================================================
node -e "
const fs = require('fs');
const pkgPath = './package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

// Anchor the items inside the navigation master group while maintaining sequential internal sorting order weights
pkg.contributes.menus['explorer/context'] = [
    { 'command': 'files-exporter.openTool', 'group': 'navigation@1' },
    { 'command': 'files-exporter.addFromExplorer', 'group': 'navigation@2' },
    { 'command': 'files-exporter.ExcludeFromExplorer', 'group': 'navigation@3' }
];

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4), 'utf8');
"
