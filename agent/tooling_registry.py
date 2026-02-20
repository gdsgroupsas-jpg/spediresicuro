from __future__ import annotations
from typing import Any
from tools.registry import ToolDef, ToolRegistry

class ToolingRegistryMixin:
    def _build_registry(self) -> ToolRegistry:
        reg = ToolRegistry()
        reg.add(
            ToolDef(
                name="list_dir",
                description="List files and folders in a path. Returns the list; that is the result to report to the user.",
                parameters={"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
                func=lambda a: self.system_tools.list_dir(a.get("path", "")),
            )
        )
        reg.add(
            ToolDef(
                name="count_dir",
                description="Count files and folders in a path. Returns counts; that is the result to report.",
                parameters={"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
                func=lambda a: self.system_tools.count_dir(a.get("path", "")),
            )
        )
        reg.add(
            ToolDef(
                name="read_file",
                description="Read a text file. Returns the content; that is the result to report.",
                parameters={"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
                func=lambda a: self.system_tools.read_file(a.get("path", "")),
            )
        )
        reg.add(
            ToolDef(
                name="read_file_lines",
                description="Read a range of lines from a file. Returns the content; that is the result to report.",
                parameters={
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "start_line": {"type": "integer"},
                        "end_line": {"type": "integer"},
                    },
                    "required": ["path", "start_line", "end_line"],
                },
                func=lambda a: self.system_tools.read_file_lines(
                    a.get("path", ""), int(a.get("start_line", 1)), int(a.get("end_line", 1))
                ),
            )
        )
        reg.add(
            ToolDef(
                name="search_text",
                description="Search a string inside files in a directory. Returns matches; that is the result to report.",
                parameters={
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "pattern": {"type": "string"},
                        "max_results": {"type": "integer"},
                    },
                    "required": ["path", "pattern"],
                },
                func=lambda a: self.system_tools.search_text(
                    a.get("path", ""), a.get("pattern", ""), int(a.get("max_results", 20))
                ),
            )
        )
        reg.add(
            ToolDef(
                name="search",
                description="Alias of search_text. Returns matches; that is the result to report.",
                parameters={
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "pattern": {"type": "string"},
                        "max_results": {"type": "integer"},
                    },
                    "required": ["path", "pattern"],
                },
                func=lambda a: self.system_tools.search_text(
                    a.get("path", ""), a.get("pattern", ""), int(a.get("max_results", 20))
                ),
            )
        )
        reg.add(
            ToolDef(
                name="stat_path",
                description="File or directory info. Returns the info; that is the result to report.",
                parameters={"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
                func=lambda a: self.system_tools.stat_path(a.get("path", "")),
            )
        )
        reg.add(
            ToolDef(
                name="stat",
                description="Alias of stat_path. Returns the info; that is the result to report.",
                parameters={"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
                func=lambda a: self.system_tools.stat_path(a.get("path", "")),
            )
        )
        reg.add(
            ToolDef(
                name="preview_write",
                description="Show diff between current and new content (safe, no write). Returns the diff; that is the result to report.",
                parameters={
                    "type": "object",
                    "properties": {"path": {"type": "string"}, "content": {"type": "string"}},
                    "required": ["path", "content"],
                },
                func=lambda a: self.system_tools.preview_write(a.get("path", ""), a.get("content", "")),
            )
        )
        reg.add(
            ToolDef(
                name="apply_write_preview",
                description="Apply write using base hash (requires approval)",
                parameters={
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "content": {"type": "string"},
                        "expected_old_hash": {"type": "string"},
                    },
                    "required": ["path", "content", "expected_old_hash"],
                },
                func=lambda a: self.system_tools.apply_write_preview(
                    a.get("path", ""), a.get("content", ""), a.get("expected_old_hash", "")
                ),
                requires_approval=True,
            )
        )
        reg.add(
            ToolDef(
                name="safe_write",
                description="Write full file content (requires approval). Use for multi-line edits, new files, or when the change is not a simple literal replacement. Requires path + full new content. Orchestration provides content from coder.",
                parameters={
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "content": {"type": "string"},
                        "dry_run": {"type": "boolean"},
                    },
                    "required": ["path", "content"],
                },
                func=lambda a: self.system_tools.safe_write(
                    a.get("path", ""), a.get("content", ""), bool(a.get("dry_run", False))
                ),
                requires_approval=True,
            )
        )
        reg.add(
            ToolDef(
                name="apply_patch_unified",
                description="Apply a unified diff via git apply (requires approval)",
                parameters={
                    "type": "object",
                    "properties": {"diff": {"type": "string"}},
                    "required": ["diff"],
                },
                func=lambda a: self.system_tools.apply_patch_unified(a.get("diff", "")),
                requires_approval=True,
            )
        )
        reg.add(
            ToolDef(
                name="write_file",
                description="Write a text file (requires approval)",
                parameters={
                    "type": "object",
                    "properties": {"path": {"type": "string"}, "content": {"type": "string"}},
                    "required": ["path", "content"],
                },
                func=lambda a: self.system_tools.write_file(a.get("path", ""), a.get("content", "")),
                requires_approval=True,
            )
        )
        reg.add(
            ToolDef(
                name="append_file",
                description="Append text to a file (requires approval)",
                parameters={
                    "type": "object",
                    "properties": {"path": {"type": "string"}, "content": {"type": "string"}},
                    "required": ["path", "content"],
                },
                func=lambda a: self.system_tools.append_file(a.get("path", ""), a.get("content", "")),
                requires_approval=True,
            )
        )
        reg.add(
            ToolDef(
                name="replace_text",
                description="Replace exact literal string in a file (requires approval). Use when goal specifies 'replace X with Y' and X/Y are known. Requires path, old (exact text), new (replacement). Orchestration extracts old/new from goal.",
                parameters={
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "old": {"type": "string"},
                        "new": {"type": "string"},
                        "count": {"type": "integer"},
                        "regex": {"type": "boolean"},
                    },
                    "required": ["path", "old", "new"],
                },
                func=lambda a: self.system_tools.replace_text(
                    a.get("path", ""), a.get("old", ""), a.get("new", ""), int(a.get("count", -1)), bool(a.get("regex", False))
                ),
                requires_approval=True,
            )
        )
        reg.add(
            ToolDef(
                name="replace_in_repo",
                description="Replace text across a repo (requires approval). Supports dry_run.",
                parameters={
                    "type": "object",
                    "properties": {
                        "root": {"type": "string"},
                        "old": {"type": "string"},
                        "new": {"type": "string"},
                        "max_files": {"type": "integer"},
                        "regex": {"type": "boolean"},
                        "dry_run": {"type": "boolean"},
                    },
                    "required": ["root", "old", "new"],
                },
                func=lambda a: self.system_tools.replace_in_repo(
                    a.get("root", "."),
                    a.get("old", ""),
                    a.get("new", ""),
                    int(a.get("max_files", 200)),
                    bool(a.get("regex", False)),
                    bool(a.get("dry_run", False)),
                ),
                requires_approval=True,
            )
        )
        reg.add(
            ToolDef(
                name="insert_text",
                description="Insert text at a specific line (requires approval)",
                parameters={
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "line_no": {"type": "integer"},
                        "text": {"type": "string"},
                        "position": {"type": "string"},
                    },
                    "required": ["path", "line_no", "text"],
                },
                func=lambda a: self.system_tools.insert_text(
                    a.get("path", ""), int(a.get("line_no", 1)), a.get("text", ""), a.get("position", "before")
                ),
                requires_approval=True,
            )
        )
        reg.add(
            ToolDef(
                name="delete_path",
                description="Delete a file or directory (requires approval)",
                parameters={
                    "type": "object",
                    "properties": {"path": {"type": "string"}, "recursive": {"type": "boolean"}},
                    "required": ["path"],
                },
                func=lambda a: self.system_tools.delete_path(a.get("path", ""), bool(a.get("recursive", False))),
                requires_approval=True,
            )
        )
        reg.add(
            ToolDef(
                name="move_path",
                description="Move or rename a file/directory (requires approval)",
                parameters={
                    "type": "object",
                    "properties": {"src": {"type": "string"}, "dest": {"type": "string"}},
                    "required": ["src", "dest"],
                },
                func=lambda a: self.system_tools.move_path(a.get("src", ""), a.get("dest", "")),
                requires_approval=True,
            )
        )
        reg.add(
            ToolDef(
                name="copy_path",
                description="Copy a file/directory (requires approval)",
                parameters={
                    "type": "object",
                    "properties": {"src": {"type": "string"}, "dest": {"type": "string"}},
                    "required": ["src", "dest"],
                },
                func=lambda a: self.system_tools.copy_path(a.get("src", ""), a.get("dest", "")),
                requires_approval=True,
            )
        )
        reg.add(
            ToolDef(
                name="mkdir",
                description="Create a directory",
                parameters={
                    "type": "object",
                    "properties": {"path": {"type": "string"}, "parents": {"type": "boolean"}},
                    "required": ["path"],
                },
                func=lambda a: self.system_tools.mkdir(a.get("path", ""), bool(a.get("parents", True))),
            )
        )
        reg.add(
            ToolDef(
                name="glob_paths",
                description="Expand a glob pattern to a list of paths. Returns the path list; that is the result to report.",
                parameters={
                    "type": "object",
                    "properties": {"pattern": {"type": "string"}, "recursive": {"type": "boolean"}},
                    "required": ["pattern"],
                },
                func=lambda a: self.system_tools.glob_paths(a.get("pattern", ""), bool(a.get("recursive", True))),
            )
        )
        reg.add(
            ToolDef(
                name="file_hash",
                description="Compute a file hash. Returns the hash; that is the result to report.",
                parameters={
                    "type": "object",
                    "properties": {"path": {"type": "string"}, "algo": {"type": "string"}},
                    "required": ["path"],
                },
                func=lambda a: self.system_tools.file_hash(a.get("path", ""), a.get("algo", "sha256")),
            )
        )
        reg.add(
            ToolDef(
                name="run_command",
                description="Run a system command (requires approval)",
                parameters={
                    "type": "object",
                    "properties": {"command": {"type": "string"}, "cwd": {"type": "string"}, "timeout_sec": {"type": "integer"}},
                    "required": ["command"],
                },
                func=lambda a: self.system_tools.run_command(
                    a.get("command", ""), a.get("cwd"), int(a.get("timeout_sec", 120))
                ),
                requires_approval=True,
            )
        )
        reg.add(
            ToolDef(
                name="git_status",
                description="Show git status. Returns the status; that is the result to report.",
                parameters={"type": "object", "properties": {"cwd": {"type": "string"}}, "required": []},
                func=lambda a: self.system_tools.git_status(a.get("cwd")),
            )
        )
        reg.add(
            ToolDef(
                name="git_diff",
                description="Show git diff. Returns the diff; that is the result to report.",
                parameters={"type": "object", "properties": {"cwd": {"type": "string"}}, "required": []},
                func=lambda a: self.system_tools.git_diff(a.get("cwd")),
            )
        )
        reg.add(
            ToolDef(
                name="git_log",
                description="Show git log (short). Returns the log; that is the result to report.",
                parameters={
                    "type": "object",
                    "properties": {"cwd": {"type": "string"}, "max_count": {"type": "integer"}},
                    "required": [],
                },
                func=lambda a: self.system_tools.git_log(a.get("cwd"), int(a.get("max_count", 20))),
            )
        )
        reg.add(
            ToolDef(
                name="python_exec",
                description="Execute Python code (requires approval). A path or paths array is required as execution context. If multiple files are needed, use paths array.",
                parameters={
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Single file path (for backward compatibility)"},
                        "paths": {"type": "array", "items": {"type": "string"}, "description": "Array of file paths to load as modules"},
                        "code": {"type": "string"},
                        "timeout_sec": {"type": "integer"},
                    },
                    "required": ["code"],
                },
                func=lambda a: self.python_tools.python_exec(
                    a.get("code", ""),
                    int(a.get("timeout_sec", 120)),
                    a.get("path", ""),
                    a.get("paths"),
                ),
                requires_approval=True,
            )
        )
        reg.add(
            ToolDef(
                name="python_ast_outline",
                description="Extract AST outline (functions/classes) from a Python file. Returns the outline; that is the result to report.",
                parameters={"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
                func=lambda a: self.python_tools.ast_outline(a.get("path", "")),
            )
        )
        reg.add(
            ToolDef(
                name="python_ast_imports",
                description="List imports from a Python file. Returns the imports; that is the result to report.",
                parameters={"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
                func=lambda a: self.python_tools.ast_imports(a.get("path", "")),
            )
        )
        reg.add(
            ToolDef(
                name="python_ast_find",
                description="Find symbol definitions (functions/classes) in a Python file. If name is omitted, returns all matching symbols by type. Returns the symbols; that is the result to report.",
                parameters={
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "name": {"type": "string"},
                        "symbol_type": {"type": "string"},
                    },
                    "required": ["path"],
                },
                func=lambda a: self.python_tools.ast_find_symbol(
                    a.get("path", ""), a.get("name", ""), a.get("symbol_type", "")
                ),
            )
        )
        reg.add(
            ToolDef(
                name="python_project_deps",
                description="Collect dependencies from requirements.txt and pyproject.toml. Returns the deps; that is the result to report.",
                parameters={"type": "object", "properties": {"root": {"type": "string"}}, "required": ["root"]},
                func=lambda a: self.python_tools.project_deps(a.get("root", "")),
            )
        )
        reg.add(
            ToolDef(
                name="python_project_deps_toml",
                description="Read pyproject.toml using a TOML parser. Returns the parsed content; that is the result to report.",
                parameters={"type": "object", "properties": {"root": {"type": "string"}}, "required": ["root"]},
                func=lambda a: self.python_tools.project_deps_toml(a.get("root", "")),
            )
        )
        reg.add(
            ToolDef(
                name="python_run_file",
                description="Run a Python file (requires approval)",
                parameters={
                    "type": "object",
                    "properties": {"path": {"type": "string"}, "timeout_sec": {"type": "integer"}},
                    "required": ["path"],
                },
                func=lambda a: self.python_tools.python_run_file(a.get("path", ""), int(a.get("timeout_sec", 120))),
                requires_approval=True,
            )
        )
        reg.add(
            ToolDef(
                name="pip_list",
                description="List installed Python packages. Returns the list; that is the result to report.",
                parameters={"type": "object", "properties": {}, "required": []},
                func=lambda a: self.python_tools.pip_list(),
            )
        )
        reg.add(
            ToolDef(
                name="pip_install",
                description="Install a Python package (requires approval)",
                parameters={
                    "type": "object",
                    "properties": {"package": {"type": "string"}},
                    "required": ["package"],
                },
                func=lambda a: self.python_tools.pip_install(a.get("package", "")),
                requires_approval=True,
            )
        )
        reg.add(
            ToolDef(
                name="pytest_run",
                description="Run pytest (requires approval). Test files/modules always have names starting with 'test_' (e.g. test_libcalc.py). Pass the test file path in args, e.g. '-q path/to/test_foo.py'.",
                parameters={"type": "object", "properties": {"args": {"type": "string"}, "cwd": {"type": "string"}}, "required": []},
                func=lambda a: self.python_tools.pytest_run(a.get("args", ""), cwd=a.get("cwd") or None),
                requires_approval=True,
            )
        )
        reg.add(
            ToolDef(
                name="ruff_check",
                description="Run ruff check (requires approval)",
                parameters={"type": "object", "properties": {"args": {"type": "string"}}, "required": []},
                func=lambda a: self.python_tools.ruff_check(a.get("args", "")),
                requires_approval=True,
            )
        )
        reg.add(
            ToolDef(
                name="mypy_check",
                description="Run mypy (requires approval)",
                parameters={"type": "object", "properties": {"args": {"type": "string"}}, "required": []},
                func=lambda a: self.python_tools.mypy_check(a.get("args", "")),
                requires_approval=True,
            )
        )
        return reg
