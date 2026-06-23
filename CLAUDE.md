# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Files Exporter** is a VS Code extension that scans selected directories/files and exports their contents into structured files (YAML, JSON, XML, TOML, TXT) for AI/LLM context ingestion. It uses a three-layer architecture:

1. **Presentation Layer** - Webview UI (HTML/JS) running in a sandboxed iFrame
2. **Application Layer** - TypeScript VS Code extension host services
3. **Worker Layer** - Isolated Python subprocess (`scripts/files-exporter.py`)

## Key Commands

```bash
npm install          # Install dependencies
npm run compile      # Build with webpack (dev mode)
npm run package      # Build with webpack (production mode)
npm run vscode:prepublish  # Runs npm run package (auto before publish)
```

**No real test suite exists** - `src/test/extension.test.ts` contains only a placeholder. VS Code extension testing would use `vscode-extension-tester` or the built-in test runner via `npm test` / `vscode test`.

## Architecture

### Entry Point
[src/extension.ts](src/extension.ts) - Activates the extension, creates core services (ConfigService, HistoryService, ProcessRunnerService), instantiates ExporterWebviewPanel, and calls registerCommands().

### Backend Services (src/services/)
- [export-orchestrator.service.ts](src/services/export-orchestrator.service.ts) - **Core export logic**: validates inputs, builds CLI args, spawns Python process, parses results, calculates token costs
- [history.service.ts](src/services/history.service.ts) - Profile persistence (JSON wrapper with config.repo + history arrays)
- [config.service.ts](src/services/config.service.ts) - Reads vscode.workspace.getConfiguration with fallback defaults
- [process-runner.service.ts](src/services/process-runner.service.ts) - Python subprocess management (spawn, stdout/stderr capture, process tracking)
- [rich-notification.service.ts](src/services/rich-notification.service.ts) - Dual-path notifications (webview toast if panel open, native VS Code fallback)
- [git.service.ts](src/services/git.service.ts) - Git diff operations (status --porcelain, merge-base diff)
- [file-system.service.ts](src/services/file-system.service.ts) - File system utilities (exists, isDirectory, clearDirectory)
- [clipboard.service.ts](src/services/clipboard.service.ts) - OS clipboard integration

### Handlers (src/handlers/)
- [message.router.ts](src/handlers/message.router.ts) - **IPC switchboard**: receives JSON packets from webview, routes to appropriate handler
- [export.handler.ts](src/handlers/export.handler.ts) - Export command handler
- [history.handler.ts](src/handlers/history.handler.ts) - History/profile CRUD handler

### Commands (src/commands/)
- [extension-commands.ts](src/commands/extension-commands.ts) - Registers all VS Code commands

### Webview (src/webview/)
- [webview.panel.ts](src/webview/webview.panel.ts) - Panel lifecycle (create/reveal/dispose), message routing, initialization
- [webview.html](src/webview/webview.html) - Main HTML structure
- [main.js](src/webview/main.js) - Webview entry point, initializes all tabs
- **Tabs**: report-tab.js, tree-view-tab.js, files-tab.js, terminal-tab.js, help-tab.js
- **JS Core**: js/core/ (initialization.manager.js, state.manager.js, ui.controller.js, vscode.bridge.js)
- **JS Components**: js/components/ (split-pane.js, popup-extension-conflict.js)
- **JS Services**: js/services/ (export-manager.js, history-manager.js, filters-manager.js, pricing-service.js, etc.)

### Python Engine (scripts/)
- [files-exporter.py](scripts/files-exporter.py) - Core export engine: file scanning, regex filtering, chunking, format serialization
- [copy-files-to-clipboard.py](scripts/copy-files-to-clipboard.py) - OS clipboard copy utility

### Interfaces (src/interfaces/)
- [export.interface.ts](src/interfaces/export.interface.ts) - ExportConfig, HistoryEntry, ExtensionState type definitions

## Build & Deployment Notes

- **Webpack bundles** `src/extension.ts` into `dist/extension.js` (target: node, commonjs2)
- **`.vscodeignore`** excludes `src/**/*.ts` from the vsix (webpack bundles them), but **keeps** `src/webview/**` and `scripts/**`
- **VSIX packaging**: `npx vsce package` (uses @vscode/vsce)
- Extension targets VS Code ^1.80.0, requires Python 3.8+
- All 21 configuration settings live in [package.json](package.json) under `contributes.configuration.properties`

## Code Style

- TypeScript with `strict: true`, ES2022 target, Node16 modules
- ESLint via [eslint.config.mjs](eslint.config.mjs): camelCase/PascalCase imports, curly braces, eqeqeq, no-throw-literal, semi-colons
- No comments unless the WHY is non-obvious (hidden constraint, invariant, or bug workaround)

## Key Patterns

- **Wrapper pattern for history**: `{ config: { repo: [], lastRunConfigId }, history: [] }`
- **IPC bridge**: webview sends JSON via `vscode.postMessage()`, backend routes through MessageRouter
- **Context key lifecycle**: `filesExporter.isToolOpened` toggles to show/hide "Exclude paths" context menu
- **RichNotificationService routing**: webview toast if panel visible, native VS Code notification fallback
- **Filter simulation**: webview sends regex to Python engine for 1:1 parity with actual export execution
