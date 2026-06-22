#!/usr/bin/env python3
import argparse
import os
import re
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone

for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")

# ─── Environment & Global Variables ───────────────────────────────────────────

DIRS_TO_PARSE = []
DEST_DIR = None
OUTPUT_FORMAT = "yaml"
MAX_SIZE_BYTES = 0
MAX_OUTPUT_SIZE_BYTES = 0
GROUP_BY_EXT = False
GENERATE_LOG_CONSOLE = True
GENERATE_LOG_FILE = False
GENERATE_TREE_VIEW = False
TIMESTAMP = None
LOG_FILE_HANDLE = None
GENERATED_FILES = {"exports": [], "logs": [], "reports": []}
PROCESSED_MANIFEST = []

HARDCODED_DEFAULTS = {
    'src': [os.getcwd()],
    'dest': os.path.join(os.getcwd(), "exported_files"),
    'format': 'yaml',
    'max_file': 50.0,
    'max_chunk': 0.0,
    'log_console': True,
    'log_file': False,
    'group_ext': False,
    'inc_paths': '.*',
    'exc_paths': "\n".join([
        ".*/node_modules/.*", ".*/target/.*", ".*/out/.*", ".*/\\.git/.*",
        ".*/dist/.*", ".*/build/.*", ".*/\\.turbo/.*", ".*/\\.next/.*",
        ".*/coverage/.*", ".*/\\.cache/.*", ".*\\.history/.*"
    ]),
    'inc_ext': '',
    'exc_ext': "\n".join([
        ".*\\.(log|tmp)$", ".*\\.lock$", ".*\\.zip$", ".*\\.tar$",
        ".*\\.(png|jpg|jpeg|gif|bmp|svg|webp|ico)$", ".*\\.DS_Store$", ".*\\.pyc$"
    ]),
}

# ─── Utility & Initialization Helpers ─────────────────────────────────────────

def log(msg, emoji="", add_ts=True, force_console=False):
    global GENERATE_LOG_FILE, LOG_FILE_HANDLE, GENERATE_LOG_CONSOLE

    if GENERATE_LOG_FILE and LOG_FILE_HANDLE:
        if add_ts:
            ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            full_msg = f"{ts} {emoji} {msg}" if emoji else f"{ts} {msg}"
        else:
            full_msg = f"{emoji} {msg}" if emoji else msg
        try:
            LOG_FILE_HANDLE.write(full_msg + "\n")
            LOG_FILE_HANDLE.flush()
        except Exception:
            pass

    if force_console or GENERATE_LOG_CONSOLE:
        print(f"{emoji} {msg}" if emoji else msg)


def compile_regexes(name, patterns):
    if not patterns:
        return []
    try:
        if isinstance(patterns, str):
            patterns = re.split(r'[\n,;]', patterns)
        patterns = [p.strip() for p in patterns if p.strip()]
        return [re.compile(p) for p in patterns]
    except re.error as e:
        log("Invalid regex in " + name + ": " + str(e), emoji="❗")
        sys.exit(2)


def format_size(num_bytes):
    if num_bytes >= 1024 * 1024:
        return f"{num_bytes / (1024 * 1024):.1f}MB"
    return f"{num_bytes / 1024:.1f}KB"


def matches_any(text, compiled_regexes):
    if not compiled_regexes:
        return False
    return any(r.search(text) for r in compiled_regexes)


def is_file_allowed(rel_filepath, filename, filters):
    if filters['inc_paths'] and not matches_any(rel_filepath, filters['inc_paths']):
        return False
    if filters['exc_paths'] and matches_any(rel_filepath, filters['exc_paths']):
        return False
    if filters['inc_ext'] and not matches_any(filename, filters['inc_ext']):
        return False
    if filters['exc_ext'] and matches_any(filename, filters['exc_ext']):
        return False
    return True

# ─── Export Formatters ────────────────────────────────────────────────────────

class StreamExporter:
    def __init__(self, fmt, out_file):
        self.fmt = fmt
        self.out_file = out_file
        self.first_file = True

    def start(self):
        if self.fmt == 'json':
            self.out_file.write('{\n  "files": [\n')
        elif self.fmt == 'xml':
            self.out_file.write('<?xml version="1.0" encoding="UTF-8"?>\n<export>\n  <files>\n')
        elif self.fmt in ['yaml', 'yml']:
            self.out_file.write('files:\n')

    def write_file(self, fname, ext, folder, content, rel_path):
        if self.fmt == 'txt':
            self.out_file.write(f"{'=' * 162}\n{rel_path}\n--->\n\n{content}\n<---\n\n")
        elif self.fmt == 'json':
            if not self.first_file:
                self.out_file.write(',\n')
            obj = {"filename": fname, "extension": ext, "path": folder, "content": content}
            self.out_file.write("    " + json.dumps(obj).replace('\n', '\n    '))
        elif self.fmt == 'xml':
            safe_content = content.replace(']]>', ']]]]><![CDATA[>')
            self.out_file.write(f"    <file>\n      <filename>{fname}</filename>\n")
            self.out_file.write(f"      <extension>{ext}</extension>\n      <path>{folder}</path>\n")
            self.out_file.write(f"      <content><![CDATA[{safe_content}]]></content>\n    </file>\n")
        elif self.fmt in ['yaml', 'yml']:
            self.out_file.write(f"  - filename: {json.dumps(fname)}\n    extension: {json.dumps(ext)}\n")
            self.out_file.write(f"    path: {json.dumps(folder)}\n    content: |-\n")
            for line in content.splitlines():
                self.out_file.write(f"      {line}\n")
            self.out_file.write("\n")
        elif self.fmt == 'toml':
            self.out_file.write(f"[[files]]\nfilename = {json.dumps(fname)}\n")
            self.out_file.write(f"extension = {json.dumps(ext)}\npath = {json.dumps(folder)}\n")
            self.out_file.write(f"content = {json.dumps(content)}\n\n")
        self.first_file = False

    def end(self):
        if self.fmt == 'json':
            self.out_file.write('\n  ]\n}\n')
        elif self.fmt == 'xml':
            self.out_file.write('  </files>\n</export>\n')

# ─── File Scanning Engine ─────────────────────────────────────────────────────

class FileScanner:
    def __init__(self, filters):
        self.filters = filters
        self.exporters = {}

        # Global metrics
        self.g_fold = set()
        self.g_exts = defaultdict(int)
        self.g_rej = defaultdict(int)
        self.g_exc = defaultdict(int)
        self.g_bnd = defaultdict(lambda: {'min': float('inf'), 'max': 0})

        # Current chunk metrics
        self.c_fold = set()
        self.c_exts = defaultdict(int)
        self.c_rej = defaultdict(int)
        self.c_exc = defaultdict(int)
        self.c_bnd = defaultdict(lambda: {'min': float('inf'), 'max': 0})

    def _update_bounds(self, ext, sz):
        self.c_bnd[ext]['min'] = min(self.c_bnd[ext]['min'], sz)
        self.c_bnd[ext]['max'] = max(self.c_bnd[ext]['max'], sz)
        self.g_bnd[ext]['min'] = min(self.g_bnd[ext]['min'], sz)
        self.g_bnd[ext]['max'] = max(self.g_bnd[ext]['max'], sz)

    def _open_new_chunk(self, index, ext=""):
        ext_part = f"_{ext}" if GROUP_BY_EXT and ext else ""
        out_filepath = os.path.join(DEST_DIR, f"export-{TIMESTAMP}{ext_part}_{index:02d}.{OUTPUT_FORMAT}")
        out_file = open(out_filepath, "w", encoding="utf-8")
        GENERATED_FILES["exports"].append(out_filepath)
        exporter = StreamExporter(OUTPUT_FORMAT, out_file)
        exporter.start()
        return out_file, exporter

    def _get_exporter(self, ext):
        ext_key = ext if GROUP_BY_EXT else "default"
        if ext_key not in self.exporters:
            out_file, exporter = self._open_new_chunk(1, ext_key if GROUP_BY_EXT else "")
            self.exporters[ext_key] = {'file': out_file, 'exporter': exporter, 'idx': 1}
        return self.exporters[ext_key]

    def _check_chunk_rotation(self, ext_key):
        exp_data = self.exporters[ext_key]
        out_file = exp_data['file']

        if MAX_OUTPUT_SIZE_BYTES > 0 and out_file.tell() >= MAX_OUTPUT_SIZE_BYTES:
            exp_data['exporter'].end()
            out_file.close()
            exp_data['idx'] += 1

            new_file, new_exporter = self._open_new_chunk(exp_data['idx'], ext_key if GROUP_BY_EXT else "")
            self.exporters[ext_key]['file'] = new_file
            self.exporters[ext_key]['exporter'] = new_exporter

            self.c_fold.clear()
            self.c_exts.clear()
            self.c_rej.clear()
            self.c_bnd.clear()
            self.c_exc.clear()

    def process_file(self, fp, rel_fp, file_name, abs_f):
        fname, ext_dot = os.path.splitext(file_name)
        ext = ext_dot.lstrip('.')

        if MAX_SIZE_BYTES > 0:
            try:
                sz = os.path.getsize(fp)
                if sz > MAX_SIZE_BYTES:
                    self.c_rej[ext] += 1
                    self.g_rej[ext] += 1
                    self._update_bounds(ext, sz)
                    return
            except OSError:
                return

        if not is_file_allowed(rel_fp, file_name, self.filters):
            self.c_exc[ext] += 1
            self.g_exc[ext] += 1
            return

        ext_key = ext if GROUP_BY_EXT else "default"
        exp_data = self._get_exporter(ext)
        self._check_chunk_rotation(ext_key)

        try:
            with open(fp, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            self.exporters[ext_key]['exporter'].write_file(fname, ext, abs_f, content, rel_fp)

            self.c_exts[ext] += 1
            self.c_fold.add(abs_f)
            self.g_exts[ext] += 1
            self.g_fold.add(abs_f)
            PROCESSED_MANIFEST.append(os.path.abspath(fp))
        except Exception as e:
            log(f"Failed to read {rel_fp}: {e}", emoji="⚠️")

    def run_scan(self):
        for source_path in DIRS_TO_PARSE:
            if os.path.isfile(source_path):
                abs_f = os.path.dirname(os.path.abspath(source_path))
                rel_fp = "./" + os.path.basename(source_path)
                self.process_file(source_path, rel_fp, os.path.basename(source_path), abs_f)

            elif os.path.isdir(source_path):
                for root, dirs, files in os.walk(source_path):
                    abs_f = os.path.abspath(root)
                    rel_root = "./" + os.path.relpath(root, source_path).replace("\\", "/")
                    if rel_root == "./.":
                        rel_root = "."
                    if self.filters['exc_paths']:
                        dirs[:] = [d for d in dirs if not matches_any(f"{rel_root}/{d}", self.filters['exc_paths'])]
                    for file in files:
                        fp = os.path.join(root, file)
                        rel_fp = f"{rel_root}/{file}"
                        self.process_file(fp, rel_fp, file, abs_f)

    def finalize(self):
        chunks = 0
        for exp_data in self.exporters.values():
            exp_data['exporter'].end()
            exp_data['file'].close()
            chunks += exp_data['idx']
        return len(self.g_fold), dict(self.g_exts), dict(self.g_rej), dict(self.g_bnd), dict(self.g_exc), chunks

# ─── Reporting & Manifest Generation ──────────────────────────────────────────

def create_tree_manifest():
    global DEST_DIR, TIMESTAMP, PROCESSED_MANIFEST
    if not PROCESSED_MANIFEST:
        return None
    try:
        common = os.path.commonpath(PROCESSED_MANIFEST)
        if os.path.isfile(common):
            common = os.path.dirname(common)

        root_node = {
            "name": os.path.basename(common) or common,
            "type": "directory",
            "absolute_path": common,
            "children": {}
        }

        for path in PROCESSED_MANIFEST:
            rel = os.path.relpath(path, common)
            if rel == ".": continue
            parts = rel.split(os.sep)
            current = root_node

            for i, part in enumerate(parts):
                if i == len(parts) - 1:
                    fname, ext_dot = os.path.splitext(part)
                    current["children"][part] = {
                        "name": fname, "extension": ext_dot.lstrip('.'),
                        "type": "file", "absolute_path": path
                    }
                else:
                    if part not in current["children"]:
                        current["children"][part] = {
                            "name": part, "type": "directory",
                            "absolute_path": os.path.join(current["absolute_path"], part), "children": {}
                        }
                    current = current["children"][part]

        tree_path = os.path.join(DEST_DIR, f"export-{TIMESTAMP}-tree.json")
        with open(tree_path, "w", encoding="utf-8") as f:
            json.dump({"timestamp": TIMESTAMP, "root": root_node}, f, indent=4)

        log(f"Tree manifest generated: {tree_path}", emoji="🌲")
        return tree_path
    except Exception as e:
        log(f"Tree manifest safely bypassed: {str(e)}", emoji="⚠️")
        return None

def create_json_report(config_data, results_data):
    global DEST_DIR, TIMESTAMP
    report_path = os.path.join(DEST_DIR, f"export-{TIMESTAMP}-report.json")
    try:
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump({"timestamp": TIMESTAMP, "configuration": config_data, "results": results_data}, f, indent=4)
        log(f"JSON report generated: {report_path}", emoji="📝")
    except Exception as e:
        log(f"Failed to generate JSON report: {e}", emoji="❌")

# ─── Console Display Outputs ──────────────────────────────────────────────────

def show_help():
    samples = """
===================================================================================================
FILE EXPORTER SCRIPT - HELP & REFERENCE MANUAL (20 EXECUTION SAMPLES)
===================================================================================================

[SAMPLE 1] - Basic usage (Current directory to YAML):
  python3 files-exporter.py --src .

... (Samples truncated for readability) ...
"""
    log(samples, add_ts=False, force_console=True)

def print_configuration(inc_paths, exc_paths, inc_ext, exc_ext, mode="standard"):
    global OUTPUT_FORMAT, MAX_SIZE_BYTES, MAX_OUTPUT_SIZE_BYTES, GENERATE_LOG_CONSOLE, GENERATE_LOG_FILE, GROUP_BY_EXT, DIRS_TO_PARSE, DEST_DIR

    def format_list(val):
        if isinstance(val, str):
            return val.replace('\n', ', ')
        return ", ".join(val) if val else "(None)"

    config_msg = f"""
===================================================================================================
🚀 LAUNCHING PYTHON EXPORTER
===================================================================================================
⚙️  PARAMETERS:
  🚀 Mode          : {mode.upper()}
  📄 Format        : {OUTPUT_FORMAT.upper()}
  ⚖️  Max File Size : {MAX_SIZE_BYTES / 1024:.0f} KB
  📦 Max Chunk Size: {'Unlimited' if MAX_OUTPUT_SIZE_BYTES == 0 else f'{MAX_OUTPUT_SIZE_BYTES / 1024:.0f} KB'}
  📝 Log Console   : {'Yes' if GENERATE_LOG_CONSOLE else 'No'}
  📝 Log File      : {'Yes' if GENERATE_LOG_FILE else 'No'}
  🗂️  Group By Ext  : {'Yes' if GROUP_BY_EXT else 'No'}
  📁 Source Dirs   : {', '.join(DIRS_TO_PARSE)}
  💾 Dest Dir      : {DEST_DIR}
"""
    if mode == "paths-export":
        config_msg += "\n🔍 FILTERS:\n  ⚠️  ALL REGEX FILTERS BYPASSED (paths-export mode)\n"
    else:
        config_msg += f"\n🔍 FILTERS:\n  ✅ Include Paths : {format_list(inc_paths)}\n  ❌ Exclude Paths : {format_list(exc_paths)}\n  🟢 Include Exts  : {format_list(inc_ext)}\n  🔴 Exclude Exts  : {format_list(exc_ext)}\n"

    config_msg += "---------------------------------------------------------------------------------------------------"
    log(config_msg, add_ts=False, force_console=True)

def print_terminal_report(folders_count, ext_counts, size_rej_counts, bounds, exc_counts, chunks):
    global GENERATE_LOG_CONSOLE
    is_tty = GENERATE_LOG_CONSOLE
    cyan = "\033[96m" if is_tty else ""
    yellow = "\033[93m" if is_tty else ""
    red = "\033[91m" if is_tty else ""
    reset = "\033[0m" if is_tty else ""
    bold_yellow = "\033[1;93m" if is_tty else ""

    report_msg = f"\n{'='*99}\n📊 SCAN & EXPORT REPORT\n{'='*99}\n"
    report_msg += f"📁 Folders scanned: {folders_count}\n"
    report_msg += f"📚 Output files   : {chunks} chunk(s)\n\n📄 Files by Extension:\n"

    report_msg += f"{cyan}| {'Extension':<15} | {'Exported':<10} | {'Size Rejected':<35} | {'Excluded':<14} |{reset}\n"
    report_msg += f"|{'-'*17}|{'-'*12}|{'-'*37}|{'-'*16}|\n"

    all_exts = set(ext_counts.keys()) | set(size_rej_counts.keys()) | set(exc_counts.keys())
    sorted_exts = sorted(
        list(all_exts), key=lambda x: (ext_counts.get(x, 0), size_rej_counts.get(x, 0), exc_counts.get(x, 0)), reverse=True
    )

    for i, ext in enumerate(sorted_exts):
        e_cnt, r_cnt, x_cnt = ext_counts.get(ext, 0), size_rej_counts.get(ext, 0), exc_counts.get(ext, 0)
        e_str = f"{e_cnt}" if e_cnt > 0 else "-"
        x_str = f"{x_cnt}" if x_cnt > 0 else "-"
        rej_str = "-"

        if r_cnt > 0:
            rej_str = f"{r_cnt} (min: {format_size(bounds[ext]['min'])} / max: {format_size(bounds[ext]['max'])})"

        ext_display = (ext if ext else 'No Extension')[:15]
        c_rej = f"{yellow}{rej_str:<35}{reset}" if is_tty and r_cnt > 0 else f"{rej_str:<35}"
        c_exc = f"{red}{x_str:<14}{reset}" if is_tty and x_cnt > 0 else f"{x_str:<14}"

        if is_tty:
            if x_cnt > 0 and e_cnt == 0 and r_cnt == 0:
                report_msg += f"{red}| {ext_display:<15} | {e_str:<10} | {rej_str:<35} | {x_str:<14} |{reset}\n"
            elif r_cnt > 0 and e_cnt == 0 and x_cnt == 0:
                report_msg += f"{yellow}| {ext_display:<15} | {e_str:<10} | {rej_str:<35} | {x_str:<14} |{reset}\n"
            else:
                report_msg += f"| {ext_display:<15} | {e_str:<10} | {c_rej} | {c_exc} |\n"
        else:
            report_msg += f"| {ext_display:<15} | {e_str:<10} | {rej_str:<35} | {x_str:<14} |\n"

    report_msg += f"|{'-'*17}|{'-'*12}|{'-'*37}|{'-'*16}|\n"
    tot_e, tot_r, tot_x = sum(ext_counts.values()), sum(size_rej_counts.values()), sum(exc_counts.values())

    t_e_val = f"{tot_e if tot_e else '-'}"
    t_r_val = f"{tot_r if tot_r else '-'}"
    t_x_val = f"{tot_x if tot_x else '-'}"

    c_t_r = f"{yellow}{t_r_val:<35}{reset}" if is_tty and tot_r > 0 else f"{t_r_val:<35}"
    c_t_x = f"{red}{t_x_val:<14}{reset}" if is_tty and tot_x > 0 else f"{t_x_val:<14}"

    report_msg += f"| {bold_yellow}{'Total':<15}{reset} | {t_e_val:<10} | {c_t_r} | {c_t_x} |\n"
    report_msg += f"{'='*99}\n"
    log(report_msg, add_ts=False, force_console=True)

# ─── Command Line Arguments Parsing ───────────────────────────────────────────

def parse_arguments():
    parser = argparse.ArgumentParser(description="CLI tool for exporting files.")
    parser.add_argument("--mode", choices=["standard", "filter-check", "paths-export"], default="standard", help="Execution mode.")
    parser.add_argument("--paths-to-check", nargs="+", default=[], help="Paths to test in filter-check mode.")
    parser.add_argument("--src", nargs="+", default=HARDCODED_DEFAULTS['src'])
    parser.add_argument("--dest", default=HARDCODED_DEFAULTS['dest'])
    parser.add_argument("--format", default=HARDCODED_DEFAULTS['format'])
    parser.add_argument("--max-file", type=float, default=HARDCODED_DEFAULTS['max_file'])
    parser.add_argument("--max-chunk", type=float, default=HARDCODED_DEFAULTS['max_chunk'])
    parser.add_argument("--inc-paths", default=HARDCODED_DEFAULTS['inc_paths'])
    parser.add_argument("--exc-paths", default=HARDCODED_DEFAULTS['exc_paths'])
    parser.add_argument("--inc-ext", default=HARDCODED_DEFAULTS['inc_ext'])
    parser.add_argument("--exc-ext", default=HARDCODED_DEFAULTS['exc_ext'])
    parser.add_argument("--group-ext", action="store_true", default=HARDCODED_DEFAULTS['group_ext'])
    parser.add_argument("--log-console", action="store_true", default=HARDCODED_DEFAULTS['log_console'])
    parser.add_argument("--log-file", action="store_true", default=HARDCODED_DEFAULTS['log_file'])
    parser.add_argument("--tree-view", action="store_true", default=False)
    parser.add_argument("--show-help", action="store_true", help="Show detailed help with samples")

    return parser.parse_args()

# ─── Execution Modes ──────────────────────────────────────────────────────────

def execute_filter_check(paths_to_check, filters):
    if not paths_to_check:
        print("No paths provided to check. Supply --paths-to-check.", file=sys.stderr)
        sys.exit(2)

    all_match = True
    for path in paths_to_check:
        filename = os.path.basename(path)
        rel_filepath = path.replace("\\", "/")

        is_allowed = is_file_allowed(rel_filepath, filename, filters)
        status = "MATCH" if is_allowed else "REJECTED"
        print(f"[{status}] -> {path}")

        if not is_allowed:
            all_match = False

    sys.exit(0 if all_match else 1)


def execute_standard_export(filters):
    log(f"\nStarting export (Format: {OUTPUT_FORMAT.upper()})", emoji="🚀")

    scanner = FileScanner(filters)
    scanner.run_scan()
    folders_cnt, ext_cnts, rej_cnts, g_bnd, exc_cnts, chunks = scanner.finalize()

    print_terminal_report(folders_cnt, ext_cnts, rej_cnts, g_bnd, exc_cnts, chunks)

    tree_path = create_tree_manifest() if GENERATE_TREE_VIEW else None

    config_data = {
        "source_dirs": DIRS_TO_PARSE,
        "dest_dir": DEST_DIR,
        "format": OUTPUT_FORMAT,
        "max_file_size_kb": MAX_SIZE_BYTES / 1024,
        "max_output_size_kb": MAX_OUTPUT_SIZE_BYTES / 1024,
        "generate_log_console": GENERATE_LOG_CONSOLE,
        "generate_log_file": GENERATE_LOG_FILE,
        "group_export_by_file_extension": GROUP_BY_EXT,
        "generate_tree_view": GENERATE_TREE_VIEW,
        "filters": {
            "inc_paths": [p.pattern for p in filters['inc_paths']],
            "exc_paths": [p.pattern for p in filters['exc_paths']],
            "inc_ext": [p.pattern for p in filters['inc_ext']],
            "exclude_ext": [p.pattern for p in filters['exc_ext']],
        },
    }

    results_data = {
        "summary": {
            "folders_scanned": folders_cnt,
            "chunks_generated": chunks,
            "total_exported": sum(ext_cnts.values()),
            "total_size_rejected": sum(rej_cnts.values()),
            "total_regex_excluded": sum(exc_cnts.values()),
        },
        "metrics_per_extension": {
            ext: {
                "exported": ext_cnts.get(ext, 0),
                "size_rejected": {
                    "count": rej_cnts.get(ext, 0),
                    "min": format_size(g_bnd[ext]['min']) if rej_cnts.get(ext, 0) > 0 else "0KB",
                    "max": format_size(g_bnd[ext]['max']) if rej_cnts.get(ext, 0) > 0 else "0KB",
                },
                "regex_excluded": exc_cnts.get(ext, 0),
            }
            for ext in (set(ext_cnts.keys()) | set(rej_cnts.keys()) | set(exc_cnts.keys()))
        },
        "generated_files": GENERATED_FILES,
    }

    if tree_path:
        try:
            with open(tree_path, "r", encoding="utf-8") as f:
                results_data["tree_manifest"] = json.load(f)
        except Exception:
            pass

    create_json_report(config_data, results_data)
    log("Export complete!", emoji="✅")
    log(f"Generated {chunks} file(s) in {DEST_DIR}", emoji="🎉")
    print(TIMESTAMP)


def main():
    global HARDCODED_DEFAULTS, DIRS_TO_PARSE, DEST_DIR, OUTPUT_FORMAT, MAX_SIZE_BYTES
    global MAX_OUTPUT_SIZE_BYTES, GROUP_BY_EXT, GENERATE_LOG_CONSOLE, GENERATE_LOG_FILE
    global GENERATE_TREE_VIEW, TIMESTAMP, LOG_FILE_HANDLE

    args = parse_arguments()

    if args.show_help:
        show_help()
        return

    # 1. ─── Compile Filters Early ───
    filters = {
        'inc_paths': compile_regexes("INCLUDE_PATHS", args.inc_paths),
        'exc_paths': compile_regexes("EXCLUDE_PATHS", args.exc_paths),
        'inc_ext': compile_regexes("INCLUDE_FILE_EXTENSIONS", args.inc_ext),
        'exc_ext': compile_regexes("EXCLUDE_FILE_EXTENSIONS", args.exc_ext),
    }

    # 2. ─── Intercept Filter Check Mode Immediately ───
    if args.mode == "filter-check":
        try:
            execute_filter_check(args.paths_to_check, filters)
        except Exception as e:
            print(f"Treatment error during filter check: {e}", file=sys.stderr)
            sys.exit(2)
        return # Exit immediately! No folders are created.

    # 3. ─── Process Core Variables (Only for Real Exports) ───
    split_srcs = []
    for src_item in args.src:
        if src_item:
            for path_part in re.split(r'[\n,;]', src_item):
                cleaned_part = path_part.strip().strip("'\"").strip()
                if cleaned_part:
                    split_srcs.append(cleaned_part)

    DIRS_TO_PARSE = [os.path.abspath(os.path.expanduser(d)) for d in split_srcs if d]
    DEST_DIR = os.path.abspath(os.path.expanduser(args.dest))

    # Safe to create directories now
    os.makedirs(DEST_DIR, exist_ok=True)

    OUTPUT_FORMAT = args.format.lower()
    MAX_SIZE_BYTES = args.max_file * 1024
    MAX_OUTPUT_SIZE_BYTES = args.max_chunk * 1024
    GROUP_BY_EXT = args.group_ext
    GENERATE_LOG_CONSOLE = args.log_console
    GENERATE_LOG_FILE = args.log_file
    GENERATE_TREE_VIEW = args.tree_view

    TIMESTAMP = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    LOG_FILE_PATH = os.path.join(DEST_DIR, f"export-{TIMESTAMP}.log")
    LOG_FILE_HANDLE = open(LOG_FILE_PATH, 'w', encoding='utf-8') if GENERATE_LOG_FILE else None

    # 4. ─── Dispatch Standard Export Modes ───
    if args.mode == "paths-export":
        print_configuration(args.inc_paths, args.exc_paths, args.inc_ext, args.exc_ext, mode=args.mode)

        # Inject empty filters to bypass all regex logic while preserving size limits
        empty_filters = {
            'inc_paths': [],
            'exc_paths': [],
            'inc_ext': [],
            'exc_ext': []
        }
        execute_standard_export(empty_filters)

    else:
        print_configuration(args.inc_paths, args.exc_paths, args.inc_ext, args.exc_ext, mode=args.mode)
        execute_standard_export(filters)


if __name__ == "__main__":
    try:
        main()
    finally:
        if LOG_FILE_HANDLE:
            LOG_FILE_HANDLE.close()
