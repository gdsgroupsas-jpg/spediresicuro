# -*- coding: utf-8 -*-
from pathlib import Path
p = Path('tests/run_tests.py')
text = p.read_text()
start_marker = '        "config_sync": ('
end_marker = '    }\n\n    names = list(test_map.keys())'
if start_marker not in text or end_marker not in text:
    raise SystemExit('marker not found')
new_block = """        "config_sync": (
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
"""
segment = text[text.index(start_marker):text.index(end_marker)]
text = text.replace(segment, new_block)
p.write_text(text)
