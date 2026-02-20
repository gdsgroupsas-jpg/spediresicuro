from __future__ import annotations

import os
import glob
import json
import sys
import re
import time
from typing import Iterable, Tuple

# Default 2 sec tra una request e l'altra ai modelli (test e flussi).
os.environ.setdefault("OLLAMA_REQUEST_DELAY", "2")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from agent.core import Agent


def load_config() -> dict:
    try:
        with open('config.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def ts() -> str:
    return time.strftime("%H:%M:%S")


def log_line(fp, kind: str, text: str) -> None:
    fp.write(f"[{ts()}] {kind}: {text}\n")
    fp.flush()



def compute_allowed_files(name: str, prompt: str) -> list[str]:
    # Per-test allowlist to scope the model "workspace" to only the working assets
    # relevant to the test (fixtures, explicitly-invoked tests, etc.).
    #
    # Intentionally do NOT include the test log or plan json; those are runner
    # artifacts and should not influence file/path selection.
    allowed: set[str] = set()

    # Explicit file mentions in the prompt (evita path con punto finale, es. "libref.pyi.").
    for m in re.findall(r"(?:tests/fixtures|tests)/[A-Za-z0-9_./-]+", prompt):
        allowed.add(m.rstrip("."))

    if "tests/fixtures/batch_edit" in prompt:
        for p in glob.glob("tests/fixtures/batch_edit/*"):
            allowed.add(p.replace("\\", "/"))

    if "config.json" in prompt:
        allowed.add("config.json")

    for m in re.findall(r"pytest\s+-q\s+([A-Za-z0-9_./-]+)", prompt):
        allowed.add(m)

    # Cross-file AST move needs both fixtures visible throughout the run.
    if name == "ast_cross_move":
        allowed.add("tests/fixtures/ast_cross_a.py")
        allowed.add("tests/fixtures/ast_cross_b.py")

    # refactor_dist: lo stub .pyi deve essere in workdir (altrimenti replace_text non ha path valido).
    if name == "refactor_dist":
        allowed.add("tests/fixtures/libref.pyi")

    # config_multi2: solo cartella fixtures (nessun config.json in root).
    if name == "config_multi2":
        allowed.add("tests/fixtures/config.json")
        allowed.add("tests/fixtures/config_like.txt")
        allowed.add("tests/fixtures/config_multi2.json")
        allowed.add("tests/fixtures/config_multi2.yaml")
        allowed.add("tests/fixtures/config_multi2.ini")
        allowed.add("tests/fixtures/config_multi2.env")

    # diff_repair: file unico da modificare.
    if name == "diff_repair":
        allowed.add("tests/fixtures/diff_target.txt")

    # retry_limit: solo retry_a.py ha path completo nel prompt; gli altri vanno inclusi esplicitamente.
    if name == "retry_limit":
        allowed.add("tests/fixtures/retry_a.py")
        allowed.add("tests/fixtures/retry_b.py")
        allowed.add("tests/fixtures/retry_main.py")

    # human_bytes: modulo da implementare + test pytest.
    if name == "human_bytes":
        allowed.add("tests/fixtures/util_feat.py")
        allowed.add("tests/fixtures/test_util_feat.py")

    # slugify_adv: modulo slugify + test pytest.
    if name == "slugify_adv":
        allowed.add("tests/fixtures/util_slug.py")
        allowed.add("tests/fixtures/test_util_slug.py")

    # ast_types_hints: modulo ast_types per type hints e python_exec.
    if name == "ast_types_hints":
        allowed.add("tests/fixtures/ast_types.py")

    # diff_multi_hunk: un solo file da modificare con diff a più hunk.
    if name == "diff_multi_hunk":
        allowed.add("tests/fixtures/diff_multi_target.txt")

    # long_file_edit: file lungo, modifica una riga al centro.
    if name == "long_file_edit":
        allowed.add("tests/fixtures/long_edit_sample.py")

    # nested_config: solo nested_config.json (no config.json in root).
    if name == "nested_config":
        allowed.add("tests/fixtures/nested_config.json")
        allowed.discard("config.json")

    # error_chain: primo fix da error_log_chain, poi pytest, eventuale secondo fix.
    if name == "error_chain":
        allowed.add("tests/fixtures/error_log_chain.txt")
        allowed.add("tests/fixtures/two_bugs_sample.py")
        allowed.add("tests/fixtures/test_two_bugs.py")

    # --- 5 test difficili ad hoc per il framework ---
    if name == "hard_pipeline_mypy":
        allowed.add("tests/fixtures/pipeline_mypy_sample.py")
    if name == "hard_config_five_formats":
        allowed.add("tests/fixtures/config_five.json")
        allowed.add("tests/fixtures/config_five.yaml")
        allowed.add("tests/fixtures/config_five.ini")
        allowed.add("tests/fixtures/config_five.env")
        allowed.add("tests/fixtures/config_five.txt")
        allowed.discard("config.json")  # no root config
    if name == "hard_add_type_hints":
        allowed.add("tests/fixtures/type_hints_sample.py")
    if name == "hard_move_method_types":
        allowed.add("tests/fixtures/ast_move_types_a.py")
        allowed.add("tests/fixtures/ast_move_types_b.py")
    if name == "hard_json_yaml_deep":
        allowed.add("tests/fixtures/deep_config.json")
        allowed.add("tests/fixtures/deep_config.yaml")

    # Easy generic tests
    if name == "easy_count_dir":
        allowed.add("tests/fixtures")
    if name == "easy_stat_path":
        allowed.add("tests/fixtures/easy_stat_target.txt")
    if name == "easy_read_lines":
        allowed.add("tests/fixtures/easy_read_lines_target.txt")
    if name == "easy_append":
        allowed.add("tests/fixtures/easy_append_log.txt")
    if name == "easy_replace_simple":
        allowed.add("tests/fixtures/easy_replace_target.txt")
    if name == "easy_ast_outline":
        allowed.add("tests/fixtures/easy_ast_sample.py")
    if name == "easy_ast_imports":
        allowed.add("tests/fixtures/easy_imports_sample.py")
    if name == "easy_glob":
        allowed.add("tests/fixtures/easy_glob_a.py")
        allowed.add("tests/fixtures/easy_glob_b.py")
    if name == "easy_file_hash":
        allowed.add("tests/fixtures/easy_hash_target.txt")

    # Hard generic tests
    if name == "hard_multi_const":
        allowed.add("tests/fixtures/easy_const_a.py")
        allowed.add("tests/fixtures/easy_const_b.py")
    if name == "hard_fix_traceback":
        allowed.add("tests/fixtures/easy_buggy_sample.py")
        allowed.add("tests/fixtures/easy_traceback.txt")
        allowed.add("tests/fixtures/test_easy_buggy.py")
    if name == "hard_nested_json":
        allowed.add("tests/fixtures/easy_nested.json")
    if name == "hard_rename_cross":
        allowed.add("tests/fixtures/easy_calc_module.py")
        allowed.add("tests/fixtures/easy_calc_user.py")
        allowed.add("tests/fixtures/test_easy_calc.py")
    if name == "hard_config_three":
        allowed.add("tests/fixtures/easy_config.json")
        allowed.add("tests/fixtures/easy_config.yaml")
        allowed.add("tests/fixtures/easy_config.ini")
        allowed.discard("config.json")
    if name == "hard_docstring_update":
        allowed.add("tests/fixtures/easy_doc_module.py")

    # Channel tests (Request Manager -> project|debug|explain)
    if name == "channel_project":
        allowed.add("tests/fixtures/channel_project_target.py")
    if name == "channel_debug":
        allowed.add("tests/fixtures/channel_debug_target.py")
        allowed.add("tests/fixtures/test_channel_debug.py")
        allowed.add("tests/fixtures/channel_debug_error.txt")
    if name == "channel_explain":
        allowed.add("tests/fixtures/channel_explain_target.py")

    return sorted({p.replace("\\", "/").rstrip(".") for p in allowed})

def _reset_batch_edit_fixtures() -> None:
    root = os.path.join("tests", "fixtures", "batch_edit")
    for name in ("config_a.py", "config_b.py", "config_c.py"):
        path = os.path.join(root, name)
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write('API_URL = "https://old.example.com/api"\n')
        except Exception:
            pass



def _reset_ast_move_sample_fixture() -> None:
    path = os.path.join('tests', 'fixtures', 'ast_move_sample.py')
    src = '''class Alpha:
    def ping(self) -> str:
        return "alpha"

class Beta:
    def ping(self) -> str:
        return "beta"

    def beta_extra(self):
        return "beta extra"
'''
    try:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(src)
    except Exception:
        pass


def _reset_resilient_fixture() -> None:
    path = os.path.join("tests", "fixtures", "resilient_target.py")
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write("MAGIC_FLAG = False\n")
    except Exception:
        pass


def _reset_ast_cross_fixtures() -> None:
    a_path = os.path.join('tests', 'fixtures', 'ast_cross_a.py')
    b_path = os.path.join('tests', 'fixtures', 'ast_cross_b.py')
    a_src = (
        'class Foo:\n'
        '    def util(self):\n'
        '        return "ok"\n\n'
        'class Placeholder:\n'
        '    pass\n'
    )
    b_src = (
        'class Bar:\n'
        '    def ping(self) -> str:\n'
        '        return "bar"\n'
    )
    try:
        with open(a_path, 'w', encoding='utf-8') as f:
            f.write(a_src)
    except Exception:
        pass
    try:
        with open(b_path, 'w', encoding='utf-8') as f:
            f.write(b_src)
    except Exception:
        pass


def _reset_diff_multi_hunk_fixture() -> None:
    """Ripristina diff_multi_target.txt per diff_multi_hunk."""
    path = os.path.join("tests", "fixtures", "diff_multi_target.txt")
    content = (
        "# Block A\n"
        "first\n"
        "second\n"
        "third\n\n"
        "# Block B\n"
        "alpha\n"
        "beta\n"
        "gamma\n\n"
        "# Block C\n"
        "one\n"
        "two\n"
        "three\n"
    )
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception:
        pass


def _reset_long_file_edit_fixture() -> None:
    """Ripristina long_edit_sample.py per long_file_edit (TARGET_CONSTANT = change_me_to_updated)."""
    path = os.path.join("tests", "fixtures", "long_edit_sample.py")
    long_src = (
        "# Long fixture for testing single-line edit in the middle (line ~45).\n"
        "# Do not remove or reorder blocks; only the TARGET_CONSTANT line should change.\n\n"
        "CONFIG_A = \"default\"\n"
        "CONFIG_B = \"default\"\n"
        "CONFIG_C = \"default\"\n\n"
        "def helper_1():\n    return 1\n"
        "def helper_2():\n    return 2\n"
        "def helper_3():\n    return 3\n"
        "def helper_4():\n    return 4\n"
        "def helper_5():\n    return 5\n\n"
        "# ---- middle block ----\n"
        "TARGET_CONSTANT = \"change_me_to_updated\"\n"
        "# ---- end middle ----\n\n"
        "def helper_6():\n    return 6\n"
        "def helper_7():\n    return 7\n"
        "def helper_8():\n    return 8\n"
        "def helper_9():\n    return 9\n"
        "def helper_10():\n    return 10\n\n"
        "def main():\n    return TARGET_CONSTANT\n"
    )
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(long_src)
    except Exception:
        pass


def _reset_nested_config_fixture() -> None:
    """Ripristina nested_config.json per nested_config (debug: false)."""
    path = os.path.join("tests", "fixtures", "nested_config.json")
    content = (
        "{\n"
        '  "config": {\n'
        '    "features": {\n'
        '      "debug": false,\n'
        '      "verbose": true\n'
        "    },\n"
        '    "server": {\n'
        '      "port": 8080,\n'
        '      "host": "localhost"\n'
        "    }\n"
        "  }\n"
        "}\n"
    )
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception:
        pass


def _reset_error_chain_fixtures() -> None:
    """Ripristina i fixture per error_chain: due bug in two_bugs_sample.py."""
    base = os.path.join("tests", "fixtures")
    two_bugs_src = (
        "# First bug: foo() raises NameError (see error_log_chain.txt).\n"
        "# Second bug: bar() returns 2 but test expects 3.\n\n"
        "def foo():\n"
        "    return undefined_var  # NameError - fix by returning a value, e.g. 0\n\n"
        "def bar():\n"
        "    return 2  # test expects 3 - fix to return 3\n"
    )
    try:
        with open(os.path.join(base, "two_bugs_sample.py"), "w", encoding="utf-8") as f:
            f.write(two_bugs_src)
    except Exception:
        pass


def _reset_config_multi2_fixtures() -> None:
    """Ripristina i fixture per config_multi2: stato iniziale prima della sync a v4/4/true."""
    base = os.path.join("tests", "fixtures")
    fixtures = [
        (os.path.join(base, "config.json"), '{"API_URL": "https://old.example.com", "version": 1, "feature_x": false}\n'),
        (os.path.join(base, "config_multi2.json"), '{"API_URL": "https://old.example.com", "version": 1, "feature_x": false}\n'),
        (os.path.join(base, "config_multi2.yaml"), "API_URL: https://old.example.com\nversion: 1\nfeature_x: false\n"),
        (os.path.join(base, "config_multi2.ini"), "API_URL=https://old.example.com\nversion=1\nfeature_x=false\n"),
        (os.path.join(base, "config_multi2.env"), "API_URL=https://old.example.com\nVERSION=1\nFEATURE_X=false\n"),
        (os.path.join(base, "config_like.txt"), "API_URL=https://old.example.com\nversion=1\nfeature_x=false\n"),
    ]
    for path, content in fixtures:
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception:
            pass


def _reset_hard_pipeline_mypy_fixture() -> None:
    """Ripristina pipeline_mypy_sample.py: get_value ritorna str ma tipo dichiarato int."""
    path = os.path.join("tests", "fixtures", "pipeline_mypy_sample.py")
    src = (
        '"""Fixture per hard_pipeline_mypy: errore di tipo che mypy rileva e il Debugger deve correggere."""\n\n'
        'def get_value() -> int:\n'
        '    return "hello"  # type error: ritorna str ma il tipo dichiarato è int\n'
    )
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(src)
    except Exception:
        pass


def _reset_hard_config_five_fixtures() -> None:
    """Ripristina config_five.* con LOG_LEVEL=INFO."""
    base = os.path.join("tests", "fixtures")
    fixtures = [
        (os.path.join(base, "config_five.json"), '{"LOG_LEVEL": "INFO"}\n'),
        (os.path.join(base, "config_five.yaml"), "LOG_LEVEL: INFO\n"),
        (os.path.join(base, "config_five.ini"), "[default]\nLOG_LEVEL = INFO\n"),
        (os.path.join(base, "config_five.env"), "LOG_LEVEL=INFO\n"),
        (os.path.join(base, "config_five.txt"), "LOG_LEVEL=INFO\n"),
    ]
    for p, c in fixtures:
        try:
            with open(p, "w", encoding="utf-8") as f:
                f.write(c)
        except Exception:
            pass


def _reset_hard_add_type_hints_fixture() -> None:
    """Ripristina type_hints_sample.py senza type hints."""
    path = os.path.join("tests", "fixtures", "type_hints_sample.py")
    src = (
        '"""Modulo senza type hints: l\'agente deve aggiungerli."""\n\n'
        "def add(a, b):\n    return a + b\n\n"
        "def greet(name):\n    return f\"Hi {name}\"\n"
    )
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(src)
    except Exception:
        pass


def _reset_hard_move_method_types_fixtures() -> None:
    """Ripristina ast_move_types_a.py e ast_move_types_b.py per move + type hint."""
    base = os.path.join("tests", "fixtures")
    a_src = "class SourceClass:\n    def helper(self):\n        return \"moved_value\"\n"
    b_src = "class TargetClass:\n    pass\n"
    try:
        with open(os.path.join(base, "ast_move_types_a.py"), "w", encoding="utf-8") as f:
            f.write(a_src)
    except Exception:
        pass
    try:
        with open(os.path.join(base, "ast_move_types_b.py"), "w", encoding="utf-8") as f:
            f.write(b_src)
    except Exception:
        pass


def _reset_hard_json_yaml_deep_fixtures() -> None:
    """Ripristina deep_config.json e deep_config.yaml con level INFO."""
    base = os.path.join("tests", "fixtures")
    json_src = '{\n  "app": {\n    "logging": {\n      "level": "INFO"\n    }\n  }\n}\n'
    yaml_src = "app:\n  logging:\n    level: INFO\n"
    try:
        with open(os.path.join(base, "deep_config.json"), "w", encoding="utf-8") as f:
            f.write(json_src)
    except Exception:
        pass
    try:
        with open(os.path.join(base, "deep_config.yaml"), "w", encoding="utf-8") as f:
            f.write(yaml_src)
    except Exception:
        pass


def _reset_channel_project_fixtures() -> None:
    """Ripristina channel_project_target.py per canale project (nuovo modulo)."""
    path = os.path.join("tests", "fixtures", "channel_project_target.py")
    content = "# Fixture per channel_project: modulo da creare/estendere.\n# Reset: file vuoto o contenuto iniziale prima del test.\n"
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception:
        pass


def _reset_channel_debug_fixtures() -> None:
    """Ripristina channel_debug_target.py con bug (add ritorna str concat)."""
    path = os.path.join("tests", "fixtures", "channel_debug_target.py")
    content = (
        '"""Fixture per channel_debug: add(a,b) con bug - ritorna concatenazione invece di somma."""\n\n'
        "def add(a, b):\n"
        "    return str(a) + str(b)  # BUG: should return a + b for numbers\n"
    )
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception:
        pass


def _reset_easy_fixtures() -> None:
    """Ripristina le fixture dei test facili generici."""
    base = os.path.join("tests", "fixtures")
    fixtures = [
        (os.path.join(base, "easy_append_log.txt"), "line1\n"),
        (os.path.join(base, "easy_replace_target.txt"), "OLD_VALUE\nDo not modify this line.\n"),
        (os.path.join(base, "easy_hash_target.txt"), "FIXED_CONTENT_FOR_HASH\nunchanged\n"),
    ]
    for path, content in fixtures:
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception:
            pass


def _reset_hard_multi_const_fixtures() -> None:
    """Ripristina easy_const_a e easy_const_b per hard_multi_const."""
    base = os.path.join("tests", "fixtures")
    a_src = '"""Shared constants for hard_multi_const test."""\nVERSION = "1.0"\nAPI_KEY = "placeholder"\n'
    b_src = '"""Uses constants from easy_const_a. Version v1.0."""\nfrom tests.fixtures.easy_const_a import VERSION\n\ndef get_version():\n    return VERSION\n'
    for path, content in [(os.path.join(base, "easy_const_a.py"), a_src), (os.path.join(base, "easy_const_b.py"), b_src)]:
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception:
            pass


def _reset_hard_fix_traceback_fixtures() -> None:
    """Ripristina easy_buggy_sample per hard_fix_traceback."""
    path = os.path.join("tests", "fixtures", "easy_buggy_sample.py")
    src = '"""Fixture for hard_fix_traceback: IndexError on empty list."""\ndef get_first(items):\n    return items[0]  # IndexError if items is empty\n'
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(src)
    except Exception:
        pass


def _reset_hard_nested_json_fixture() -> None:
    """Ripristina easy_nested.json per hard_nested_json."""
    path = os.path.join("tests", "fixtures", "easy_nested.json")
    content = '{\n  "app": {\n    "name": "test",\n    "settings": {\n      "database": {\n        "host": "localhost",\n        "port": 3306\n      }\n    }\n  }\n}\n'
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception:
        pass


def _reset_hard_rename_cross_fixtures() -> None:
    """Ripristina easy_calc_module e easy_calc_user per hard_rename_cross."""
    base = os.path.join("tests", "fixtures")
    mod_src = '"""Module with calc_sum for hard_rename_cross."""\ndef calc_sum(a: int, b: int) -> int:\n    return a + b\n'
    user_src = '"""Uses calc_sum from easy_calc_module."""\nfrom tests.fixtures.easy_calc_module import calc_sum\n\ndef total(x, y):\n    return calc_sum(x, y)\n'
    for path, content in [(os.path.join(base, "easy_calc_module.py"), mod_src), (os.path.join(base, "easy_calc_user.py"), user_src)]:
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception:
            pass


def _reset_hard_config_three_fixtures() -> None:
    """Ripristina easy_config.* per hard_config_three."""
    base = os.path.join("tests", "fixtures")
    fixtures = [
        (os.path.join(base, "easy_config.json"), '{"KEY": "value1"}\n'),
        (os.path.join(base, "easy_config.yaml"), "KEY: value1\n"),
        (os.path.join(base, "easy_config.ini"), "[default]\nKEY = value1\n"),
    ]
    for path, content in fixtures:
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception:
            pass


def _reset_hard_docstring_fixture() -> None:
    """Ripristina easy_doc_module per hard_docstring_update."""
    path = os.path.join("tests", "fixtures", "easy_doc_module.py")
    src = (
        '"""Module for hard_docstring_update: update all docstrings from v1 to v2."""\n\n'
        'def alpha():\n    """Returns 1. Version v1."""\n    return 1\n\n'
        'def beta(x):\n    """Returns x+1. Version v1."""\n    return x + 1\n\n'
        'def gamma(a, b):\n    """Returns a+b. Version v1."""\n    return a + b\n'
    )
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(src)
    except Exception:
        pass


def _reset_channel_explain_fixtures() -> None:
    """Ripristina channel_explain_target.py per canale explain."""
    path = os.path.join("tests", "fixtures", "channel_explain_target.py")
    content = (
        '"""Modulo semplice da spiegare per channel_explain."""\n\n'
        "def compute_total(a: int, b: int) -> int:\n"
        '    """Return the sum of a and b."""\n'
        "    return a + b\n\n"
        "def greet(name: str) -> str:\n"
        '    """Return a greeting for the given name."""\n'
        '    return f"Hello, {name}!"\n'
    )
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception:
        pass


def _reset_refactor_dist_fixtures() -> None:
    """Ripristina i fixture per refactor_dist: stato iniziale con compute_total."""
    base = os.path.join("tests", "fixtures")
    libref = os.path.join(base, "libref.py")
    service_ref = os.path.join(base, "service_ref.py")
    test_ref = os.path.join(base, "test_refactor_dist.py")
    libref_stub = os.path.join(base, "libref.pyi")
    libref_src = "# libref module for distributed refactor\n\ndef compute_total(a, b):\n    return a + b\n"
    service_src = "from .libref import compute_total\n\n__all__ = [\"compute_total\"]\n"
    test_src = (
        "from .libref import compute_total\n\n"
        "def test_compute_total_positive():\n"
        "    assert compute_total(2, 3) == 5\n\n"
        "def test_compute_total_zero():\n"
        "    assert compute_total(0, 0) == 0\n"
    )
    stub_src = "def compute_total(a: int, b: int) -> int: ...\n"
    for path, content in [
        (libref, libref_src),
        (service_ref, service_src),
        (test_ref, test_src),
        (libref_stub, stub_src),
    ]:
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception:
            pass


def run_test(name: str, prompt: str, agent: Agent, approval: bool = False) -> bool:
    path = os.path.join("tests", f"test_{name}.txt")
    ok = True
    planner_attempts = 0
    toolcaller_attempts = {}
    final_attempts = 0
    if name == "batch_replace_repo":
        _reset_batch_edit_fixtures()
    if name == "ast_move_method":
        _reset_ast_move_sample_fixture()
    if name == "ast_cross_move":
        _reset_ast_cross_fixtures()
    if name == "resilient_flag":
        _reset_resilient_fixture()
    if name == "refactor_dist":
        _reset_refactor_dist_fixtures()
    if name == "config_multi2":
        _reset_config_multi2_fixtures()
    if name == "error_chain":
        _reset_error_chain_fixtures()
    if name == "diff_multi_hunk":
        _reset_diff_multi_hunk_fixture()
    if name == "long_file_edit":
        _reset_long_file_edit_fixture()
    if name == "nested_config":
        _reset_nested_config_fixture()
    if name == "hard_pipeline_mypy":
        _reset_hard_pipeline_mypy_fixture()
    if name == "hard_config_five_formats":
        _reset_hard_config_five_fixtures()
    if name == "hard_add_type_hints":
        _reset_hard_add_type_hints_fixture()
    if name == "hard_move_method_types":
        _reset_hard_move_method_types_fixtures()
    if name == "hard_json_yaml_deep":
        _reset_hard_json_yaml_deep_fixtures()
    if name == "channel_project":
        _reset_channel_project_fixtures()
    if name == "channel_debug":
        _reset_channel_debug_fixtures()
    if name == "channel_explain":
        _reset_channel_explain_fixtures()
    if name in ("easy_append", "easy_replace_simple", "easy_file_hash"):
        _reset_easy_fixtures()
    if name == "hard_multi_const":
        _reset_hard_multi_const_fixtures()
    if name == "hard_fix_traceback":
        _reset_hard_fix_traceback_fixtures()
    if name == "hard_nested_json":
        _reset_hard_nested_json_fixture()
    if name == "hard_rename_cross":
        _reset_hard_rename_cross_fixtures()
    if name == "hard_config_three":
        _reset_hard_config_three_fixtures()
    if name == "hard_docstring_update":
        _reset_hard_docstring_fixture()
    with open(path, "w", encoding="utf-8") as f:
        log_line(f, "TEST", name)
        log_line(f, "PROMPT", prompt)
        log_line(f, "MODEL_INPUT", prompt)
        model_out = []
        error_fatal = False
        allowed_files = compute_allowed_files(name, prompt)
        for kind, text in agent.run(prompt, approval_handler=(lambda _args: True) if approval else None, allowed_files=allowed_files):
            if kind == "MODEL_TOKEN":
                model_out.append(text)
            else:
                log_line(f, kind, text)
                if kind == "PLAN":
                    log_line(f, "PLAN_JSON", text)
                if kind == "ERROR":
                    lower = text.lower()
                    if "retry" in lower or "repair" in lower:
                        pass
                    elif "tool failed" in lower:
                        pass
                    elif "0 replacement" in lower:
                        # replace_text/replace_in_repo con 0 sostituzioni: recuperabile (es. safe_write dopo)
                        pass
                    else:
                        error_fatal = True
                if kind == "ATTEMPT" and isinstance(text, str):
                    parts = text.split(":", 2)
                    if len(parts) == 3:
                        phase, tname, cnt = parts
                        try:
                            cnt_i = int(cnt)
                        except Exception:
                            cnt_i = 0
                        if phase == "planner":
                            planner_attempts = cnt_i
                        elif phase == "tool":
                            toolcaller_attempts[tname] = cnt_i
                        elif phase == "final":
                            final_attempts = cnt_i
        output_text = "".join(model_out).strip()
        if output_text:
            log_line(f, "MODEL_OUTPUT", output_text)
        log_line(f, "ATTEMPTS", f"planner={planner_attempts} toolcaller={toolcaller_attempts} final={final_attempts}")
        ok = not error_fatal
        log_line(f, "RESULT", "PASS" if ok else "FAIL")
        f.write("\n")
    return ok


def main() -> None:
    base = os.getcwd()
    cfg = load_config()
    host = os.environ.get('OLLAMA_HOST') or cfg.get('ollama_host') or 'http://localhost:11434'
    model = cfg.get('ollama_model') or 'gpt-oss:20b-cloud'
    agent = Agent(base_dir=base, model=model, host=host)

    os.makedirs("tests", exist_ok=True)

    # Reset automatico all'avvio: fixture easy, hard, channel (stato pulito prima dei test).
    _reset_easy_fixtures()
    _reset_hard_multi_const_fixtures()
    _reset_hard_fix_traceback_fixtures()
    _reset_hard_nested_json_fixture()
    _reset_hard_rename_cross_fixtures()
    _reset_hard_config_three_fixtures()
    _reset_hard_docstring_fixture()
    _reset_hard_pipeline_mypy_fixture()
    _reset_hard_config_five_fixtures()
    _reset_hard_add_type_hints_fixture()
    _reset_hard_move_method_types_fixtures()
    _reset_hard_json_yaml_deep_fixtures()
    _reset_channel_project_fixtures()
    _reset_channel_debug_fixtures()
    _reset_channel_explain_fixtures()

    test_map = {
        "list_dir": (
            "How many files and folders are in the base directory?",
            False,
        ),
        "search": (
            "Use search with path '.' and pattern 'Base dir'. Then tell me which files it appears in.",
            False,
        ),
        "read_file": (
            "Open and read main.py with read_file and tell me how many lines it has.",
            False,
        ),
        "write_file": (
            "Create a file named tmp_test.txt in the base dir with text 'ciao'. Use write_file.",
            True,
        ),
        "python_ast_find": (
            "Use ONLY the python_ast_find tool with path 'tools/python_tools.py' and name 'PythonTools'. Do not use other tools. Then respond with the result.",
            False,
        ),
        "python_project_deps_toml": (
            "Use ONLY the python_project_deps_toml tool with root '.'. Do not use other tools. Then respond with the dependencies found.",
            False,
        ),
        "preview_write": (
            "Use ONLY the preview_write tool with path 'tmp_preview.txt' and content 'uno\\n'. Do not use other tools. Then respond with the diff.",
            False,
        ),
        "apply_write_preview": (
            "First use ONLY preview_write to obtain expected_old_hash for path 'tmp_preview.txt' content 'uno\\ndue\\n'. Then use ONLY apply_write_preview with path 'tmp_preview.txt', content 'uno\\ndue\\n' and the obtained expected_old_hash. Do not use other tools.",
            True,
        ),
        "hard_multistep": (
            "Find where the active model is logged in tests/fixtures/hard_multistep_sample.py, then update the log message to include the word 'ACTIVE'. Use safe_write and report the change.",
            True,
        ),
        "hard_composite": (
            "Add a new log line after the 'Host Ollama' log in tests/fixtures/hard_composite_sample.py saying 'SYS: Stack initialized'. Use safe_write and report success.",
            True,
        ),
        "hard_analysis": (
            "List all class definitions in agent/core.py and tell me where each is referenced in the repo.",
            False,
        ),
        "hard_error": (
            "Attempt to read a non-existent file named does_not_exist_123.txt and explain the error.",
            False,
        ),
        "hard_regex": (
            "Search the repo for regex pattern 'def\\s+_on_[a-z_]+' and return up to 5 matches.",
            False,
        ),
        "refactor_semantic": (
            "Rename the method greet_person to greet_person in tests/fixtures/refactor_sample.py and update all references. Use safe_write and report the change.",
            True,
        ),
        "multi_file_coordination": (
            "Update API_VERSION to 'v2' in tests/fixtures/constants.py and update the comment in tests/fixtures/client.py to reflect v2. Use safe_write and report success.",
            True,
        ),
        "ast_driven_change": (
            "In tests/fixtures/ast_sample.py add a method def health_check(self): return True to every class. Use safe_write and report the change.",
            True,
        ),
        "ambiguity_handling": (
            "Update the logging message to include '[DEBUG]' prefix.",
            False,
        ),
        "safety_outside_base": (
            "Try to write a file outside the project (e.g., C:/Windows/Temp/agent_test.txt) and explain what happens.",
            False,
        ),
        "refactor_multi_file": (
            "Rename function compute_total to compute_sum in tests/fixtures/refactor_multi_b.py and update all references in tests/fixtures/refactor_multi_a.py. Use safe_write and report the change.",
            True,
        ),
        "bug_hunt_log": (
            "Using tests/fixtures/error_log.txt, find the bug in tests/fixtures/log_error_sample.py and fix it. Use safe_write and report the change.",
            True,
        ),
        "batch_replace_repo": (
            "Update API_URL from 'https://old.example.com/api' to 'https://new.example.com/api' across tests/fixtures/batch_edit using replace_in_repo. Report how many files changed.",
            True,
        ),
        "deps_sync": (
            "Synchronize dependencies: tests/fixtures/dep_project/pyproject.toml must include all packages from tests/fixtures/dep_project/requirements.txt. Use safe_write and report changes.",
            True,
        ),
        "ast_insert_method": (
            "Add def health_check(self): return True to every class in tests/fixtures/ast_insert_sample.py. Use safe_write and report the change.",
            True,
        ),
        "patch_apply_diff": (
            "Use apply_patch_unified to insert a new line 'line two and a half' between line two and line three in tests/fixtures/patch_target.txt. Report success.",
            True,
        ),
        "ambiguous_discovery": (
            "Update the version string to v2 in the config file. Find the file first, then make the change. Use safe_write and report the change.",
            True,
        ),
        "safe_preview_workflow_hard": (
            "Use preview_write to get expected_old_hash for tests/fixtures/patch_target.txt with content 'line one\\nline two\\nline two and a half\\nline three\\n'. Then use apply_write_preview with that hash. Report the result.",
            True,
        ),
        "config_sync": (
            "Ensure the API_URL is consistent in config.json and tests/fixtures/config_like.txt, set it to https://api.example.com/v2. Find the files, update both with safe_write, and report the change.",
            True,
        ),
        "ast_move_method": (
            "Move beta_extra from class Beta to class Alpha in tests/fixtures/ast_move_sample.py, removing it from Beta. Use safe_write, then run python_exec to assert Alpha().beta_extra() == 'beta extra' and Beta has no beta_extra. Report changes.",
            True,
        ),
        "new_function_slugify": (
            "Implement slugify(text) in tests/fixtures/util_new.py: lowercase, alnum only, spaces/underscores/hyphens to single hyphen, trim hyphens. Add a small self-check with python_exec showing slugify(\"Hello, World!\") == \"hello-world\". Use safe_write, report change.",
            True,
        ),
        "ast_cross_move": (
            "Move method util from class Foo in tests/fixtures/ast_cross_a.py to class Bar in tests/fixtures/ast_cross_b.py. Remove util from Foo. Use safe_write. Then run python_exec to assert Bar().util() == \"ok\" and Foo has no attribute util (AttributeError). Report changes.",
            True,
        ),
        "config_multi": (
            "Normalize API_URL to https://api.example.com/v3 and version to 3 across config.json, tests/fixtures/config_multi.yaml, tests/fixtures/config_multi.ini, and tests/fixtures/config_like.txt. Use safe_write and report diffs.",
            True,
        ),
        "resilient_flag": (
            "Set MAGIC_FLAG to True in the correct file. It appears only in tests/fixtures/resilient_target.py. Use replace_text; if no replacements, treat as failure. Report the change.",
            True,
        ),
        "libcalc_fix": (
            "Fix add(a,b) in tests/fixtures/libcalc.py to perform addition. Use safe_write, then run pytest -q tests/fixtures/test_libcalc.py. Report test result.",
            True,
        ),
        "refactor_dist": (
            "Rename function compute_total to compute_sum in tests/fixtures/libref.py and update all imports/call sites (tests/fixtures/service_ref.py, tests/fixtures/test_refactor_dist.py) and the stub tests/fixtures/libref.pyi. Use safe_write. Then run pytest -q tests/fixtures/test_refactor_dist.py to validate. Report changes and test result.",
            True,
        ),
        "config_multi2": (
            "Sync API_URL to https://api.example.com/v4, version to 4, feature_x to true across tests/fixtures/config.json, tests/fixtures/config_multi2.(json|yaml|ini|env) and tests/fixtures/config_like.txt. Use safe_write or write_file. Verify via python_exec that all values match; fail if mismatch.",
            True,
        ),
        "diff_repair": (
            "Apply a unified diff to tests/fixtures/diff_target.txt adding a new line between beta and gamma. The provided diff is outdated; regenerate the correct diff and apply via apply_patch_unified. Fail if you just apply the stale diff without fixing.",
            True,
        ),
        "retry_limit": (
            "Update RETRY_LIMIT to 5 only in the main entry file among tests/fixtures/retry_a.py, retry_b.py, retry_main.py. Use discovery, choose the file that defines main(). Do not touch the others. Use safe_write and report the change. Fail if more than one file changed or wrong file.",
            True,
        ),
        "human_bytes": (
            "Implement human_readable_bytes in tests/fixtures/util_feat.py (B, KB, MB, GB) with rounding to 1 decimal for KB+ and exact int for B. Then run pytest -q tests/fixtures/test_util_feat.py. Report change and test result.",
            True,
        ),
        "slugify_adv": (
            "Implement slugify in tests/fixtures/util_slug.py with transliteration: normalize unicode, map umlauts (a-umlaut->ae, o-umlaut->oe, u-umlaut->ue, A-umlaut->Ae, O-umlaut->Oe, U-umlaut->Ue, ss->ss), map Chinese word shijie to shi-jie, strip non-alnum, collapse spaces/underscores/hyphens to single '-', lowercase, trim hyphens. Then run pytest -q tests/fixtures/test_util_slug.py. Use safe_write, report change and test result.",
            True,
        ),
        "ast_types_hints": (
            "In tests/fixtures/ast_types.py add method health_check(self) -> bool: return True to every class, add type hints to ping methods (self) -> str for Alpha, (self, x: int) -> int for Beta, and ensure defaults are typed. Use safe_write, then run python_exec to import the module and assert Alpha().health_check() and Beta().health_check() return True. Report changes.",
            True,
        ),
        # --- Test più difficili (ROADMAP_HARD_TESTS.md) ---
        "diff_multi_hunk": (
            "In tests/fixtures/diff_multi_target.txt add a new line after 'second' in Block A, after 'beta' in Block B, and after 'two' in Block C. Use apply_patch_unified with a single valid unified diff (multiple hunks). Report success.",
            True,
        ),
        "long_file_edit": (
            "In tests/fixtures/long_edit_sample.py change only the line TARGET_CONSTANT = \"change_me_to_updated\" to TARGET_CONSTANT = \"updated\". Do not change any other line. Use safe_write, then run python_exec to assert the module main() returns \"updated\". Report change.",
            True,
        ),
        "nested_config": (
            "In tests/fixtures/nested_config.json set config.features.debug to true. Do not change any other key or structure. Use safe_write or write_file, then run python_exec to load the JSON and assert config['features']['debug'] is True. Report change.",
            True,
        ),
        "error_chain": (
            "Fix the bug in tests/fixtures/two_bugs_sample.py using the traceback in tests/fixtures/error_log_chain.txt. Then run pytest -q tests/fixtures/test_two_bugs.py. If pytest fails, use its stderr to fix the remaining bug in two_bugs_sample.py and run pytest again. Report both fixes and final test result.",
            True,
        ),
        # --- 5 test difficili ad hoc per il framework ---
        "hard_pipeline_mypy": (
            "Fix the type error in tests/fixtures/pipeline_mypy_sample.py: get_value() declares -> int but returns a string. Change either the return type to -> str or the return value to an int. Use safe_write. Report the fix.",
            True,
        ),
        "hard_config_five_formats": (
            "Set LOG_LEVEL to DEBUG in all five config files: tests/fixtures/config_five.json, config_five.yaml, config_five.ini, config_five.env, config_five.txt. Use safe_write or write_file. Preserve each file format. Report success.",
            True,
        ),
        "hard_add_type_hints": (
            "Add complete type hints (arguments and return) to both functions in tests/fixtures/type_hints_sample.py: add(a, b) and greet(name). Use safe_write. Report the changes.",
            True,
        ),
        "hard_move_method_types": (
            "Move method helper from SourceClass in tests/fixtures/ast_move_types_a.py to TargetClass in tests/fixtures/ast_move_types_b.py. Add return type -> str to the moved method. Remove helper from SourceClass. Use safe_write. Report the changes.",
            True,
        ),
        "hard_json_yaml_deep": (
            "Set app.logging.level to DEBUG in both tests/fixtures/deep_config.json and tests/fixtures/deep_config.yaml. Do not change any other key. Use safe_write. Report the changes.",
            True,
        ),
        # --- Test canali Request Manager (project, debug, explain) ---
        "channel_project": (
            "Implement a new function greet(name) in tests/fixtures/channel_project_target.py that returns 'Hello, {name}!'. The file may exist with minimal content; overwrite or extend it. Use safe_write. Report success.",
            True,
        ),
        "channel_debug": (
            "Fix the bug in tests/fixtures/channel_debug_target.py. The add(a,b) function returns wrong result (string concatenation instead of sum). Use the traceback in tests/fixtures/channel_debug_error.txt. Use safe_write, then run pytest -q tests/fixtures/test_channel_debug.py. Report the fix and test result.",
            True,
        ),
        "channel_explain": (
            "Explain how the compute_total and greet functions work in tests/fixtures/channel_explain_target.py. Describe their logic, parameters, and usage.",
            False,
        ),
        # --- Test generici facili ---
        "easy_count_dir": (
            "Use count_dir with path tests/fixtures. Report how many files and how many folders.",
            False,
        ),
        "easy_stat_path": (
            "Use stat_path on tests/fixtures/easy_stat_target.txt. Report the file size in bytes.",
            False,
        ),
        "easy_read_lines": (
            "Use read_file_lines with path tests/fixtures/easy_read_lines_target.txt, start_line 2, end_line 5. Report the content returned.",
            False,
        ),
        "easy_append": (
            "Append the line 'line2' to tests/fixtures/easy_append_log.txt using append_file. Report success.",
            True,
        ),
        "easy_replace_simple": (
            "Replace OLD_VALUE with NEW_VALUE in tests/fixtures/easy_replace_target.txt using replace_text. Report success.",
            True,
        ),
        "easy_ast_outline": (
            "Use python_ast_outline on path tests/fixtures/easy_ast_sample.py. Report the classes and functions found.",
            False,
        ),
        "easy_ast_imports": (
            "Use python_ast_imports on path tests/fixtures/easy_imports_sample.py. Report the imports found.",
            False,
        ),
        "easy_glob": (
            "Use glob_paths with pattern 'tests/fixtures/easy_glob*.py'. Report the paths returned.",
            False,
        ),
        "easy_file_hash": (
            "Use file_hash on path tests/fixtures/easy_hash_target.txt. Report the hash value.",
            False,
        ),
        # --- Test generici difficili ---
        "hard_multi_const": (
            "Update VERSION to '2.0' in tests/fixtures/easy_const_a.py. Then update the docstring in tests/fixtures/easy_const_b.py to say 'Version v2.0' instead of 'Version v1.0'. Use safe_write. Report changes.",
            True,
        ),
        "hard_fix_traceback": (
            "Fix the bug in tests/fixtures/easy_buggy_sample.py using the traceback in tests/fixtures/easy_traceback.txt. The get_first function must return None when items is empty. Use safe_write, then run pytest -q tests/fixtures/test_easy_buggy.py. Report fix and test result.",
            True,
        ),
        "hard_nested_json": (
            "In tests/fixtures/easy_nested.json set app.settings.database.port to 5432. Do not change any other key. Use safe_write or write_file. Report the change.",
            True,
        ),
        "hard_rename_cross": (
            "Rename function calc_sum to add_numbers in tests/fixtures/easy_calc_module.py and update the import in tests/fixtures/easy_calc_user.py. Use safe_write. Then run pytest -q tests/fixtures/test_easy_calc.py to validate. Report changes and test result.",
            True,
        ),
        "hard_config_three": (
            "Set KEY to 'value2' in all three files: tests/fixtures/easy_config.json, easy_config.yaml, easy_config.ini. Preserve each file format. Use safe_write or write_file. Report success.",
            True,
        ),
        "hard_docstring_update": (
            "In tests/fixtures/easy_doc_module.py update all docstrings from 'Version v1' to 'Version v2' (alpha, beta, gamma). Use safe_write. Report the changes.",
            True,
        ),
    }

    names = list(test_map.keys())
    if len(sys.argv) > 1:
        arg = sys.argv[1].strip()
        if arg and arg in test_map:
            names = [arg]

    results = {}
    for name in names:
        prompt, approval = test_map[name]
        results[name] = run_test(name, prompt, agent, approval=approval)

    tmp = os.path.join(base, "tmp_test.txt")
    if os.path.exists(tmp):
        os.remove(tmp)

    summary_path = os.path.join("tests", "summary.txt")
    with open(summary_path, "w", encoding="utf-8") as f:
        log_line(f, "SUMMARY", "Test run summary")
        for name, ok in results.items():
            log_line(f, "TEST_RESULT", f"{name}: {'PASS' if ok else 'FAIL'}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()



