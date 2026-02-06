from __future__ import annotations
import re
from typing import Any, Dict, List

class ToolingUtilsMixin:
    def _extract_target_path(self, text: str) -> str:
        if not text:
            return ""
        patterns = [
            r"[A-Za-z]:[\\/][\\w\\-\\.\\/]+\\.[A-Za-z0-9]+",
            r"[\\w\\-\\.\\/]+\\.[A-Za-z0-9]+",
        ]
        for pat in patterns:
            m = re.search(pat, text)
            if m:
                return m.group(0)
        return ""

    def _extract_paths(self, text: str) -> List[str]:
        if not text:
            return []
        patterns = [
            r"[A-Za-z]:[\\/][\\w\\-\\.\\/]+\\.[A-Za-z0-9]+",
            r"[A-Za-z]:[\\/][\\w\\-\\.\\/]+",
            r"[\\w\\-\\.\\/]+\\.[A-Za-z0-9]+",
        ]
        found: List[str] = []
        for pat in patterns:
            for m in re.findall(pat, text):
                if m not in found:
                    found.append(m)
        return found

    def _path_allowed(self, path: str, constraints: Dict[str, Any], context: List[Dict[str, Any]]) -> bool:
        if not isinstance(path, str) or not path.strip():
            return False
        if path in (".", ""):
            return True
        path_hint = constraints.get("path_hint")
        if isinstance(path_hint, str) and path_hint.strip() and path_hint not in (".", ""):
            return path == path_hint
        return False

    def _validate_python_exec_code(self, code: Any, target_path: str) -> bool:
        if not isinstance(code, str) or not code.strip():
            return False
        if target_path and target_path in code:
            lowered = code.lower()
            if "shutil.move" in lowered or "os.replace" in lowered:
                return False
            if "open(" in lowered and "'w'" in lowered:
                return False
            if "open(" in lowered and "\"w\"" in lowered:
                return False
            if "write_text" in lowered:
                return False
        return True

    def _normalize_unified_diff(self, path_hint: str, diff_text: str) -> str:
        if not isinstance(diff_text, str):
            return ""
        text = diff_text
        if path_hint:
            if "diff --git " not in text:
                text = f"diff --git a/{path_hint} b/{path_hint}\n" + text
            text = text.replace("+++ b.", "+++ b/")
        return text

    def _extract_content_literal(self, text: str) -> str:
        if not text:
            return ""
        match = re.search(r"content\s+['\"]([\s\S]*?)['\"]", text)
        if not match:
            return ""
        raw = match.group(1)
        return raw.encode("utf-8").decode("unicode_escape")

    def _fallback_path_from_goal(self, goal: str, repo_index_light: Dict[str, Any]) -> str:
        candidates = self._extract_paths(goal)
        files = []
        if isinstance(repo_index_light, dict):
            raw = repo_index_light.get("files", [])
            if isinstance(raw, list):
                files = raw
        norm_files = [str(f).replace("\\", "/") for f in files]
        for cand in candidates:
            cand_norm = str(cand).replace("\\", "/")
            if cand_norm in norm_files:
                return cand
            prefix = cand_norm.rstrip("/") + "/"
            for f in norm_files:
                if f.startswith(prefix):
                    return cand
        return ""
