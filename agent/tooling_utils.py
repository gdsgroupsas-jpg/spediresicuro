from __future__ import annotations
import re
from typing import Any, Dict, List, Optional

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

    def _get_format_instruction_for_path(self, path: str) -> str:
        """Restituisce l'istruzione di formato automatica per le operazioni di scrittura, basata sull'estensione."""
        path_lower = (path or "").lower()
        if path_lower.endswith(".json"):
            return "Output valid JSON only. Preserve or add only the keys requested in the goal. No plain key=value lines. Use double quotes for strings."
        if path_lower.endswith(".env"):
            return "(.env specialist applies: one KEY=VALUE per line, UPPERCASE keys, no commas.)"
        if path_lower.endswith(".yaml") or path_lower.endswith(".yml"):
            return "Output valid YAML. One key per line, correct indentation. No leading/trailing spaces on key names."
        if path_lower.endswith(".ini"):
            return "Output INI format: optional [section] headers, then key = value. One key per line."
        if "config_like" in path_lower or ("config" in path_lower and path_lower.endswith(".txt")):
            return "Output key-value config format (e.g. KEY = value or key = value). One key per line. Preserve style if file_content is provided."
        return "Output the full file content that satisfies the goal. Preserve format of the file type."

    def _build_coder_payload(
        self,
        goal: str,
        path: str,
        file_content: str,
        *,
        format_instruction: str = "",
        error_hint: Optional[Dict[str, Any]] = None,
        removal_hint: str = "",
        constraints: Optional[Dict[str, Any]] = None,
        intent: str = "",
        instruction: str = "",
        pattern_hint: str = "",
        replacement_hint: str = "",
        template: str = "",
    ) -> Dict[str, Any]:
        """Payload unificato per il coder: stesso ordine di chiavi per tutti i tool (apply_patch_unified, safe_write, replace_text, write_file)."""
        payload: Dict[str, Any] = {
            "goal": goal,
            "path": path or "",
            "file_content": file_content or "",
            "format_instruction": format_instruction or "",
            "error_hint": error_hint if error_hint else {},
            "removal_hint": removal_hint or "",
            "constraints": constraints if constraints else {},
            "intent": intent or "",
            "instruction": instruction or "",
            "pattern_hint": pattern_hint or "",
            "replacement_hint": replacement_hint or "",
            "template": template or "",
        }
        return payload

