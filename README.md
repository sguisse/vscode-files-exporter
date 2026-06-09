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
