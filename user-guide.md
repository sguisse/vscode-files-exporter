# 📖 Extension Interface User Guide for Beginners

Welcome to the Files Exporter interface! This reference guide explains every button, setting, and dashboard tab so you can start preparing context packages for AI development like a pro.

<img src="assets/vscode-explorer-menuitems.png" alt="Interface access Overview" style="width: 80%; border: 1px solid var(--vscode-panel-border); border-radius: 4px; margin: 10px 0;">

## 🎛️ The Main Control Cockpit

### 1. Configuration History Profiles (Top Row)

Think of this section as your "Saved Configuration Slots." Once you create perfect filters, you can save them here.

* **Dropdown Registry**: Select a saved profile. Choosing `< Default Configuration >` clears your screen and restores your default system settings.
* **Lock/Unlock Button (`codicon-unlock` / `codicon-lock`)**: Locks your profile settings. When locked, you cannot accidentally overwrite your complex regular expressions or filter rules.
* **Pencil Button (`codicon-edit`)**: Opens a prompt box to give your active configuration profile a clear name (e.g., "Export React Code Only").
* **Duplicate Button (`codicon-files`)**: Copies your current settings into a fresh profile slot so you can experiment with variations.
* **Trash Button (`codicon-trash`)**: Permanently purges profiles. Offers "Soft" deletion (moves them to a `.del` backup file) or "Hard" deletion (absolute erase).

### 2. Path & Source File Selectors

* **Source Paths Textbox (`pathList`)**: Type or paste the folders or files you want to combine. You can separate paths using newlines, commas, or semicolons. If you type a path that does not exist on your computer, the textbox instantly flashes in a red pastel color to warn you.
* **Active Tabs File Inserter (`codicon-go-to-file`)**: Click this to automatically read the paths of all code files you currently have open in your active VS Code tabs.
* **Git Sync Delta Button (`codicon-git-compare`)**: Automatically checks which files have changed between your computer and the remote repository, adding only those modified files to the list. Great for asking an AI: *"Can you review my recent code changes?"*

### 3. File Restrictions & Regex Filtering

* **Max File (KB)**: Any file larger than this number is ignored. This keeps huge database files or video files from bloating your output.
* **Include Paths / Exclude Paths Textareas**: Advanced filters using Regular Expressions (Regex). For example, typing `.*/node_modules/.*` inside Exclude Paths tells the engine to skip heavy dependency folders entirely.
* **Include Exts / Exclude Exts Textareas**: Filter by file type. Want only Python? Type `.*\.py$` inside Include Exts. Want to ignore compiled files? Type `.*\.pyc$` in Exclude Exts.

### 4. Serialization Options

* **Output Format**: Choose the structure of your output file. **YAML** is highly recommended for ChatGPT/Gemini because AI models read its layout efficiently. **XML** is ideal for Google NotebookLM.
* **Max Chunk (KB)**: Set this to `500` to automatically split a large export into multiple files of 500KB each. Set to `0` to keep everything in one single file.
* **Split by Ext**: Check this if you want different file types saved in separate files.
* **Tree view**: It generate a file storing only the folder structure of exported files, used by the tab `Tree View` to display more efficiently exported files.
* **Copy to clip**: Automatically copies generated export files directly to your OS clipboard after each successful export run.
* **Log Console**: Toggles streaming log outputs directly into the extension webview terminal view interface.
* **Log File**: Enables saving a physical log tracking tracing file inside your configured destination folder.

---

## 📊 Understanding the Analytics & Tabs (Bottom Layout)

Once you click **🚀 RUN EXPORT**, the results panels activate at the bottom of the screen.

### 1. REPORT Tab

Displays metrics for every file extension discovered. It shows exactly how many files were safely exported, how many were rejected (too large), and how many were excluded by filters. It also includes an interactive, responsive pie chart visualizing the file composition.

### 2. FILES Tab

Lists the exact files generated on your computer. You can click any file line item to open it in your VS Code editor, or click the folder icon (📂) to reveal it directly in Windows Explorer or macOS Finder.

### 3. TERMINAL Tab

Shows the raw background process logs.

* **Command Bar**: Automatically prints the exact shell terminal command built from your visual settings. Click the copy button (`codicon-copy`) to run this headless command in an external shell pipeline or server.
* **Shell Console**: Emulates a real IDE terminal window, displaying timestamps, process metrics tables, system diagnostics, and background tracing details.

### 📊 The Report & Tree View Split-Pane
To maximize screen real estate and adhere to SOLID UX principles, the **Export Report** and the **Tree View** are unified within the `REPORT` tab.
* **Interactive Split-Pane:** You can horizontally resize the boundary between the statistical table and the file tree to fit your reading preferences.
* **Multi-Sort Table:** Shift-click the table headers (Extension, Exported, Size Rejected, Excluded) to perform multi-column sorting.

### 🪾 Tree View Explorer Interactions
The Tree View provides powerful shortcuts to manipulate your source files directly from the extension:
* **Folder Name Click:** Expands the folder and simultaneously selects/reveals it natively inside your VS Code Explorer sidebar.
* **📂 Folder Icon:** Opens your operating system's native file explorer (Finder/Windows Explorer) directly at that folder's location.
* **🚫 Exclude Icon (Standard Mode):** Injects a relative path regex into the `Exclude Paths` filter.
* **🚫 Exclude Icon (Extension Mode):**
  * **Root Node Click:** Automatically excludes *all* sub-extensions currently present in the tree.
  * **Subfolder Click:** Excludes that specific extension group.
  * **Leaf (File) Click:** Excludes only that specific file path.
* **Collapse All:** Cleans up the view but intelligently keeps the Root Node expanded so you never lose your entry point.

### 🖱️ Explorer Context Menu
Right-clicking files/folders in the VS Code Explorer provides quick access to the tool:
* **Files Exporter - 01 --> 🎛️ Open UI:** Launches the interface.
* **Files Exporter - 02 --> ➕ Sources Paths:** Appends selected files to the Source Paths list.
* **Files Exporter - 03 --> 🚫 Exclude paths:** Automatically generates and adds exclusion regex patterns for the selected items. *(Note: To keep your context menu clean, this option is only visible when the Files Exporter UI tab is actively open).*
* **Files Exporter - 04 --> 📥 Export selected paths:** Triggers a "Headless" background export.
* **Files Exporter - 05 --> 📋 Copy selected files:** Recursively harvests all absolute paths within your selection to copy them to the clipboard. Automatically prompts a safety warning popup if payload exceeds 50 files or 5MB.
  * **Clipboard Behavior:** Upon success, the actual *generated output files* (chunks) are copied directly to your OS clipboard, ready to be pasted into your LLM.
  * **Notifications:** You will receive a rich notification with the export metrics and a button to quickly copy the source paths if needed.

### 🧪 Filter Simulator & Conflict Management
* **Python Engine Simulator:** The `Filters Simulator` input field tests your text directly against the underlying Python backend engine to guarantee 1:1 parity with the actual export execution. (A ⏳ emoji indicates the backend is processing the evaluation).
* **Extension Conflict Management:** If you attempt to add an extension to `Exclude Exts` that already exists in `Include Exts` (or vice-versa), a conflict resolution modal will appear. You can choose to **Move** the extension (automatically removing it from the opposing list) or **Add Anyway**.
