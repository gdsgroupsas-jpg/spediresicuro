from __future__ import annotations

import ast
import json
import os
import sys
import time
from typing import Any, Dict, List


EXCLUDE_DIRS = {".git", ".index", "__pycache__", ".venv", "venv"}


def iter_files(root: str) -> List[str]:
    paths: List[str] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for name in filenames:
            if name.endswith(".pyc"):
                continue
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, root)
            paths.append(rel.replace("\\", "/"))
    return sorted(paths)


def scan_python_file(path: str) -> Dict[str, Any]:
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            src = f.read()
        tree = ast.parse(src)
        classes: List[str] = []
        functions: List[str] = []
        globals_: List[str] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                classes.append(node.name)
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                functions.append(node.name)
            elif isinstance(node, ast.Assign):
                if isinstance(node.targets, list):
                    for t in node.targets:
                        if isinstance(t, ast.Name):
                            globals_.append(t.id)
        return {
            "classes": sorted(set(classes)),
            "functions": sorted(set(functions)),
            "globals": sorted(set(globals_)),
        }
    except Exception:
        return {"classes": [], "functions": [], "globals": []}


def build_index(root: str) -> Dict[str, Any]:
    files = iter_files(root)
    py_symbols: List[Dict[str, Any]] = []
    for rel in files:
        if rel.endswith(".py"):
            abs_path = os.path.join(root, rel)
            symbols = scan_python_file(abs_path)
            if symbols["classes"] or symbols["functions"] or symbols["globals"]:
                py_symbols.append({"path": rel, **symbols})
    return {
        "timestamp": time.time(),
        "root": os.path.abspath(root),
        "files": files,
        "py_symbols": py_symbols,
        "truncated": False,
    }


def main() -> int:
    if len(sys.argv) < 3:
        return 1
    root = sys.argv[1]
    out_path = sys.argv[2]
    data = build_index(root)
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
