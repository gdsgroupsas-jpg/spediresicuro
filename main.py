from __future__ import annotations

import json
import threading
import time
from dataclasses import dataclass
import os
from typing import Optional

import requests
from urllib.parse import urlparse

from PySide6 import QtCore, QtGui, QtWidgets

# Default 2 sec tra una request e l'altra ai modelli (tutti i flussi).
os.environ.setdefault("OLLAMA_REQUEST_DELAY", "2")

from agent.core import Agent


@dataclass
class UiEvent:
    kind: str
    text: str


class AgentWorker(QtCore.QObject):
    event_emitted = QtCore.Signal(str, str)
    finished = QtCore.Signal()
    request_approval = QtCore.Signal(str)

    def __init__(self, agent: Agent, user_text: str):
        super().__init__()
        self.agent = agent
        self.user_text = user_text
        self._cancel = False
        self._approval_event = threading.Event()
        self._approval_result = False

    @QtCore.Slot()
    def run(self) -> None:
        try:
            for kind, text in self.agent.run(self.user_text, approval_handler=self._wait_for_approval):
                if self._cancel:
                    break
                if kind == "REQUEST_APPROVAL":
                    self.request_approval.emit(text)
                else:
                    self.event_emitted.emit(kind, text)
        finally:
            self.finished.emit()

    def cancel(self) -> None:
        self._cancel = True
        self._approval_result = False
        self._approval_event.set()

    def approve_write(self, approved: bool) -> None:
        self._approval_result = approved
        self._approval_event.set()

    def _wait_for_approval(self, _args: dict) -> bool:
        self._approval_event.clear()
        return self._approval_event.wait() and self._approval_result


class MainWindow(QtWidgets.QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("Mini Agent Framework")
        self.resize(1000, 700)

        self._output = QtWidgets.QTextEdit()
        self._output.setReadOnly(True)
        self._output.setFont(QtGui.QFont("Segoe UI Emoji", 10))

        self._plan_view = QtWidgets.QTextEdit()
        self._plan_view.setReadOnly(True)
        self._plan_view.setFont(QtGui.QFont("Segoe UI Emoji", 10))
        self._plan_view.setPlaceholderText("Piano JSON apparira' qui...")

        self._input = QtWidgets.QLineEdit()
        self._input.setPlaceholderText("Scrivi una richiesta... (Invio per inviare)")

        self._send_btn = QtWidgets.QPushButton("Invia")
        self._cancel_btn = QtWidgets.QPushButton("Stop")
        self._cancel_btn.setEnabled(False)
        self._approve_write_btn = QtWidgets.QPushButton("Autorizza Operazione (una volta)")
        self._deny_write_btn = QtWidgets.QPushButton("Rifiuta Operazione")
        self._approve_write_btn.setVisible(False)
        self._deny_write_btn.setVisible(False)
        self._reset_btn = QtWidgets.QPushButton("Reset Memoria")
        self._reset_base_dir_btn = QtWidgets.QPushButton("Base Dir Default")

        self._settings_btn = QtWidgets.QToolButton()
        self._settings_btn.setText("[]")
        self._settings_btn.setToolTip("Impostazioni stack")
        self._settings_btn.setFixedSize(28, 28)

        self._base_dir_label = QtWidgets.QLabel("Base dir:")
        self._base_dir_input = QtWidgets.QLineEdit()
        self._base_dir_input.setPlaceholderText("Seleziona directory di lavoro...")
        self._base_dir_browse = QtWidgets.QPushButton("Sfoglia")

        controls = QtWidgets.QHBoxLayout()
        controls.addWidget(self._input, 1)
        controls.addWidget(self._send_btn)
        controls.addWidget(self._cancel_btn)
        controls.addWidget(self._approve_write_btn)
        controls.addWidget(self._deny_write_btn)
        controls.addWidget(self._reset_btn)
        controls.addWidget(self._reset_base_dir_btn)

        base_dir_row = QtWidgets.QHBoxLayout()
        base_dir_row.addWidget(self._settings_btn)
        base_dir_row.addWidget(self._base_dir_label)
        base_dir_row.addWidget(self._base_dir_input, 1)
        base_dir_row.addWidget(self._base_dir_browse)

        split = QtWidgets.QSplitter(QtCore.Qt.Vertical)
        split.addWidget(self._output)
        split.addWidget(self._plan_view)
        split.setStretchFactor(0, 3)
        split.setStretchFactor(1, 1)

        root = QtWidgets.QVBoxLayout()
        root.addWidget(split, 1)
        root.addLayout(base_dir_row)
        root.addLayout(controls)

        container = QtWidgets.QWidget()
        container.setLayout(root)
        self.setCentralWidget(container)

        self._agent = Agent()
        self._worker: Optional[AgentWorker] = None
        self._thread: Optional[QtCore.QThread] = None
        self._model_line_open = False

        self._settings_menu = self._build_settings_menu()

        self._send_btn.clicked.connect(self._on_send)
        self._input.returnPressed.connect(self._on_send)
        self._cancel_btn.clicked.connect(self._on_cancel)
        self._approve_write_btn.clicked.connect(self._on_approve_write)
        self._deny_write_btn.clicked.connect(self._on_deny_write)
        self._reset_btn.clicked.connect(self._on_reset_memory)
        self._reset_base_dir_btn.clicked.connect(self._on_reset_base_dir)
        self._base_dir_browse.clicked.connect(self._on_browse_base_dir)
        self._base_dir_input.editingFinished.connect(self._on_base_dir_changed)
        self._settings_btn.clicked.connect(self._open_settings_menu)

        self._log_line("SYS", "Pronto. Modello: gpt-oss:20b-cloud (Ollama).")
        self._init_base_dir()
        self._init_stack_settings()

    def _color_for_kind(self, kind: str) -> QtGui.QColor:
        mapping = {
            "SYS": QtGui.QColor("#1b4f72"),
            "USER": QtGui.QColor("#0e6251"),
            "TOOL": QtGui.QColor("#7d6608"),
            "TOOL_RESULT": QtGui.QColor("#6c3483"),
            "ERROR": QtGui.QColor("#922b21"),
            "MODEL": QtGui.QColor("#17202a"),
            "TOKEN_USAGE": QtGui.QColor("#5b2c6f"),
            "TRANSLATED_CLEAN": QtGui.QColor("#1a5276"),
            "ATTEMPT": QtGui.QColor("#6c3483"),
            "REQUEST_MANAGER_RAW": QtGui.QColor("#1f618d"),
            "DEBUG_ENGINEERING_RAW": QtGui.QColor("#1f618d"),
            "DISCOVERY_RAW": QtGui.QColor("#1f618d"),
            "REASONER_RAW": QtGui.QColor("#1f618d"),
            "TASK_PLAN": QtGui.QColor("#2874a6"),
            "PLAN": QtGui.QColor("#2874a6"),
            "PLAN_JSON": QtGui.QColor("#2874a6"),
            "PROJECT_MANAGER_RAW": QtGui.QColor("#1f618d"),
            "ROUTE_PLANNER_RAW": QtGui.QColor("#1f618d"),
            "EXPLAINER_RAW": QtGui.QColor("#1f618d"),
            "EXPLAIN_DISCOVERY_RAW": QtGui.QColor("#1f618d"),
            "TOOL_ANALYSIS_PROMPT": QtGui.QColor("#3498db"),
            "TOOL_ARGUMENT_PROMPT": QtGui.QColor("#3498db"),
            "TOOL_CALLER_PROMPT": QtGui.QColor("#3498db"),
            "TOOL_CALLER_RAW": QtGui.QColor("#3498db"),
            "TOOL_CALLER_EVENTS": QtGui.QColor("#5d6d7e"),
            "TOOL_CALLER_EVENTS_RETRY": QtGui.QColor("#5d6d7e"),
            "CODER_RAW": QtGui.QColor("#2980b9"),
            "REQUEST_APPROVAL": QtGui.QColor("#8e44ad"),
            "SUMMARY_RESULT": QtGui.QColor("#1a5276"),
            "TOKEN_LIMIT_PREVIEW": QtGui.QColor("#5b2c6f"),
        }
        return mapping.get(kind, QtGui.QColor("#17202a"))

    def _format_log_text(self, text: str) -> str:
        """Formatta JSON come lista a punti; altrimenti restituisce il testo originale."""
        if not text or not isinstance(text, str):
            return text or ""
        s = text.strip()
        if not s:
            return text
        try:
            data = json.loads(s)
        except json.JSONDecodeError:
            return text

        def _to_bullets(obj, indent: int = 0) -> str:
            pad = "  " * indent
            lines: list[str] = []
            if isinstance(obj, dict):
                for k, v in obj.items():
                    if isinstance(v, (dict, list)):
                        lines.append(f"{pad}• {k}:")
                        lines.append(_to_bullets(v, indent + 1))
                    else:
                        lines.append(f"{pad}• {k}: {v}")
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    if isinstance(item, (dict, list)):
                        lines.append(f"{pad}• [{i}]:")
                        lines.append(_to_bullets(item, indent + 1))
                    else:
                        lines.append(f"{pad}• {item}")
            return "\n".join(lines).rstrip()

        return _to_bullets(data)

    def _append_text(self, text: str, color: QtGui.QColor) -> None:
        cursor = self._output.textCursor()
        cursor.movePosition(QtGui.QTextCursor.End)
        fmt = QtGui.QTextCharFormat()
        fmt.setForeground(color)
        cursor.insertText(text, fmt)
        self._output.setTextCursor(cursor)
        self._output.ensureCursorVisible()
        QtWidgets.QApplication.processEvents(QtCore.QEventLoop.ProcessEventsFlag.ExcludeUserInputEvents)

    def _log_line(self, kind: str, text: str) -> None:
        if self._model_line_open:
            self._append_text("\n", QtGui.QColor("#17202a"))
            self._model_line_open = False
        timestamp = time.strftime("%H:%M:%S")
        formatted = self._format_log_text(str(text)) if text else ""
        line = f"[{timestamp}] {kind}: {formatted}\n"
        self._append_text(line, self._color_for_kind(kind))

    def _log_token(self, token: str) -> None:
        if not self._model_line_open:
            timestamp = time.strftime("%H:%M:%S")
            prefix = f"[{timestamp}] MODEL: "
            self._append_text(prefix, self._color_for_kind("MODEL"))
            self._model_line_open = True
        self._append_text(token, self._color_for_kind("MODEL"))

    def _on_send(self) -> None:
        text = self._input.text().strip()
        if not text or self._worker is not None:
            return
        self._input.clear()
        self._log_line("USER", text)

        self._thread = QtCore.QThread()
        self._worker = AgentWorker(self._agent, text)
        self._worker.moveToThread(self._thread)
        self._worker.event_emitted.connect(self._on_event)
        self._worker.request_approval.connect(self._on_request_approval)
        self._worker.finished.connect(self._on_done)
        self._thread.started.connect(self._worker.run)
        self._thread.start()

        self._send_btn.setEnabled(False)
        self._cancel_btn.setEnabled(True)

    def _on_cancel(self) -> None:
        if self._worker:
            self._worker.cancel()
            self._log_line("SYS", "Annullamento richiesto.")
            self._hide_write_controls()

    def _on_done(self) -> None:
        self._send_btn.setEnabled(True)
        self._cancel_btn.setEnabled(False)
        self._hide_write_controls()

        if self._thread:
            self._thread.quit()
            self._thread.wait()
            self._thread = None
        self._worker = None

    def _on_event(self, kind: str, text: str) -> None:
        if kind == "MODEL_TOKEN":
            self._log_token(text)
        elif kind == "PLAN":
            self._plan_view.setPlainText(text)
            self._log_line("PLAN", text)
        else:
            self._log_line(kind, text)

    def _on_request_approval(self, args_json: str) -> None:
        self._log_line("REQUEST_APPROVAL", args_json)
        self._maybe_show_diff(args_json)
        self._approve_write_btn.setVisible(True)
        self._deny_write_btn.setVisible(True)

    def _on_approve_write(self) -> None:
        if self._worker:
            self._worker.approve_write(True)
            self._log_line("SYS", "Operazione autorizzata (one-shot).")
        self._hide_write_controls()

    def _on_deny_write(self) -> None:
        if self._worker:
            self._worker.approve_write(False)
            self._log_line("SYS", "Operazione rifiutata.")
        self._hide_write_controls()

    def _hide_write_controls(self) -> None:
        self._approve_write_btn.setVisible(False)
        self._deny_write_btn.setVisible(False)

    def _maybe_show_diff(self, args_json: str) -> None:
        try:
            payload = json.loads(args_json)
        except Exception:
            return
        name = payload.get("name")
        args = payload.get("args", {})
        if name not in ("preview_write", "apply_write_preview"):
            return
        path = args.get("path", "")
        content = args.get("content", "")
        if not path:
            return
        try:
            from tools.system_tools import SystemTools
            tools = SystemTools()
            res = tools.preview_write(path, content)
            diff = res.get("diff", "")
        except Exception:
            diff = ""
        if not diff:
            return
        dialog = QtWidgets.QDialog(self)
        dialog.setWindowTitle(f"Diff preview: {path}")
        dialog.resize(900, 600)
        text = QtWidgets.QTextEdit()
        text.setReadOnly(True)
        text.setFont(QtGui.QFont("Segoe UI Emoji", 10))
        text.setHtml(self._colorize_diff(diff))
        layout = QtWidgets.QVBoxLayout()
        layout.addWidget(text)
        dialog.setLayout(layout)
        dialog.exec()

    def _colorize_diff(self, diff: str) -> str:
        def esc(s: str) -> str:
            return (
                s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
            )

        lines = diff.splitlines()
        out_lines = []
        for line in lines:
            color = "#2c3e50"
            if line.startswith("+++ ") or line.startswith("--- "):
                color = "#7d6608"
            elif line.startswith("@@"):
                color = "#1b4f72"
            elif line.startswith("+"):
                color = "#1e8449"
            elif line.startswith("-"):
                color = "#922b21"
            out_lines.append(f"<span style='color:{color}'>" + esc(line) + "</span>")
        html = "<pre style='white-space: pre-wrap;'>" + "\n".join(out_lines) + "</pre>"
        return html

    def _on_reset_memory(self) -> None:
        self._agent.reset_history()
        self._log_line("SYS", "Memoria conversazione resettata.")

    def _init_base_dir(self) -> None:
        base_dir = self._load_base_dir() or QtCore.QDir.currentPath()
        self._base_dir_input.setText(base_dir)
        self._agent.set_base_dir(base_dir)
        self._log_line("SYS", f"Base dir impostata: {base_dir}")

    def _on_browse_base_dir(self) -> None:
        chosen = QtWidgets.QFileDialog.getExistingDirectory(self, "Seleziona Base Dir")
        if chosen:
            self._base_dir_input.setText(chosen)
            self._agent.set_base_dir(chosen)
            self._save_base_dir(chosen)
            self._log_line("SYS", f"Base dir impostata: {chosen}")

    def _on_base_dir_changed(self) -> None:
        path = self._base_dir_input.text().strip()
        if path:
            self._agent.set_base_dir(path)
            self._save_base_dir(path)
            self._log_line("SYS", f"Base dir impostata: {path}")
    
    def _on_reset_base_dir(self) -> None:
        base_dir = QtCore.QDir.currentPath()
        self._base_dir_input.setText(base_dir)
        self._agent.set_base_dir(base_dir)
        self._save_base_dir(base_dir)
        self._log_line("SYS", f"Base dir ripristinata: {base_dir}")

    def _build_settings_menu(self) -> QtWidgets.QMenu:
        menu = QtWidgets.QMenu(self)
        container = QtWidgets.QWidget()
        layout = QtWidgets.QGridLayout(container)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(6)

        host_label = QtWidgets.QLabel("Host Ollama:")
        self._host_input = QtWidgets.QLineEdit()
        self._host_input.setPlaceholderText("http://localhost:11434")
        save_host_btn = QtWidgets.QPushButton("Salva Host")

        planner_model_label = QtWidgets.QLabel("Planner Model:")
        self._planner_model_combo = QtWidgets.QComboBox()
        task_planner_model_label = QtWidgets.QLabel("Task Planner Model:")
        self._task_planner_model_combo = QtWidgets.QComboBox()
        tool_model_label = QtWidgets.QLabel("Tool Model:")
        self._tool_model_combo = QtWidgets.QComboBox()
        final_model_label = QtWidgets.QLabel("Final Model:")
        self._final_model_combo = QtWidgets.QComboBox()
        summary_model_label = QtWidgets.QLabel("Summary Model:")
        self._summary_model_combo = QtWidgets.QComboBox()
        translator_model_label = QtWidgets.QLabel("Translator Model:")
        self._translator_model_combo = QtWidgets.QComboBox()
        coder_model_label = QtWidgets.QLabel("Coder Model:")
        self._coder_model_combo = QtWidgets.QComboBox()
        debugger_model_label = QtWidgets.QLabel("Debugger Model:")
        self._debugger_model_combo = QtWidgets.QComboBox()
        request_manager_label = QtWidgets.QLabel("Request Manager Model:")
        self._request_manager_model_combo = QtWidgets.QComboBox()
        project_manager_label = QtWidgets.QLabel("Project Manager Model:")
        self._project_manager_model_combo = QtWidgets.QComboBox()
        project_planner_label = QtWidgets.QLabel("Project Planner Model:")
        self._project_planner_model_combo = QtWidgets.QComboBox()
        route_planner_label = QtWidgets.QLabel("Route Planner Model:")
        self._route_planner_model_combo = QtWidgets.QComboBox()
        plan_enhancer_label = QtWidgets.QLabel("Plan Enhancer Model:")
        self._plan_enhancer_model_combo = QtWidgets.QComboBox()
        function_planner_label = QtWidgets.QLabel("Function Planner Model:")
        self._function_planner_model_combo = QtWidgets.QComboBox()
        discovery_label = QtWidgets.QLabel("Discovery Model:")
        self._discovery_model_combo = QtWidgets.QComboBox()
        reasoner_label = QtWidgets.QLabel("Reasoner Model:")
        self._reasoner_model_combo = QtWidgets.QComboBox()
        plan_resolver_label = QtWidgets.QLabel("Plan Resolver Model:")
        self._plan_resolver_model_combo = QtWidgets.QComboBox()
        explainer_label = QtWidgets.QLabel("Explainer Model:")
        self._explainer_model_combo = QtWidgets.QComboBox()
        explain_discovery_label = QtWidgets.QLabel("Explain Discovery Model:")
        self._explain_discovery_model_combo = QtWidgets.QComboBox()
        explain_planner_label = QtWidgets.QLabel("Explain Planner Model:")
        self._explain_planner_model_combo = QtWidgets.QComboBox()
        refresh_btn = QtWidgets.QPushButton("Aggiorna Modelli")
        apply_planner_model_btn = QtWidgets.QPushButton("Usa Planner Model")
        apply_task_planner_model_btn = QtWidgets.QPushButton("Usa Task Planner Model")
        apply_tool_model_btn = QtWidgets.QPushButton("Usa Tool Model")
        apply_final_model_btn = QtWidgets.QPushButton("Usa Final Model")
        apply_summary_model_btn = QtWidgets.QPushButton("Usa Summary Model")
        apply_translator_model_btn = QtWidgets.QPushButton("Usa Translator Model")
        apply_coder_model_btn = QtWidgets.QPushButton("Usa Coder Model")
        apply_debugger_model_btn = QtWidgets.QPushButton("Usa Debugger Model")
        apply_request_manager_btn = QtWidgets.QPushButton("Usa Request Manager Model")
        apply_project_manager_btn = QtWidgets.QPushButton("Usa Project Manager Model")
        apply_project_planner_btn = QtWidgets.QPushButton("Usa Project Planner Model")
        apply_route_planner_btn = QtWidgets.QPushButton("Usa Route Planner Model")
        apply_plan_enhancer_btn = QtWidgets.QPushButton("Usa Plan Enhancer Model")
        apply_function_planner_btn = QtWidgets.QPushButton("Usa Function Planner Model")
        apply_discovery_btn = QtWidgets.QPushButton("Usa Discovery Model")
        apply_reasoner_btn = QtWidgets.QPushButton("Usa Reasoner Model")
        apply_plan_resolver_btn = QtWidgets.QPushButton("Usa Plan Resolver Model")
        apply_explainer_btn = QtWidgets.QPushButton("Usa Explainer Model")
        apply_explain_discovery_btn = QtWidgets.QPushButton("Usa Explain Discovery Model")
        apply_explain_planner_btn = QtWidgets.QPushButton("Usa Explain Planner Model")

        # Host row
        layout.addWidget(host_label, 0, 0)
        layout.addWidget(self._host_input, 0, 1, 1, 2)
        layout.addWidget(save_host_btn, 1, 0, 1, 3)

        def add_section(title: str, row: int, col: int) -> int:
            """Aggiunge intestazione categoria nella colonna e restituisce riga+1."""
            sep = QtWidgets.QLabel(title)
            sep.setStyleSheet("font-weight: bold; color: #5a9fd4; margin-top: 6px;")
            layout.addWidget(sep, row, col, 1, 2)
            return row + 1

        def add_pairs(pairs_list: list, start_row: int, col: int) -> int:
            """Aggiunge coppie label+combo e restituisce la riga successiva."""
            for i, (lb, cb) in enumerate(pairs_list):
                layout.addWidget(lb, start_row + i, col)
                layout.addWidget(cb, start_row + i, col + 1)
            return start_row + len(pairs_list)

        # Col 0: Ingresso + Channel Project (ordine flusso)
        r0 = 2
        r0 = add_section("Ingresso", r0, 0)
        r0 = add_pairs([
            (translator_model_label, self._translator_model_combo),
            (request_manager_label, self._request_manager_model_combo),
        ], r0, 0)
        r0 = add_section("Channel Project", r0, 0)
        r0 = add_pairs([
            (project_manager_label, self._project_manager_model_combo),
            (project_planner_label, self._project_planner_model_combo),
            (route_planner_label, self._route_planner_model_combo),
            (plan_enhancer_label, self._plan_enhancer_model_combo),
            (function_planner_label, self._function_planner_model_combo),
        ], r0, 0)

        # Col 1: Channel Debug + Channel Explain
        r1 = 2
        r1 = add_section("Channel Debug", r1, 2)
        r1 = add_pairs([
            (discovery_label, self._discovery_model_combo),
            (reasoner_label, self._reasoner_model_combo),
            (plan_resolver_label, self._plan_resolver_model_combo),
        ], r1, 2)
        r1 = add_section("Channel Explain", r1, 2)
        r1 = add_pairs([
            (explainer_label, self._explainer_model_combo),
            (explain_discovery_label, self._explain_discovery_model_combo),
            (explain_planner_label, self._explain_planner_model_combo),
        ], r1, 2)

        # Col 2: Tool Plan + Scrittura & Output
        r2 = 2
        r2 = add_section("Tool Plan", r2, 4)
        r2 = add_pairs([
            (planner_model_label, self._planner_model_combo),
            (task_planner_model_label, self._task_planner_model_combo),
            (tool_model_label, self._tool_model_combo),
        ], r2, 4)
        r2 = add_section("Scrittura & Output", r2, 4)
        r2 = add_pairs([
            (coder_model_label, self._coder_model_combo),
            (debugger_model_label, self._debugger_model_combo),
            (final_model_label, self._final_model_combo),
            (summary_model_label, self._summary_model_combo),
        ], r2, 4)

        start_row = max(r0, r1, r2)
        layout.addWidget(refresh_btn, start_row, 0, 1, 6)
        apply_btns = [
            apply_planner_model_btn, apply_task_planner_model_btn, apply_tool_model_btn,
            apply_final_model_btn, apply_summary_model_btn, apply_translator_model_btn,
            apply_coder_model_btn, apply_debugger_model_btn, apply_request_manager_btn,
            apply_project_manager_btn, apply_project_planner_btn, apply_route_planner_btn,
            apply_plan_enhancer_btn, apply_function_planner_btn, apply_discovery_btn,
            apply_reasoner_btn, apply_plan_resolver_btn, apply_explainer_btn,
            apply_explain_discovery_btn, apply_explain_planner_btn,
        ]
        for i, btn in enumerate(apply_btns):
            layout.addWidget(btn, start_row + 1 + (i // 3), (i % 3) * 2, 1, 2)

        action = QtWidgets.QWidgetAction(menu)
        action.setDefaultWidget(container)
        menu.addAction(action)

        save_host_btn.clicked.connect(self._on_save_host)
        refresh_btn.clicked.connect(self._on_refresh_models)
        apply_planner_model_btn.clicked.connect(self._on_apply_planner_model)
        apply_task_planner_model_btn.clicked.connect(self._on_apply_task_planner_model)
        apply_tool_model_btn.clicked.connect(self._on_apply_tool_model)
        apply_final_model_btn.clicked.connect(self._on_apply_final_model)
        apply_summary_model_btn.clicked.connect(self._on_apply_summary_model)
        apply_translator_model_btn.clicked.connect(self._on_apply_translator_model)
        apply_coder_model_btn.clicked.connect(self._on_apply_coder_model)
        apply_debugger_model_btn.clicked.connect(self._on_apply_debugger_model)
        apply_request_manager_btn.clicked.connect(self._on_apply_request_manager_model)
        apply_project_manager_btn.clicked.connect(self._on_apply_project_manager_model)
        apply_project_planner_btn.clicked.connect(self._on_apply_project_planner_model)
        apply_route_planner_btn.clicked.connect(self._on_apply_route_planner_model)
        apply_plan_enhancer_btn.clicked.connect(self._on_apply_plan_enhancer_model)
        apply_function_planner_btn.clicked.connect(self._on_apply_function_planner_model)
        apply_discovery_btn.clicked.connect(self._on_apply_discovery_model)
        apply_reasoner_btn.clicked.connect(self._on_apply_reasoner_model)
        apply_plan_resolver_btn.clicked.connect(self._on_apply_plan_resolver_model)
        apply_explainer_btn.clicked.connect(self._on_apply_explainer_model)
        apply_explain_discovery_btn.clicked.connect(self._on_apply_explain_discovery_model)
        apply_explain_planner_btn.clicked.connect(self._on_apply_explain_planner_model)

        return menu

    def _open_settings_menu(self) -> None:
        btn_pos = self._settings_btn.mapToGlobal(QtCore.QPoint(0, self._settings_btn.height()))
        self._settings_menu.exec(btn_pos)

    def _config_path(self) -> str:
        return os.path.join(os.path.dirname(__file__), "config.json")

    def _load_config(self) -> dict:
        try:
            with open(self._config_path(), "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def _save_config(self, data: dict) -> None:
        try:
            with open(self._config_path(), "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def _init_stack_settings(self) -> None:
        cfg = self._load_config()
        host = cfg.get("ollama_host") or "http://localhost:11434"
        base_model = cfg.get("ollama_model") or "gpt-oss:20b-cloud"
        planner_model = cfg.get("ollama_planner_model") or base_model
        task_planner_model = cfg.get("ollama_task_planner_model") or planner_model
        tool_model = cfg.get("ollama_tool_model") or base_model
        final_model = cfg.get("ollama_final_model") or base_model
        summary_model = cfg.get("ollama_summary_model") or final_model
        translator_model = cfg.get("ollama_translator_model") or base_model
        coder_model = cfg.get("ollama_coder_model") or base_model
        debugger_model = cfg.get("ollama_debugger_model") or coder_model
        request_manager_model = cfg.get("ollama_request_manager_model") or base_model
        project_manager_model = cfg.get("ollama_project_manager_model") or base_model
        project_planner_model = cfg.get("ollama_project_planner_model") or base_model
        route_planner_model = cfg.get("ollama_route_planner_model") or base_model
        plan_enhancer_model = cfg.get("ollama_plan_enhancer_model") or base_model
        function_planner_model = cfg.get("ollama_function_planner_model") or base_model
        discovery_model = cfg.get("ollama_discovery_model") or base_model
        reasoner_model = cfg.get("ollama_reasoner_model") or base_model
        plan_resolver_model = cfg.get("ollama_plan_resolver_model") or base_model
        explainer_model = cfg.get("ollama_explainer_model") or base_model
        explain_discovery_model = cfg.get("ollama_explain_discovery_model") or base_model
        explain_planner_model = cfg.get("ollama_explain_planner_model") or base_model

        cfg["ollama_planner_model"] = planner_model
        cfg["ollama_task_planner_model"] = task_planner_model
        cfg["ollama_tool_model"] = tool_model
        cfg["ollama_final_model"] = final_model
        cfg["ollama_summary_model"] = summary_model
        cfg["ollama_translator_model"] = translator_model
        cfg["ollama_coder_model"] = coder_model
        cfg["ollama_debugger_model"] = debugger_model
        cfg["ollama_request_manager_model"] = request_manager_model
        cfg["ollama_project_manager_model"] = project_manager_model
        cfg["ollama_project_planner_model"] = project_planner_model
        cfg["ollama_route_planner_model"] = route_planner_model
        cfg["ollama_plan_enhancer_model"] = plan_enhancer_model
        cfg["ollama_function_planner_model"] = function_planner_model
        cfg["ollama_discovery_model"] = discovery_model
        cfg["ollama_reasoner_model"] = reasoner_model
        cfg["ollama_plan_resolver_model"] = plan_resolver_model
        cfg["ollama_explainer_model"] = explainer_model
        cfg["ollama_explain_discovery_model"] = explain_discovery_model
        cfg["ollama_explain_planner_model"] = explain_planner_model
        cfg["ollama_model"] = base_model
        self._save_config(cfg)

        self._host_input.setText(host)
        self._agent.set_host(host)
        self._agent.set_planner_model(planner_model)
        self._agent.set_task_planner_model(task_planner_model)
        self._agent.set_tool_model(tool_model)
        self._agent.set_final_model(final_model)
        self._agent.set_summary_model(summary_model)
        self._agent.set_translator_model(translator_model)
        self._agent.set_coder_model(coder_model)
        self._agent.set_debugger_model(debugger_model)
        self._agent.set_request_manager_model(request_manager_model)
        self._agent.set_project_manager_model(project_manager_model)
        self._agent.set_project_planner_model(project_planner_model)
        self._agent.set_route_planner_model(route_planner_model)
        self._agent.set_plan_enhancer_model(plan_enhancer_model)
        self._agent.set_function_planner_model(function_planner_model)
        self._agent.set_discovery_model(discovery_model)
        self._agent.set_reasoner_model(reasoner_model)
        self._agent.set_plan_resolver_model(plan_resolver_model)
        self._agent.set_explainer_model(explainer_model)
        self._agent.set_explain_discovery_model(explain_discovery_model)
        self._agent.set_explain_planner_model(explain_planner_model)
        self._log_line("SYS", f"Host Ollama: {host}")
        self._log_line("SYS", f"Planner model: {planner_model}")
        self._log_line("SYS", f"Task planner model: {task_planner_model}")
        self._log_line("SYS", f"Tool-caller model: {tool_model}")
        self._log_line("SYS", f"Final model: {final_model}")
        self._log_line("SYS", f"Summary model: {summary_model}")
        self._log_line("SYS", f"Translator model: {translator_model}")
        self._log_line("SYS", f"Coder model: {coder_model}")
        self._log_line("SYS", f"Debugger model: {debugger_model}")
        self._on_refresh_models(
            select_planner=planner_model,
            select_task_planner=task_planner_model,
            select_tool=tool_model,
            select_final=final_model,
            select_summary=summary_model,
            select_translator=translator_model,
            select_coder=coder_model,
            select_debugger=debugger_model,
            select_request_manager=request_manager_model,
            select_project_manager=project_manager_model,
            select_project_planner=project_planner_model,
            select_route_planner=route_planner_model,
            select_plan_enhancer=plan_enhancer_model,
            select_function_planner=function_planner_model,
            select_discovery=discovery_model,
            select_reasoner=reasoner_model,
            select_plan_resolver=plan_resolver_model,
            select_explainer=explainer_model,
            select_explain_discovery=explain_discovery_model,
            select_explain_planner=explain_planner_model,
        )

    def _on_save_host(self) -> None:
        host = self._host_input.text().strip()
        if not host:
            return
        err = self._validate_host(host)
        if err:
            self._log_line("ERROR", f"Host non valido: {err}")
            self._mark_host_invalid(True)
            self._host_input.setToolTip(err)
            return
        self._mark_host_invalid(False)
        self._host_input.setToolTip("")
        self._agent.set_host(host)
        cfg = self._load_config()
        cfg["ollama_host"] = host
        self._save_config(cfg)
        self._log_line("SYS", f"Host Ollama salvato: {host}")

    def _on_refresh_models(
        self,
        select_planner: str | None = None,
        select_task_planner: str | None = None,
        select_tool: str | None = None,
        select_final: str | None = None,
        select_summary: str | None = None,
        select_translator: str | None = None,
        select_coder: str | None = None,
        select_debugger: str | None = None,
        select_request_manager: str | None = None,
        select_project_manager: str | None = None,
        select_project_planner: str | None = None,
        select_route_planner: str | None = None,
        select_plan_enhancer: str | None = None,
        select_function_planner: str | None = None,
        select_discovery: str | None = None,
        select_reasoner: str | None = None,
        select_plan_resolver: str | None = None,
        select_explainer: str | None = None,
        select_explain_discovery: str | None = None,
        select_explain_planner: str | None = None,
    ) -> None:
        host = self._host_input.text().strip() or "http://localhost:11434"
        err = self._validate_host(host)
        if err:
            self._log_line("ERROR", f"Host non valido: {err}")
            self._mark_host_invalid(True)
            self._host_input.setToolTip(err)
            return
        self._mark_host_invalid(False)
        self._host_input.setToolTip("")
        models = self._fetch_models(host)
        self._planner_model_combo.clear()
        self._planner_model_combo.addItems(models)
        self._task_planner_model_combo.clear()
        self._task_planner_model_combo.addItems(models)
        self._tool_model_combo.clear()
        self._tool_model_combo.addItems(models)
        self._final_model_combo.clear()
        self._final_model_combo.addItems(models)
        self._summary_model_combo.clear()
        self._summary_model_combo.addItems(models)
        self._translator_model_combo.clear()
        self._translator_model_combo.addItems(models)
        self._coder_model_combo.clear()
        self._coder_model_combo.addItems(models)
        self._debugger_model_combo.clear()
        self._debugger_model_combo.addItems(models)
        for combo, sel in [
            (self._request_manager_model_combo, select_request_manager),
            (self._project_manager_model_combo, select_project_manager),
            (self._project_planner_model_combo, select_project_planner),
            (self._route_planner_model_combo, select_route_planner),
            (self._plan_enhancer_model_combo, select_plan_enhancer),
            (self._function_planner_model_combo, select_function_planner),
            (self._discovery_model_combo, select_discovery),
            (self._reasoner_model_combo, select_reasoner),
            (self._plan_resolver_model_combo, select_plan_resolver),
            (self._explainer_model_combo, select_explainer),
            (self._explain_discovery_model_combo, select_explain_discovery),
            (self._explain_planner_model_combo, select_explain_planner),
        ]:
            combo.clear()
            combo.addItems(models)
            if sel and sel in models:
                combo.setCurrentText(sel)
            elif models:
                combo.setCurrentIndex(0)
        if select_planner and select_planner in models:
            self._planner_model_combo.setCurrentText(select_planner)
        elif models:
            self._planner_model_combo.setCurrentIndex(0)
        if select_task_planner and select_task_planner in models:
            self._task_planner_model_combo.setCurrentText(select_task_planner)
        elif models:
            self._task_planner_model_combo.setCurrentIndex(0)
        if select_tool and select_tool in models:
            self._tool_model_combo.setCurrentText(select_tool)
        elif models:
            self._tool_model_combo.setCurrentIndex(0)
        if select_final and select_final in models:
            self._final_model_combo.setCurrentText(select_final)
        elif models:
            self._final_model_combo.setCurrentIndex(0)
        if select_summary and select_summary in models:
            self._summary_model_combo.setCurrentText(select_summary)
        elif models:
            self._summary_model_combo.setCurrentIndex(0)
        if select_translator and select_translator in models:
            self._translator_model_combo.setCurrentText(select_translator)
        elif models:
            self._translator_model_combo.setCurrentIndex(0)
        if select_coder and select_coder in models:
            self._coder_model_combo.setCurrentText(select_coder)
        elif models:
            self._coder_model_combo.setCurrentIndex(0)
        if select_debugger and select_debugger in models:
            self._debugger_model_combo.setCurrentText(select_debugger)
        elif models:
            self._debugger_model_combo.setCurrentIndex(0)

    def _on_apply_planner_model(self) -> None:
        model = self._planner_model_combo.currentText().strip()
        if not model:
            return
        self._agent.set_planner_model(model)
        cfg = self._load_config()
        cfg["ollama_planner_model"] = model
        self._save_config(cfg)
        self._log_line("SYS", f"Planner model: {model}")

    def _on_apply_task_planner_model(self) -> None:
        model = self._task_planner_model_combo.currentText().strip()
        if not model:
            return
        self._agent.set_task_planner_model(model)
        cfg = self._load_config()
        cfg["ollama_task_planner_model"] = model
        self._save_config(cfg)
        self._log_line("SYS", f"Task planner model: {model}")

    def _on_apply_tool_model(self) -> None:
        model = self._tool_model_combo.currentText().strip()
        if not model:
            return
        self._agent.set_tool_model(model)
        cfg = self._load_config()
        cfg["ollama_tool_model"] = model
        self._save_config(cfg)
        self._log_line("SYS", f"Tool-caller model: {model}")

    def _on_apply_final_model(self) -> None:
        model = self._final_model_combo.currentText().strip()
        if not model:
            return
        self._agent.set_final_model(model)
        cfg = self._load_config()
        cfg["ollama_final_model"] = model
        self._save_config(cfg)
        self._log_line("SYS", f"Final model: {model}")

    def _on_apply_summary_model(self) -> None:
        model = self._summary_model_combo.currentText().strip()
        if not model:
            return
        self._agent.set_summary_model(model)
        cfg = self._load_config()
        cfg["ollama_summary_model"] = model
        self._save_config(cfg)
        self._log_line("SYS", f"Summary model: {model}")

    def _on_apply_translator_model(self) -> None:
        model = self._translator_model_combo.currentText().strip()
        if not model:
            return
        self._agent.set_translator_model(model)
        cfg = self._load_config()
        cfg["ollama_translator_model"] = model
        self._save_config(cfg)
        self._log_line("SYS", f"Translator model: {model}")

    def _on_apply_coder_model(self) -> None:
        model = self._coder_model_combo.currentText().strip()
        if not model:
            return
        self._agent.set_coder_model(model)
        cfg = self._load_config()
        cfg["ollama_coder_model"] = model
        self._save_config(cfg)
        self._log_line("SYS", f"Coder model: {model}")

    def _on_apply_debugger_model(self) -> None:
        model = self._debugger_model_combo.currentText().strip()
        if not model:
            return
        self._agent.set_debugger_model(model)
        cfg = self._load_config()
        cfg["ollama_debugger_model"] = model
        self._save_config(cfg)
        self._log_line("SYS", f"Debugger model: {model}")

    def _on_apply_request_manager_model(self) -> None:
        model = self._request_manager_model_combo.currentText().strip()
        if not model:
            return
        self._agent.set_request_manager_model(model)
        cfg = self._load_config()
        cfg["ollama_request_manager_model"] = model
        self._save_config(cfg)
        self._log_line("SYS", f"Request manager model: {model}")

    def _on_apply_project_manager_model(self) -> None:
        model = self._project_manager_model_combo.currentText().strip()
        if not model:
            return
        self._agent.set_project_manager_model(model)
        cfg = self._load_config()
        cfg["ollama_project_manager_model"] = model
        self._save_config(cfg)
        self._log_line("SYS", f"Project manager model: {model}")

    def _on_apply_project_planner_model(self) -> None:
        model = self._project_planner_model_combo.currentText().strip()
        if not model:
            return
        self._agent.set_project_planner_model(model)
        cfg = self._load_config()
        cfg["ollama_project_planner_model"] = model
        self._save_config(cfg)
        self._log_line("SYS", f"Project planner model: {model}")

    def _on_apply_route_planner_model(self) -> None:
        model = self._route_planner_model_combo.currentText().strip()
        if not model:
            return
        self._agent.set_route_planner_model(model)
        cfg = self._load_config()
        cfg["ollama_route_planner_model"] = model
        self._save_config(cfg)
        self._log_line("SYS", f"Route planner model: {model}")

    def _on_apply_plan_enhancer_model(self) -> None:
        model = self._plan_enhancer_model_combo.currentText().strip()
        if not model:
            return
        self._agent.set_plan_enhancer_model(model)
        cfg = self._load_config()
        cfg["ollama_plan_enhancer_model"] = model
        self._save_config(cfg)
        self._log_line("SYS", f"Plan enhancer model: {model}")

    def _on_apply_function_planner_model(self) -> None:
        model = self._function_planner_model_combo.currentText().strip()
        if not model:
            return
        self._agent.set_function_planner_model(model)
        cfg = self._load_config()
        cfg["ollama_function_planner_model"] = model
        self._save_config(cfg)
        self._log_line("SYS", f"Function planner model: {model}")

    def _on_apply_discovery_model(self) -> None:
        model = self._discovery_model_combo.currentText().strip()
        if not model:
            return
        self._agent.set_discovery_model(model)
        cfg = self._load_config()
        cfg["ollama_discovery_model"] = model
        self._save_config(cfg)
        self._log_line("SYS", f"Discovery model: {model}")

    def _on_apply_reasoner_model(self) -> None:
        model = self._reasoner_model_combo.currentText().strip()
        if not model:
            return
        self._agent.set_reasoner_model(model)
        cfg = self._load_config()
        cfg["ollama_reasoner_model"] = model
        self._save_config(cfg)
        self._log_line("SYS", f"Reasoner model: {model}")

    def _on_apply_plan_resolver_model(self) -> None:
        model = self._plan_resolver_model_combo.currentText().strip()
        if not model:
            return
        self._agent.set_plan_resolver_model(model)
        cfg = self._load_config()
        cfg["ollama_plan_resolver_model"] = model
        self._save_config(cfg)
        self._log_line("SYS", f"Plan resolver model: {model}")

    def _on_apply_explainer_model(self) -> None:
        model = self._explainer_model_combo.currentText().strip()
        if not model:
            return
        self._agent.set_explainer_model(model)
        cfg = self._load_config()
        cfg["ollama_explainer_model"] = model
        self._save_config(cfg)
        self._log_line("SYS", f"Explainer model: {model}")

    def _on_apply_explain_discovery_model(self) -> None:
        model = self._explain_discovery_model_combo.currentText().strip()
        if not model:
            return
        self._agent.set_explain_discovery_model(model)
        cfg = self._load_config()
        cfg["ollama_explain_discovery_model"] = model
        self._save_config(cfg)
        self._log_line("SYS", f"Explain discovery model: {model}")

    def _on_apply_explain_planner_model(self) -> None:
        model = self._explain_planner_model_combo.currentText().strip()
        if not model:
            return
        self._agent.set_explain_planner_model(model)
        cfg = self._load_config()
        cfg["ollama_explain_planner_model"] = model
        self._save_config(cfg)
        self._log_line("SYS", f"Explain planner model: {model}")

    def _fetch_models(self, host: str) -> list[str]:
        url = f"{host.rstrip('/')}/api/tags"
        retries = 3
        delay = 0.6
        last_exc: Exception | None = None
        for attempt in range(1, retries + 1):
            try:
                resp = requests.get(url, timeout=(3, 6))
                resp.raise_for_status()
                data = resp.json()
                return [m.get("name") for m in data.get("models", []) if m.get("name")]
            except Exception as exc:
                last_exc = exc
                if attempt < retries:
                    time.sleep(delay)
                    delay *= 1.8
        self._log_line("ERROR", f"Impossibile leggere modelli da {host}: {last_exc}")
        return []

    def _validate_host(self, host: str) -> str | None:
        try:
            parsed = urlparse(host)
        except Exception:
            return "URL non valido"
        if parsed.scheme not in ("http", "https"):
            return "Schema non valido (usa http o https)"
        if not parsed.hostname:
            return "Host mancante"
        if parsed.port is None:
            return "Porta mancante (es. :11434)"
        return None

    def _mark_host_invalid(self, invalid: bool) -> None:
        if invalid:
            self._host_input.setStyleSheet("border: 1px solid #c0392b;")
        else:
            self._host_input.setStyleSheet("")

    def _load_base_dir(self) -> str | None:
        data = self._load_config()
        value = data.get("base_dir")
        return value if isinstance(value, str) and value else None

    def _save_base_dir(self, base_dir: str) -> None:
        data = self._load_config()
        data["base_dir"] = base_dir
        self._save_config(data)


def main() -> None:
    app = QtWidgets.QApplication([])
    window = MainWindow()
    window.show()
    app.exec()


if __name__ == "__main__":
    main()





