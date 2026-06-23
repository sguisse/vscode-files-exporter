# 📁 Files Exporter - VS Code Extension

## ✨ What is Files Exporter?
Welcome! **Files Exporter** is an extension built for developers who want to share their project contexts with Artificial Intelligence models (like Google Gemini, Claude, or ChatGPT) or perform deep code reviews.

When you ask an AI to help you adapt your architecture or write new features, the AI needs to understand how your existing files connect. Copying and pasting dozens of files manually takes hours and leads to mistakes. This extension automates the entire process: it crawls your directories, ignores useless junk files (like images, logs, or dependencies), and compresses your complete codebase into a single well-structured text file that you can drag and drop into an AI chat!

## 🚀 Core Capabilities
* 📋 **Multi-Format Serialization**: Export code seamlessly into YAML, JSON, XML, TOML, or flat TXT layouts.
* 📦 **Smart Data Chunking**: Automatically slice giant code outputs into small sequentially numbered files (e.g., exactly 50KB slices) to respect AI token quotas.
* 🌿 **Upstream Git Diff Ingestion**: Export *only* the files that have changed between your local workstation branch and the remote origin repository.
* 🌲 **Interactive Manifest Tree View**: Select specific sub-directories or code elements via checkbox lists. Uses a reliable 3-state engine (checked, unchecked, indeterminate).
* 🔒 **Configuration Profiles Lock**: Lock stable search parameters to protect them from accidental changes during runs.

## 🛠️ Installation Requirements
To achieve memory safety and avoid freezing your editor interface, Files Exporter offloads the processing workload to Python.
1. Ensure your **Visual Studio Code** editor is version `^1.80.0` or newer.
2. Ensure **Python 3.8+** is installed on your operating system and available in your environment path.
3. Install **Files Exporter** from the VS Code Extensions Marketplace.

## ⚙️ Extension Settings Customization
Open your editor settings (`settings.json`) and search for `filesExporter` to customize your experience:
* `filesExporter.defaultFormat`: Change the default format slot (Default: `yaml`).
* `filesExporter.maxFileSizeKb`: Automatically skip individual files larger than this size limit (Default: `50` KB).
* `filesExporter.tooltipDelay`: Speed in milliseconds before helpful tooltips pop up on hover.

## 📜 License
This extension is distributed under the open-source MIT License.

## ✨ Key Features
* **Unified Split-Pane Analysis:** The Export Report and Source Tree Explorer are seamlessly integrated into a single, horizontally resizable view, allowing you to analyze statistical outputs alongside the physical file structure.
* **Smart Filter Simulator:** Test your RegEx rules in real-time. The simulator bypasses basic JavaScript evaluation and directly queries the background Python engine to guarantee 100% execution accuracy before you run an export.
* **Intelligent Conflict Resolution:** Accidental contradictions (e.g., adding an extension to both `Include` and `Exclude` lists) trigger a smart modal allowing you to safely "Move" or resolve the conflict without breaking your configuration.
* **Headless Background Exporting:** Trigger exports directly from the VS Code Explorer context menu without opening the UI. The engine runs silently in the background and automatically caches the *generated output files* straight into your OS clipboard for instant LLM pasting.

### 🖱️ Quick Actions (Context Menu)
Right-click any folder or file in the VS Code Explorer to access quick tools:
* **🎛️ Open UI / Add from Explorer:** Launch the tool or append paths to your active selection.
* **🚫 Exclude paths:** Automatically generate and inject regex exclusions. *(Note: To keep your IDE clean, this menu item dynamically hides itself when the Files Exporter UI is closed).*
* **Files Exporter - 04 --> 📥 Export selected paths:** Runs a silent headless export. A rich notification will pop up upon completion, and the generated files are instantly copied to your clipboard.
* **Files Exporter - 05 --> 📋 Copy selected files:** Performs a deep recursive file discovery walk across chosen folders to stage absolute paths onto your clipboard. Governed by a safety modal guardrail warning triggering at 50+ files or 5MB+ size constraints.
* **📋 Copy selected files:** Sweeps through your selections recursively to harvest all underlying absolute paths and copy them directly to the OS clipboard cache. Features a safety warning popup if you exceed 50 files or 5MB to ensure optimal performance.
