from __future__ import annotations

import os
import glob
import json
import sys
import re
import time
from typing import Iterable, Tuple

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

    # Explicit file mentions in the prompt.
    for m in re.findall(r"(?:tests/fixtures|tests)/[A-Za-z0-9_./-]+", prompt):
        allowed.add(m)

    if "tests/fixtures/batch_edit" in prompt:
        for p in glob.glob("tests/fixtures/batch_edit/*"):
            allowed.add(p.replace("\\", "/"))

    if "config.json" in prompt:
        allowed.add("config.json")

    for m in re.findall(r"pytest\s+-q\s+([A-Za-z0-9_./-]+)", prompt):
        allowed.add(m)

    return sorted({p.replace("\\", "/") for p in allowed})

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
    def ping(self):
        return "alpha"

class Beta:
    def ping(self):
        return "beta"

    def beta_extra(self):
        return "beta extra"
'''
    try:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(src)
    except Exception:
        pass
def run_test(name: str, prompt: str, agent: Agent, approval: bool = False) -> bool:
    path = os.path.join("tests", f"test_{name}.txt")
    plan_path = os.path.join("tests", f"plan_{name}.json")
    ok = True
    planner_attempts = 0
    toolcaller_attempts = {}
    final_attempts = 0
    if name == "batch_replace_repo":
        _reset_batch_edit_fixtures()
    if name == "ast_move_method":
        _reset_ast_move_sample_fixture()
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
                    try:
                        with open(plan_path, "w", encoding="utf-8") as pf:
                            pf.write(text)
                    except Exception:
                        pass
                if kind == "ERROR":
                    lower = text.lower()
                    if "retry" in lower or "repair" in lower:
                        pass
                    elif "tool failed" in lower:
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
            "Sync API_URL to https://api.example.com/v4, version to 4, feature_x to true across config.json, tests/fixtures/config_multi2.(json|yaml|ini|env) and tests/fixtures/config_like.txt. Use safe_write and verify via python_exec that all values match; fail if mismatch.",
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



