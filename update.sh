#!/bin/bash

echo "🚀 Starting documentation update pipeline..."

# Ensure we are in the workspace root by checking for package.json
if [ ! -f "package.json" ]; then
    echo "⚠️ Warning: package.json not found. Please run this script from the workspace root."
    exit 1
fi

# We use 'EOF' in single quotes so Bash ignores all backticks and $ symbols inside!
cat << 'EOF' > patch_docs.py
import os
import re

def update_section(filepath, header, new_content):
    if not os.path.exists(filepath):
        print(f"  [Create] {filepath} did not exist. Creating it.")
        content = ""
    else:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

    # Regex to find the header and everything under it until the next header of any level (^#) or End of File (\Z)
    pattern = r'(?m)^' + re.escape(header) + r'\b.*?(?=(?:^#|\Z))'

    # If header exists, replace the block. Otherwise, append to the end.
    if re.search(pattern, content, flags=re.DOTALL):
        updated_content = re.sub(pattern, new_content + '\n\n', content, flags=re.DOTALL)
        print(f"  [Update] Replaced existing section '{header}' in {filepath}")
    else:
        updated_content = content.strip() + '\n\n' + new_content + '\n\n'
        print(f"  [Append] Added new section '{header}' to {filepath}")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(updated_content)


print("📄 Updating user-guide.md...")
update_section('user-guide.md', '### 📊 The Report & Tree View Split-Pane', r"""### 📊 The Report & Tree View Split-Pane
To maximize screen real estate and adhere to SOLID UX principles, the **Export Report** and the **Tree View** are unified within the `REPORT` tab.
* **Interactive Split-Pane:** You can horizontally resize the boundary between the statistical table and the file tree to fit your reading preferences.
* **Multi-Sort Table:** Shift-click the table headers (Extension, Exported, Size Rejected, Excluded) to perform multi-column sorting.""")

update_section('user-guide.md', '### 🪾 Tree View Explorer Interactions', r"""### 🪾 Tree View Explorer Interactions
The Tree View provides powerful shortcuts to manipulate your source files directly from the extension:
* **Folder Name Click:** Expands the folder and simultaneously selects/reveals it natively inside your VS Code Explorer sidebar.
* **📂 Folder Icon:** Opens your operating system's native file explorer (Finder/Windows Explorer) directly at that folder's location.
* **🚫 Exclude Icon (Standard Mode):** Injects a relative path regex into the `Exclude Paths` filter.
* **🚫 Exclude Icon (Extension Mode):**
  * **Root Node Click:** Automatically excludes *all* sub-extensions currently present in the tree.
  * **Subfolder Click:** Excludes that specific extension group.
  * **Leaf (File) Click:** Excludes only that specific file path.
* **Collapse All:** Cleans up the view but intelligently keeps the Root Node expanded so you never lose your entry point.""")

update_section('user-guide.md', '### 🖱️ Explorer Context Menu', r"""### 🖱️ Explorer Context Menu
Right-clicking files/folders in the VS Code Explorer provides quick access to the tool:
* **Files Exporter --> Open UI:** Launches the interface.
* **Files Exporter --> Add from Explorer:** Appends selected files to the Source Paths list.
* **Files Exporter --> 🚫 Exclude paths:** Automatically generates and adds exclusion regex patterns for the selected items. *(Note: To keep your context menu clean, this option is only visible when the Files Exporter UI tab is actively open).*
* **Files Exporter --> 📤 Export selected paths:** Triggers a "Headless" background export.
  * **Clipboard Behavior:** Upon success, the actual *generated output files* (chunks) are copied directly to your OS clipboard, ready to be pasted into your LLM.
  * **Notifications:** You will receive a rich notification with the export metrics and a button to quickly copy the source paths if needed.""")

update_section('user-guide.md', '### 🧪 Filter Simulator & Conflict Management', r"""### 🧪 Filter Simulator & Conflict Management
* **Python Engine Simulator:** The `Filters Simulator` input field tests your text directly against the underlying Python backend engine to guarantee 1:1 parity with the actual export execution. (A ⏳ emoji indicates the backend is processing the evaluation).
* **Extension Conflict Management:** If you attempt to add an extension to `Exclude Exts` that already exists in `Include Exts` (or vice-versa), a conflict resolution modal will appear. You can choose to **Move** the extension (automatically removing it from the opposing list) or **Add Anyway**.""")


print("📄 Updating faq.md...")
update_section('faq.md', '### ❓ Why is the "Exclude paths" option missing from my right-click menu?', r"""### ❓ Why is the "Exclude paths" option missing from my right-click menu?
To prevent cluttering your native VS Code Explorer context menu, the `Files Exporter --> 🚫 Exclude paths` command is dynamically hidden when the extension's UI is closed. Simply open the tool, and the menu item will reappear.""")

update_section('faq.md', '### ❓ What happens to my clipboard when I click "Export selected paths" from the Explorer?', r"""### ❓ What happens to my clipboard when I click "Export selected paths" from the Explorer?
During a headless background export, the extension automatically copies the **generated output files** (the text chunks intended for your LLM) directly to your operating system's clipboard. The notification popup that appears upon completion also provides a fallback button to copy the original *source paths* if you need them.""")

update_section('faq.md', '### ❓ Why does the Filter Simulator show a ⏳ loading hourglass?', r"""### ❓ Why does the Filter Simulator show a ⏳ loading hourglass?
The simulator doesn't rely on simple Javascript regex. It pauses briefly while you type (debouncing) and sends your input to the actual Python engine in the background. This guarantees that the ✅ or ❌ you see in the UI exactly matches what the export engine will do during a real run.""")


print("📄 Updating scenario.md...")
update_section('scenario.md', '### Step 3: Tuning Extensions and Resolving Conflicts', r"""### Step 3: Tuning Extensions and Resolving Conflicts
While reviewing the Tree View, you might notice auto-generated `*.log` or `*.tmp` files creeping into your export context.
1. Switch the Tree View to **Extension Mode** using the <span class="codicon codicon-file"></span> toggle.
2. Locate the unwanted extension group (e.g., `log`) and click the 🚫 icon.
3. If that extension was accidentally hardcoded into your `Include Exts` list, the extension will instantly detect the contradiction and prompt you with a **Conflict Warning**.
4. Click **Move** to safely strip it from the inclusion list and enforce the exclusion, keeping your configuration perfectly valid.""")


print("📄 Updating readme.md...")
update_section('readme.md', '## ✨ Key Features', r"""## ✨ Key Features
* **Unified Split-Pane Analysis:** The Export Report and Source Tree Explorer are seamlessly integrated into a single, horizontally resizable view, allowing you to analyze statistical outputs alongside the physical file structure.
* **Smart Filter Simulator:** Test your RegEx rules in real-time. The simulator bypasses basic JavaScript evaluation and directly queries the background Python engine to guarantee 100% execution accuracy before you run an export.
* **Intelligent Conflict Resolution:** Accidental contradictions (e.g., adding an extension to both `Include` and `Exclude` lists) trigger a smart modal allowing you to safely "Move" or resolve the conflict without breaking your configuration.
* **Headless Background Exporting:** Trigger exports directly from the VS Code Explorer context menu without opening the UI. The engine runs silently in the background and automatically caches the *generated output files* straight into your OS clipboard for instant LLM pasting.""")

update_section('readme.md', '### 🖱️ Quick Actions (Context Menu)', r"""### 🖱️ Quick Actions (Context Menu)
Right-click any folder or file in the VS Code Explorer to access quick tools:
* **Open UI / Add from Explorer:** Launch the tool or append paths to your active selection.
* **🚫 Exclude paths:** Automatically generate and inject regex exclusions. *(Note: To keep your IDE clean, this menu item dynamically hides itself when the Files Exporter UI is closed).*
* **📤 Export selected paths:** Runs a silent headless export. A rich notification will pop up upon completion, and the generated files are instantly copied to your clipboard.""")


print("📄 Updating architecture.md...")
update_section('architecture.md', '### 🖥️ Frontend (Webview Components)', r"""### 🖥️ Frontend (Webview Components)
The UI adheres strictly to SOLID principles, isolating logic into dedicated modular components:
* `report-tab.js`: Manages the statistical export table (with multi-column sorting) and the cost estimation charts. It acts as the primary host for the Split-Pane layout.
* `tree-view-tab.js`: Renders the interactive file explorer. Features dynamic click routing (VS Code Explorer reveal vs. OS Finder reveal) and deep regex exclusion pattern generation based on active view modes.
* `split-pane.js`: A lightweight, standalone utility managing the horizontal resize logic between the Report Table and the Tree View.
* `popup-extension-conflict.js`: An externalized modal component specifically handling the "Move vs Add" conflict resolution when users contradict inclusion/exclusion extension lists.
* `filters-simulator.js`: Manages user input debouncing and delegates Regex evaluation via the VS Code bridge to the actual Python engine.""")

update_section('architecture.md', '### ⚙️ Backend (Extension Host Services)', r"""### ⚙️ Backend (Extension Host Services)
* **`ExportOrchestratorService`:** The core commander. It builds the arguments, manages the `python3` process spawning for both real exports AND the `simulateFilters` dry-run, and parses the physical file outputs to calculate tokens.
* **`RichNotificationService`:** Manages user feedback. It intelligently routes notifications: if the Webview is open, it renders beautiful HTML toasts with interactive buttons. If the Webview is closed (e.g., during headless exports), it safely falls back to native VS Code plain-text popups.""")

update_section('architecture.md', '### 🔄 Context Keys & Lifecycle Management', r"""### 🔄 Context Keys & Lifecycle Management
To ensure the extension integrates seamlessly without bloating the user's IDE, we utilize custom VS Code context keys:
* `filesExporter.isToolOpened`: Managed by the `ExporterWebviewPanel` class. It toggles to `true` when the UI initializes and `false` upon disposal. This key is bound in `package.json` to dynamically show/hide the "Exclude paths" command in the Explorer context menu.""")

print("✅ Documentation patching complete!")
EOF

# Execute the python patcher script
