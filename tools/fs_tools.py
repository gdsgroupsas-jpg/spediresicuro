from __future__ import annotations

import os
import re
from typing import Any, Dict, List


class FileSystemTools:
    def __init__(self, base_dir: str | None = None) -> None:
        self._write_authorized = False
        self._base_dir = os.path.abspath(base_dir or os.getcwd())

    def set_write_authorized(self, authorized: bool) -> None:
        self._write_authorized = authorized

    def set_base_dir(self, base_dir: str) -> None:
        self._base_dir = os.path.abspath(base_dir)
    
    def _validate_path(self, path: str) -> str | None:
        if not path:
            return "Percorso vuoto"
        abs_path = os.path.abspath(path)
        try:
            common = os.path.commonpath([abs_path, self._base_dir])
        except ValueError:
            return "Percorso non valido"
        if common != self._base_dir:
            return f"Accesso negato fuori da base_dir: {self._base_dir}"
        return None

    def dispatch(self, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        if name == "list_dir":
            return self.list_dir(args.get("path", ""))
        if name == "read_file":
            return self.read_file(args.get("path", ""))
        if name == "search":
            return self.search(args.get("path", ""), args.get("pattern", ""), args.get("max_results", 20))
        if name == "stat":
            return self.stat(args.get("path", ""))
        if name == "write_file":
            return self.write_file(args.get("path", ""), args.get("content", ""))
        return {"ok": False, "error": f"Tool sconosciuto: {name}"}

    def list_dir(self, path: str) -> Dict[str, Any]:
        err = self._validate_path(path)
        if err:
            return {"ok": False, "error": err}
        try:
            entries = []
            for name in os.listdir(path):
                full = os.path.join(path, name)
                entries.append(
                    {
                        "name": name,
                        "is_dir": os.path.isdir(full),
                    }
                )
            return {"ok": True, "path": path, "entries": entries}
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

    def search(self, path: str, pattern: str, max_results: int = 20) -> Dict[str, Any]:
        err = self._validate_path(path)
        if err:
            return {"ok": False, "error": err}
        results: List[Dict[str, Any]] = []
        try:
            rx = re.compile(re.escape(pattern))
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

    def stat(self, path: str) -> Dict[str, Any]:
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

    def write_file(self, path: str, content: str) -> Dict[str, Any]:
        err = self._validate_path(path)
        if err:
            return {"ok": False, "error": err}
        if not self._write_authorized:
            return {"ok": False, "error": "Scrittura non autorizzata"}
        try:
            os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            # one-shot: revoke after write
            self._write_authorized = False
            return {"ok": True, "path": path, "bytes": len(content.encode("utf-8"))}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

