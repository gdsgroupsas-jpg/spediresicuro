from __future__ import annotations

import ast
import os
import re
import subprocess
from typing import Any, Dict, List


class PythonTools:
    def ast_outline(self, path: str) -> Dict[str, Any]:
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                src = f.read()
            tree = ast.parse(src)
            items: List[Dict[str, Any]] = []
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    entry = {
                        "type": node.__class__.__name__,
                        "name": getattr(node, "name", ""),
                        "lineno": getattr(node, "lineno", None),
                        "end_lineno": getattr(node, "end_lineno", None),
                    }
                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        args = [a.arg for a in node.args.args]
                        entry["args"] = args
                    items.append(entry)
            items.sort(key=lambda x: (x.get("lineno") or 0, x.get("name") or ""))
            return {"ok": True, "path": path, "items": items}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def ast_imports(self, path: str) -> Dict[str, Any]:
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                src = f.read()
            tree = ast.parse(src)
            imports: List[str] = []
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for n in node.names:
                        imports.append(n.name)
                elif isinstance(node, ast.ImportFrom):
                    mod = node.module or ""
                    imports.append(mod)
            return {"ok": True, "path": path, "imports": sorted(set(imports))}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def ast_find_symbol(self, path: str, name: str = "", symbol_type: str = "") -> Dict[str, Any]:
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                src = f.read()
            tree = ast.parse(src)
            matches: List[Dict[str, Any]] = []
            type_map = {
                "class": "classdef",
                "classdef": "classdef",
                "function": "functiondef",
                "functiondef": "functiondef",
                "asyncfunction": "asyncfunctiondef",
                "asyncfunctiondef": "asyncfunctiondef",
            }
            normalized_type = type_map.get(symbol_type.lower(), symbol_type.lower()) if symbol_type else ""
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    if name and getattr(node, "name", None) != name:
                        continue
                    if normalized_type and node.__class__.__name__.lower() != normalized_type:
                        continue
                    matches.append(
                        {
                            "type": node.__class__.__name__,
                            "name": node.name,
                            "lineno": getattr(node, "lineno", None),
                            "end_lineno": getattr(node, "end_lineno", None),
                        }
                    )
            return {"ok": True, "path": path, "name": name, "matches": matches}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def project_deps(self, root: str) -> Dict[str, Any]:
        try:
            result: Dict[str, Any] = {"ok": True, "root": root, "requirements": [], "pyproject": []}
            req_path = os.path.join(root, "requirements.txt")
            if os.path.exists(req_path):
                with open(req_path, "r", encoding="utf-8", errors="ignore") as f:
                    reqs = [line.strip() for line in f if line.strip() and not line.strip().startswith("#")]
                result["requirements"] = reqs

            py_path = os.path.join(root, "pyproject.toml")
            if os.path.exists(py_path):
                with open(py_path, "r", encoding="utf-8", errors="ignore") as f:
                    data = f.read()
                deps = []
                # [project] dependencies
                proj = re.findall(r"^dependencies\\s*=\\s*\\[(.*?)\\]", data, flags=re.S | re.M)
                for block in proj:
                    for line in block.splitlines():
                        s = line.strip().strip("\"").strip("'")
                        if s:
                            deps.append(s)
                # [tool.poetry.dependencies]
                poetry = re.findall(r"^\\[tool\\.poetry\\.dependencies\\](.*?)(^\\[|\\Z)", data, flags=re.S | re.M)
                for block, _ in poetry:
                    for line in block.splitlines():
                        line = line.strip()
                        if not line or line.startswith("#"):
                            continue
                        if "=" in line:
                            name = line.split("=", 1)[0].strip()
                            if name != "python":
                                deps.append(name)
                result["pyproject"] = sorted(set(deps))

            return result
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def project_deps_toml(self, root: str) -> Dict[str, Any]:
        try:
            try:
                import tomllib  # py3.11+
            except Exception:
                tomllib = None
            if tomllib is None:
                return {"ok": False, "error": "tomllib non disponibile"}

            py_path = os.path.join(root, "pyproject.toml")
            if not os.path.exists(py_path):
                return {"ok": True, "root": root, "dependencies": [], "optional": {}, "tool_poetry": {}}

            with open(py_path, "rb") as f:
                data = tomllib.load(f)

            deps: List[str] = []
            optional: Dict[str, List[str]] = {}
            tool_poetry: Dict[str, Any] = {}

            project = data.get("project") or {}
            deps.extend(project.get("dependencies") or [])
            opt = project.get("optional-dependencies") or {}
            for k, v in opt.items():
                optional[k] = v

            poetry = data.get("tool", {}).get("poetry", {})
            if poetry:
                tool_poetry = poetry.get("dependencies", {})
                if "python" in tool_poetry:
                    tool_poetry.pop("python", None)

            return {
                "ok": True,
                "root": root,
                "dependencies": deps,
                "optional": optional,
                "tool_poetry": tool_poetry,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def python_exec(self, code: str, timeout_sec: int = 120, path: str = "", paths: List[str] = None) -> Dict[str, Any]:
        try:
            # Support both single path (backward compat) and multiple paths
            file_paths: List[str] = []
            if paths and isinstance(paths, list):
                file_paths = [p for p in paths if p and isinstance(p, str)]
            elif path:
                file_paths = [path]

            # python_exec non deve essere eseguito su file .json (solo moduli Python)
            for p in file_paths:
                if (p or "").lower().endswith(".json"):
                    return {
                        "ok": False,
                        "returncode": 1,
                        "stdout": "",
                        "stderr": "python_exec cannot be run on .json files; use read_file or a .py script instead.",
                        "error": "python_exec cannot be run on .json files",
                    }

            # Build prefix to load all modules
            prefix = ''
            if file_paths:
                prefix = 'import importlib.util\n'
                for idx, file_path in enumerate(file_paths):
                    mod_name = f"_mod_{idx}"
                    prefix += (
                        f'_p_{idx} = r"{file_path}"\n'
                        f'spec_{idx} = importlib.util.spec_from_file_location("{mod_name}", _p_{idx})\n'
                        f'{mod_name} = importlib.util.module_from_spec(spec_{idx})\n'
                        f'assert spec_{idx} and spec_{idx}.loader\n'
                        f'spec_{idx}.loader.exec_module({mod_name})\n'
                        f'globals().update({mod_name}.__dict__)\n'
                    )

            proc = subprocess.run(
                ["py", "-"],
                input=(prefix + code) if file_paths else code,
                text=True,
                encoding="utf-8",
                errors="replace",
                capture_output=True,
                timeout=timeout_sec,
            )
            return {
                "ok": proc.returncode == 0,
                "returncode": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def python_run_file(self, path: str, timeout_sec: int = 120) -> Dict[str, Any]:
        if not (path or "").strip().lower().endswith(".py"):
            return {
                "ok": False,
                "returncode": -1,
                "stdout": "",
                "stderr": "python_run_file accepts only .py files. Do not pass .json, .yaml, .env or other non-Python files.",
            }
        try:
            proc = subprocess.run(
                ["py", path],
                text=True,
                encoding="utf-8",
                errors="replace",
                capture_output=True,
                timeout=timeout_sec,
            )
            return {
                "ok": proc.returncode == 0,
                "returncode": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def pip_list(self) -> Dict[str, Any]:
        try:
            proc = subprocess.run(
                ["py", "-m", "pip", "list"],
                text=True,
                encoding="utf-8",
                errors="replace",
                capture_output=True,
                timeout=120,
            )
            return {
                "ok": proc.returncode == 0,
                "returncode": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def pip_install(self, package: str) -> Dict[str, Any]:
        try:
            proc = subprocess.run(
                ["py", "-m", "pip", "install", package],
                text=True,
                encoding="utf-8",
                errors="replace",
                capture_output=True,
                timeout=600,
            )
            return {
                "ok": proc.returncode == 0,
                "returncode": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def pytest_run(self, args: str = "", cwd: str | None = None) -> Dict[str, Any]:
        cmd = ["py", "-m", "pytest"]
        if args:
            cmd.extend(args.split(" "))
        try:
            proc = subprocess.run(
                cmd,
                cwd=cwd,
                text=True,
                encoding="utf-8",
                errors="replace",
                capture_output=True,
                timeout=600,
            )
            return {
                "ok": proc.returncode == 0,
                "returncode": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def ruff_format(self, path: str, timeout_sec: int = 60) -> Dict[str, Any]:
        """Esegue ruff format sul path. Formattazione automatica lato orchestratore."""
        try:
            proc = subprocess.run(
                ["py", "-m", "ruff", "format", path],
                text=True,
                encoding="utf-8",
                errors="replace",
                capture_output=True,
                timeout=timeout_sec,
            )
            return {
                "ok": proc.returncode == 0,
                "returncode": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def ruff_check(self, args: str = "", timeout_sec: int = 600) -> Dict[str, Any]:
        cmd = ["py", "-m", "ruff", "check"]
        if args:
            cmd.extend(args.split(" "))
        try:
            proc = subprocess.run(
                cmd,
                text=True,
                encoding="utf-8",
                errors="replace",
                capture_output=True,
                timeout=timeout_sec,
            )
            return {
                "ok": proc.returncode == 0,
                "returncode": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def mypy_check(self, args: str = "", timeout_sec: int = 600) -> Dict[str, Any]:
        cmd = ["py", "-m", "mypy"]
        if args:
            cmd.extend(args.split(" "))
        try:
            proc = subprocess.run(
                cmd,
                text=True,
                encoding="utf-8",
                errors="replace",
                capture_output=True,
                timeout=timeout_sec,
            )
            return {
                "ok": proc.returncode == 0,
                "returncode": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}
