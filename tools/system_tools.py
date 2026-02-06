from __future__ import annotations

import os
import re
import glob
import json
import shutil
import hashlib
import difflib
import subprocess
from typing import Any, Dict, List


class SystemTools:
    def __init__(self, base_dir: str | None = None, allow_any: bool = True) -> None:
        self._base_dir = os.path.abspath(base_dir) if base_dir else None
        self._allow_any = allow_any

    def set_base_dir(self, base_dir: str) -> None:
        self._base_dir = os.path.abspath(base_dir)

    def set_allow_any(self, allow_any: bool) -> None:
        self._allow_any = allow_any

    def _validate_path(self, path: str) -> str | None:
        if self._allow_any:
            return None
        if not path:
            return "Percorso vuoto"
        abs_path = os.path.abspath(path)
        if not self._base_dir:
            return None
        try:
            common = os.path.commonpath([abs_path, self._base_dir])
        except ValueError:
            return "Percorso non valido"
        if common != self._base_dir:
            return f"Accesso negato fuori da base_dir: {self._base_dir}"
        return None

    def list_dir(self, path: str) -> Dict[str, Any]:
        err = self._validate_path(path)
        if err:
            return {"ok": False, "error": err}
        try:
            entries = []
            for name in os.listdir(path):
                full = os.path.join(path, name)
                entries.append({"name": name, "is_dir": os.path.isdir(full)})
            return {"ok": True, "path": path, "entries": entries}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def count_dir(self, path: str) -> Dict[str, Any]:
        err = self._validate_path(path)
        if err:
            return {"ok": False, "error": err}
        try:
            files = 0
            dirs = 0
            for name in os.listdir(path):
                full = os.path.join(path, name)
                if os.path.isdir(full):
                    dirs += 1
                else:
                    files += 1
            return {"ok": True, "path": path, "files": files, "dirs": dirs, "total": files + dirs}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def read_file(self, path: str) -> Dict[str, Any]:
        err = self._validate_path(path)
        if err:
            return {"ok": False, "error": err}
        try:
            with open(path, "r", encoding="utf-8") as f:
                return {"ok": True, "path": path, "content": f.read()}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def read_file_lines(self, path: str, start_line: int, end_line: int) -> Dict[str, Any]:
        err = self._validate_path(path)
        if err:
            return {"ok": False, "error": err}
        try:
            if start_line < 1 or end_line < start_line:
                return {"ok": False, "error": "Intervallo linee non valido"}
            lines: List[str] = []
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                for i, line in enumerate(f, start=1):
                    if i < start_line:
                        continue
                    if i > end_line:
                        break
                    lines.append(line.rstrip("\n"))
            return {"ok": True, "path": path, "start_line": start_line, "end_line": end_line, "lines": lines}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def write_file(self, path: str, content: str) -> Dict[str, Any]:
        err = self._validate_path(path)
        if err:
            return {"ok": False, "error": err}
        try:
            os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            return {"ok": True, "path": path, "bytes": len(content.encode("utf-8"))}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def replace_text(self, path: str, old: str, new: str, count: int = -1, regex: bool = False) -> Dict[str, Any]:
        err = self._validate_path(path)
        if err:
            return {"ok": False, "error": err}
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                data = f.read()
            if regex:
                rx = re.compile(old)
                updated, n = rx.subn(new, data, count=count if count > 0 else 0)
            else:
                if count is None or count < 0:
                    updated = data.replace(old, new)
                    n = data.count(old)
                else:
                    updated = data.replace(old, new, count)
                    n = count
            with open(path, "w", encoding="utf-8") as f:
                f.write(updated)
            return {"ok": True, "path": path, "replacements": n}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def replace_in_repo(
        self,
        root: str,
        old: str,
        new: str,
        max_files: int = 200,
        regex: bool = False,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        err = self._validate_path(root)
        if err:
            return {"ok": False, "error": err}
        try:
            rx = re.compile(old) if regex else None
            changed = []
            files_touched = 0
            for dirpath, _, filenames in os.walk(root):
                for fname in filenames:
                    path = os.path.join(dirpath, fname)
                    try:
                        with open(path, "r", encoding="utf-8", errors="ignore") as f:
                            data = f.read()
                    except Exception:
                        continue
                    if regex:
                        updated, n = rx.subn(new, data)
                    else:
                        n = data.count(old)
                        updated = data.replace(old, new)
                    if n > 0:
                        files_touched += 1
                        changed.append({"path": path, "replacements": n})
                        if not dry_run:
                            with open(path, "w", encoding="utf-8") as f:
                                f.write(updated)
                        if files_touched >= max_files:
                            return {
                                "ok": True,
                                "root": root,
                                "dry_run": dry_run,
                                "files_touched": files_touched,
                                "changed": changed,
                                "truncated": True,
                            }
            return {
                "ok": True,
                "root": root,
                "dry_run": dry_run,
                "files_touched": files_touched,
                "changed": changed,
                "truncated": False,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def insert_text(self, path: str, line_no: int, text: str, position: str = "before") -> Dict[str, Any]:
        err = self._validate_path(path)
        if err:
            return {"ok": False, "error": err}
        try:
            if line_no < 1:
                return {"ok": False, "error": "line_no deve essere >= 1"}
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
            idx = min(line_no - 1, len(lines))
            if position == "after":
                idx = min(idx + 1, len(lines))
            # Normalize indentation to match target line if possible
            indent = ""
            if lines:
                target_idx = min(line_no - 1, len(lines) - 1)
                target_line = lines[target_idx]
                indent = target_line[: len(target_line) - len(target_line.lstrip(" "))]
            insert_lines = text.splitlines(keepends=False)
            if insert_lines:
                insert_lines = [indent + ln if ln.strip() else ln for ln in insert_lines]
            insert_lines = [ln + "\n" for ln in insert_lines]
            if not insert_lines:
                insert_lines = [""]
            lines[idx:idx] = insert_lines
            with open(path, "w", encoding="utf-8") as f:
                f.writelines(lines)
            return {"ok": True, "path": path, "line_no": line_no, "position": position}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def append_file(self, path: str, content: str) -> Dict[str, Any]:
        err = self._validate_path(path)
        if err:
            return {"ok": False, "error": err}
        try:
            os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
            with open(path, "a", encoding="utf-8") as f:
                f.write(content)
            return {"ok": True, "path": path, "bytes": len(content.encode("utf-8"))}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def delete_path(self, path: str, recursive: bool = False) -> Dict[str, Any]:
        err = self._validate_path(path)
        if err:
            return {"ok": False, "error": err}
        try:
            if os.path.isdir(path) and recursive:
                shutil.rmtree(path)
            else:
                os.remove(path)
            return {"ok": True, "path": path}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def move_path(self, src: str, dest: str) -> Dict[str, Any]:
        err = self._validate_path(src)
        if err:
            return {"ok": False, "error": err}
        err = self._validate_path(dest)
        if err:
            return {"ok": False, "error": err}
        try:
            os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
            shutil.move(src, dest)
            return {"ok": True, "src": src, "dest": dest}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def copy_path(self, src: str, dest: str) -> Dict[str, Any]:
        err = self._validate_path(src)
        if err:
            return {"ok": False, "error": err}
        err = self._validate_path(dest)
        if err:
            return {"ok": False, "error": err}
        try:
            os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
            if os.path.isdir(src):
                shutil.copytree(src, dest, dirs_exist_ok=True)
            else:
                shutil.copy2(src, dest)
            return {"ok": True, "src": src, "dest": dest}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def mkdir(self, path: str, parents: bool = True) -> Dict[str, Any]:
        err = self._validate_path(path)
        if err:
            return {"ok": False, "error": err}
        try:
            os.makedirs(path, exist_ok=parents)
            return {"ok": True, "path": path}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def search_text(self, path: str, pattern: str, max_results: int = 20) -> Dict[str, Any]:
        err = self._validate_path(path)
        if err:
            return {"ok": False, "error": err}
        results: List[Dict[str, Any]] = []
        try:
            rx = re.compile(pattern)
            for root, _, files in os.walk(path):
                for file in files:
                    full = os.path.join(root, file)
                    try:
                        with open(full, "r", encoding="utf-8", errors="ignore") as f:
                            for i, line in enumerate(f, start=1):
                                if rx.search(line):
                                    results.append({"file": full, "line": i, "text": line.strip()})
                                    if len(results) >= max_results:
                                        return {"ok": True, "results": results}
                    except Exception:
                        continue
            return {"ok": True, "results": results}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def stat_path(self, path: str) -> Dict[str, Any]:
        err = self._validate_path(path)
        if err:
            return {"ok": False, "error": err}
        try:
            info = os.stat(path)
            return {
                "ok": True,
                "path": path,
                "size": info.st_size,
                "mtime": info.st_mtime,
                "is_dir": os.path.isdir(path),
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def file_hash(self, path: str, algo: str = "sha256") -> Dict[str, Any]:
        err = self._validate_path(path)
        if err:
            return {"ok": False, "error": err}
        try:
            h = hashlib.new(algo)
            with open(path, "rb") as f:
                for chunk in iter(lambda: f.read(8192), b""):
                    h.update(chunk)
            return {"ok": True, "path": path, "algo": algo, "hash": h.hexdigest()}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def preview_write(self, path: str, content: str) -> Dict[str, Any]:
        err = self._validate_path(path)
        if err:
            return {"ok": False, "error": err}
        try:
            old = ""
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    old = f.read()
            old_lines = old.splitlines()
            new_lines = content.splitlines()
            diff = "\n".join(
                difflib.unified_diff(
                    old_lines,
                    new_lines,
                    fromfile=path,
                    tofile=path,
                    lineterm="",
                )
            )
            old_hash = hashlib.sha256(old.encode("utf-8")).hexdigest()
            new_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
            return {
                "ok": True,
                "path": path,
                "diff": diff,
                "old_hash": old_hash,
                "new_hash": new_hash,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def apply_write_preview(self, path: str, content: str, expected_old_hash: str) -> Dict[str, Any]:
        err = self._validate_path(path)
        if err:
            return {"ok": False, "error": err}
        try:
            old = ""
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    old = f.read()
            old_hash = hashlib.sha256(old.encode("utf-8")).hexdigest()
            if expected_old_hash and old_hash != expected_old_hash:
                return {
                    "ok": False,
                    "error": "Hash di base non corrisponde. Il file e' cambiato.",
                    "current_hash": old_hash,
                }
            os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            return {"ok": True, "path": path, "bytes": len(content.encode("utf-8"))}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def safe_write(self, path: str, content: str, dry_run: bool = False) -> Dict[str, Any]:
        err = self._validate_path(path)
        if err:
            return {"ok": False, "error": err}
        try:
            old = ""
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    old = f.read()
            old_lines = old.splitlines()
            new_lines = content.splitlines()
            diff = "\n".join(
                difflib.unified_diff(
                    old_lines,
                    new_lines,
                    fromfile=path,
                    tofile=path,
                    lineterm="",
                )
            )
            old_hash = hashlib.sha256(old.encode("utf-8")).hexdigest()
            new_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
            if dry_run:
                return {
                    "ok": True,
                    "path": path,
                    "dry_run": True,
                    "diff": diff,
                    "old_hash": old_hash,
                    "new_hash": new_hash,
                }
            os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            return {
                "ok": True,
                "path": path,
                "dry_run": False,
                "diff": diff,
                "old_hash": old_hash,
                "new_hash": new_hash,
                "bytes": len(content.encode("utf-8")),
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def apply_patch_unified(self, diff: str) -> Dict[str, Any]:
        try:
            import tempfile
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as f:
                f.write(diff)
                diff_path = f.name
            proc = subprocess.run(
                ["git", "apply", "--whitespace=nowarn", "--ignore-space-change", "--ignore-whitespace", diff_path],
                capture_output=True,
                text=True,
                timeout=120,
            )
            ok = proc.returncode == 0
            return {
                "ok": ok,
                "returncode": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def glob_paths(self, pattern: str, recursive: bool = True) -> Dict[str, Any]:
        try:
            paths = glob.glob(pattern, recursive=recursive)
            return {"ok": True, "pattern": pattern, "paths": paths}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def run_command(self, command: str, cwd: str | None = None, timeout_sec: int = 120) -> Dict[str, Any]:
        try:
            proc = subprocess.run(
                command,
                cwd=cwd,
                shell=True,
                capture_output=True,
                text=True,
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

    def git_status(self, cwd: str | None = None) -> Dict[str, Any]:
        return self.run_command("git status -sb", cwd=cwd)

    def git_diff(self, cwd: str | None = None) -> Dict[str, Any]:
        return self.run_command("git diff", cwd=cwd)

    def git_log(self, cwd: str | None = None, max_count: int = 20) -> Dict[str, Any]:
        return self.run_command(f"git log -n {max_count} --oneline", cwd=cwd)
