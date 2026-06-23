#!/usr/bin/env python3
import sys
import os
import re
import json

def log_debug(msg):
    print(f"[Python Engine Debug] {msg}", file=sys.stderr)

def find_file_by_suffix(suffix, search_root):
    normalized_suffix = suffix.replace('\\', '/').lower().lstrip('/')
    matches = []
    for root, dirs, files in os.walk(search_root):
        if any(p in root for p in ['node_modules', '.git', 'target', 'dist', 'out', 'build', '.history']):
            continue
        for f in files:
            full_path = os.path.abspath(os.path.join(root, f))
            norm_path = full_path.replace('\\', '/').lower()
            if norm_path.endswith(normalized_suffix):
                matches.append(full_path)
    return matches

def extract_clean_filenames(content, target_extensions):
    found_files = set()
    ext_pattern = "|".join(target_extensions)
    pattern = rf'([\w\.-]+\.(?:{ext_pattern}))'

    for line in content.splitlines():
        matches = re.findall(pattern, line)
        for m in matches:
            clean_name = m.strip('() :-,;@')
            base = os.path.basename(clean_name)
            if base:
                found_files.add(base)
    return found_files

def main():
    if len(sys.argv) < 4:
        print(json.dumps([]))
        return
    stack_type = sys.argv[1].lower()
    workspace_root = os.path.abspath(sys.argv[2])
    content_file = sys.argv[3]
    include_out_workspace = sys.argv[4] == 'true' if len(sys.argv) > 4 else False

    log_debug(f"Initializing log parsing engine for target profile: '{stack_type}'")
    log_debug(f"Workspace Root context path: {workspace_root}")
    log_debug(f"Include out workspace files option active: {include_out_workspace}")

    if not os.path.exists(content_file):
        log_debug(f"CRITICAL: Staging transit file missing: {content_file}")
        print(json.dumps([]))
        return

    with open(content_file, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    log_debug(f"Ingested stack trace content segment size: {len(content)} characters.")

    extracted_candidates = set()
    lines = content.splitlines()

    if stack_type == 'java':
        for line in lines:
            match = re.search(r'at\s+([a-zA-Z0-9_\.]+)\.([a-zA-Z0-9_]+)\(([a-zA-Z0-9_\-]+\.java):\d+\)', line)
            if match:
                package_parts = match.group(1).split('.')
                if len(package_parts) > 0:
                    rel_path = "/".join(package_parts) + "/" + match.group(3)
                    extracted_candidates.add(rel_path)
                extracted_candidates.add(match.group(3))
            else:
                for m in re.findall(r'([\w\.-]+\.java)', line):
                    extracted_candidates.add(m)

    elif stack_type in ['browser console', 'browser-console']:
        for line in lines:
            unix_paths = re.findall(r'(?:/[a-zA-Z0-9_\.-]+)+\.(?:js|ts|jsx|tsx|html|css)', line)
            for p in unix_paths:
                extracted_candidates.add(p)
            win_paths = re.findall(r'[a-zA-Z]:\\([^:\s]+\.(?:js|ts|jsx|tsx|html|css))', line)
            for p in win_paths:
                extracted_candidates.add(p)
            urls = re.findall(r'https?://[^/\s]+/([^?\s:]+\.(?:js|ts|jsx|tsx|html|css))', line)
            for u in urls:
                extracted_candidates.add(u)
            fallbacks = re.findall(r'([\w\.-]+\.(?:js|ts|jsx|tsx|html|css))', line)
            for f in fallbacks:
                extracted_candidates.add(f)

    elif stack_type == 'python':
        for line in lines:
            py_traces = re.findall(r'File\s+"([^"]+\.py)"', line)
            for t in py_traces:
                extracted_candidates.add(t)
            fallbacks = re.findall(r'([\w\.-]+\.py)', line)
            for f in fallbacks:
                extracted_candidates.add(f)

    log_debug(f"Step 1 completed. Found raw logs candidates: {list(extracted_candidates)}")

    final_verified_paths = set()
    for c in extracted_candidates:
        if os.path.isabs(c):
            if os.path.exists(c):
                if include_out_workspace:
                    final_verified_paths.add(c)
                else:
                    if c.lower().startswith(workspace_root.lower()):
                        final_verified_paths.add(c)
                    else:
                        log_debug(f"Absolute path outside workspace ignored (include_out_workspace is False): '{c}'")
            else:
                log_debug(f"Invalid absolute path (does not exist on system layout): '{c}'")
        else:
            workspace_matches = find_file_by_suffix(c, workspace_root)
            if workspace_matches:
                for wm in workspace_matches:
                    final_verified_paths.add(wm)
            else:
                log_debug(f"Relative file or suffix path not found within workspace layout: '{c}' (Skipped non-absolute path out-of-workspace sweep search rules)")

    log_debug(f"Step 2 completed. Effective resolved paths matrix: {list(final_verified_paths)}")
    print(json.dumps(list(final_verified_paths)))

if __name__ == '__main__':
    main()
