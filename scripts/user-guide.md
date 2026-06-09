# 🐍 Python CLI User Guide & Reference Manual

## 📖 Introduction for Beginners

Welcome to the core execution engine of the **Files Exporter** tool! If you are new to software engineering, you might wonder why a Visual Studio Code extension relies on an external Python script.

Visual Studio Code runs on top of JavaScript (Node.js). While JavaScript is excellent for user interfaces, it can easily choke, freeze, or exhaust system memory if asked to read, scan, and parse thousands of large code files simultaneously. Python, however, excel at raw text streaming and file processing. By delegating the file indexing to an independent Python 3 script, your editor remains fast, fluid, and responsive.

This script can be executed entirely on its own from your computer's terminal (Command Prompt on Windows, Terminal on macOS, or Shell on Linux) without even opening VS Code. This method is called running a command via a **CLI** (Command Line Interface).

## 📋 Understanding Command Line Arguments

When you run a script in the terminal, you modify its behavior by passing flags or variables called **arguments**. These parameters always start with a double dash (`--`).

| Parameter               | Type           | Default Value      | Description (Beginner Friendly)                                                                                                                                             |
| ----------------------- | -------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `--src`       | Folder Array   | Current Folder     | The target directories or individual files you want to scan. You can list multiple targets separated by a space.                                                            |
| `--dest`      | Folder Path    | `./exported_files` | The folder on your hard drive where the final combined text file, logs, and metrics reports will be written.                                                                |
| `--format`    | Choice List    | `yaml`             | The data layout language used to wrap your files. Allowed choices: `yaml`, `json`, `toml`, `xml`, `txt`.                                                                    |
| `--max-file`  | Number         | `50.0`             | Safety limit in Kilobytes (KB). Any single file larger than this number is skipped to avoid loading huge assets into memory.                                                |
| `--max-chunk` | Number         | `0.0`              | Maximum size in KB allowed for an output file. If set to `500`, the tool cuts your data into smaller files of 500KB each. Set to `0` to keep everything in one single file. |
| `--inc-paths` | Search Pattern | `.*`               | An advanced search criteria (Regular Expression or Regex) to specify folders you *explicitly want* to process.                                                              |
| `--exc-paths` | Search Pattern | *(Default list)*   | A search pattern specifying folders you want to *skip* completely (like `node_modules` or `.git`).                                                                          |
| `--inc-ext`   | Search Pattern | `''`               | A search pattern defining allowed file extensions (e.g., only capture `.py` files).                                                                                         |
| `--exc-ext`   | Search Pattern | *(Default list)*   | A search pattern defining forbidden extensions (like images `.png`, compressed files `.zip`, or logs).                                                                      |
| `--group-ext` | Switch Flag    | Disabled           | If typed, tells the tool to immediately split files into different output folders based on their programming language.                                                      |
| `--tree-view` | Switch Flag    | Disabled           | If typed, builds a background metadata file (`-tree.json`) mapping out the exact folder tree structure of your code.                                                        |
| `--log-file`  | Switch Flag    | Disabled           | If typed, writes a separate transaction history log (`export.log`) tracing exactly what happened.                                                                           |

---

## 🚀 20 Detailed Execution Examples

Here are 20 common recipes you can copy, paste, and run inside your system terminal:

### 1. Simple Default Project Extraction

Combines everything in your current folder into a single structured YAML file inside an `exports` folder.

```bash
python3 files-exporter.py --src . --dest ./exports
```

### 2. Structured JSON Export for Automated Ingestion

Compiles your current directory into a single JSON context block and generates a comprehensive folder map asset.

```bash
python3 files-exporter.py --src ./src --format json --tree-view
```

### 3. Chunked Payload Extraction for Standard AI Limits

Slices your codebase into individual, sequential files of exactly 500 Kilobytes each so they fit neatly into small AI chat limits.

```bash
python3 files-exporter.py --src ./src --max-chunk 500
```

### 4. Enterprise Java Backend Harvesting

Scans your system directories while strictly filtering out non-Java files and isolating standard Maven `pom.xml` configuration structures.

```bash
python3 files-exporter.py --src ./backend --inc-ext '.*\.(java|xml)$'
```

### 5. Modern Frontend Component Extraction

Targets an isolated web interface directory, capturing only TypeScript components, JavaScript utilities, and CSS stylesheets.

```bash
python3 files-exporter.py --src ./client/src --inc-ext '.*\.(tsx|ts|jsx|js|css)$'
```

### 6. Aggressive Size Filtering for Low-Token Budgets

Rejects any file that is larger than 10 Kilobytes. Ideal for avoiding massive minified build assets or raw data mockups.

```bash
python3 files-exporter.py --max-file 10
```

### 7. Core Logic Scan Bypassing Test Frameworks

Instructs the file crawler to completely omit files nested inside paths named `tests`, `spec`, or `mock`.

```bash
python3 files-exporter.py --exc-paths '.*/tests/.*|.*/spec/.*'
```

### 8. Structural XML Formatting for NotebookLM Notebooks

Aggregates workspace modules into standard XML blocks containing explicit CDATA tags, perfectly optimized for Google NotebookLM.

```bash
python3 files-exporter.py --format xml
```

### 9. Multi-Language Split Partitioning

Crawls your workspace and builds different output files segmenting your HTML, Python, and configuration files into dedicated folders.

```bash
python3 files-exporter.py --group-ext
```

### 10. Silent High-Performance Background Logging

Mutes the standard terminal text outputs to speed up processing but saves a permanent transaction log tracking the results.

```bash
python3 files-exporter.py --log-file --log-console
```

### 11. Disconnected Microservices Compilation

Concurrently targets discrete backend and frontend repositories, compiling them into a singular macro-context block.

```bash
python3 files-exporter.py --src /workspace/api-gateway /workspace/auth-service
```

### 12. Serialization into TOML Syntax Tables

Gathers project states and serializes files into readable TOML blocks suitable for configuration parser tools.

```bash
python3 files-exporter.py --format toml
```

### 13. Plain Text Flat-File Consolidation

Saves your workspace using old-school text separators (`--->` path and `<---` end) for simple text editors.

```bash
python3 files-exporter.py --format txt
```

### 14. Heavy Media and Assets Redirection

Filters your codebase while explicitly blocking media attachments, binary executables, or compressed packages from bloating text files.

```bash
python3 files-exporter.py --exc-ext '.*\.(png|jpg|mp3|exe|zip|tar|gz|pdf)$'
```

### 15. Global Configuration and Environment Scavenging

Searches through all nested layers to harvest strictly configuration setups like `.env`, `.json`, and `.yaml` settings.

```bash
python3 files-exporter.py --inc-ext '.*\.(env|json|yml|yaml)$'
```

### 16. Pure Technical Documentation Gathering

Isolates written guides, user reference manuals, and project `README` assets across the repository.

```bash
python3 files-exporter.py --inc-ext '.*\.md$'
```

### 17. System Metadata Exclusion

Cleans up your tracking by explicitly skipping hidden system state trees like `.git`, `.idea`, or `.vscode` setups.

```bash
python3 files-exporter.py --exc-paths '.*/\..*'
```

### 18. Monolithic Macro-Context Synthesis

Enforces unlimited output chunk weight bounds, pushing every single byte of code into one massive text file block.

```bash
python3 files-exporter.py --max-chunk 0
```

### 19. Infrastructure-as-Code (IaC) Extraction

Crawls deployment structures, capturing only Dockerfiles, Kubernetes templates, and CI/CD pipelines.

```bash
python3 files-exporter.py --inc-paths '.*/docker/.*|.*/\.github/.*|.*Makefile$'
```

### 20. Absolute Path System Automation Backup

Executes a comprehensive targeted backup across specific system paths, frequently used in automated crontabs.

```bash
python3 files-exporter.py --src /var/www/html --dest /home/backup/prod_export
```
