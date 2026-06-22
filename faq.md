# ❓ Frequently Asked Questions (FAQ)

## Explain the difference between include and exclude regex filters

**Include Regex Filters** and **Exclude Regex Filters** serve opposite functions in determining which files the Files Exporter processes, effectively acting as whitelist and blacklist systems.

### 🟢 Include Regex Filters (The Whitelist)

These filters determine what files the tool is allowed to process. If an include filter is defined, a file must match it to be exported; otherwise, it is skipped.

* **Include Paths (`includePathsRegex`)**: By default, this is set to `.*` to include all paths in your workspace.
* **Include Extensions (`includeExtensionsRegex`)**: By default, this targets common development files (such as `.java`, `.ts`, `.js`, `.py`, `.json`, `.yaml`, etc.). If a file's extension does not match this regex, it is ignored.

### 🔴 Exclude Regex Filters (The Blacklist)

These filters define what the tool must explicitly ignore. If a file matches an exclude filter, it is instantly rejected and skipped, even if it met the conditions of the Include filters.

* **Exclude Paths (`excludePathsRegex`)**: This is used to bypass heavy or irrelevant directories. The default regex explicitly excludes common build, dependency, and version control folders like `node_modules`, `target`, `.git`, `dist`, `.idea`, and `.vscode`.
* **Exclude Extensions (`excludeExtensionsRegex`)**: This targets unhelpful file types that you do not want feeding into an LLM. The default regex skips files without extensions or specific formats like binaries, archives, and logs (e.g., `.log`, `.tmp`, `.zip`, `.png`, `.pyc`).

### ⚙️ How they work together

Behind the scenes, the Python engine (`files-exporter.py`) runs a strict check on every file. <br/>
A file is only allowed into the final export if it matches the `include paths` and `include extensions`, **AND** does not match the `exclude paths` and `exclude extensions`.

## 💾 How can a configuration be saved in the history file

The extension handles this entirely automatically.

* Every time you run an export, your complete setup (including your selected folders, filters, and formats) is instantly captured and memorized in a history log file as an ExportConfig
* By default, this file is stored on your computer at `~/files-exporter/.files-exporter-history.yaml`, but you can customize this location by updating the `filesExporter.historyYamlPath` option in your VS Code settings

## 🔒 How can I protect a saved configuration from being altered even if a user adjusts a selected saved export configuration

To prevent your important setups from being overwritten by mistake, each saved configuration mapped to the HistoryEntry interface has a built-in frozen boolean property

* This acts as a locking feature (or "flag de verrouillage")
* When a configuration is marked as locked, it is permanently protected. In practice, this means if you load a locked configuration, tweak a few settings, and launch the tool, your original protected save will never be overwritten, and the extension will treat your changes as a brand-new task.

### ❓ Why is the "Exclude paths" option missing from my right-click menu?
To prevent cluttering your native VS Code Explorer context menu, the `Files Exporter --> 🚫 Exclude paths` command is dynamically hidden when the extension's UI is closed. Simply open the tool, and the menu item will reappear.

### ❓ What happens to my clipboard when I click "Export selected paths" from the Explorer?
During a headless background export, the extension automatically copies the **generated output files** (the text chunks intended for your LLM) directly to your operating system's clipboard. The notification popup that appears upon completion also provides a fallback button to copy the original *source paths* if you need them.

### ❓ Why does the Filter Simulator show a ⏳ loading hourglass?
The simulator doesn't rely on simple Javascript regex. It pauses briefly while you type (debouncing) and sends your input to the actual Python engine in the background. This guarantees that the ✅ or ❌ you see in the UI exactly matches what the export engine will do during a real run.

