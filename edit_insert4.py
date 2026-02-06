from pathlib import Path
p=Path('tests/run_tests.py')
t=p.read_text()
anchor='        "libcalc_fix": ('
block="        \"refactor_dist\": (\n            \"Rename function compute_total to compute_sum in tests/fixtures/libref.py and update all imports/call sites (tests/fixtures/service_ref.py, tests/fixtures/test_refactor_dist.py) and the stub tests/fixtures/libref.pyi. Use safe_write. Then run pytest -q tests/fixtures/test_refactor_dist.py to validate. Report changes and test result.\",\n            True,\n        ),\n        \"config_multi2\": (\n            \"Sync API_URL to https://api.example.com/v4, version to 4, feature_x to true across config.json, tests/fixtures/config_multi2.(json|yaml|ini|env) and tests/fixtures/config_like.txt. Use safe_write and verify via python_exec that all values match; fail if mismatch.\",\n            True,\n        ),\n        \"diff_repair\": (\n            \"Apply a unified diff to tests/fixtures/diff_target.txt adding a new line between beta and gamma. The provided diff is outdated; regenerate the correct diff and apply via apply_patch_unified. Fail if you just apply the stale diff without fixing.\",\n            True,\n        ),\n        \"retry_limit\": (\n            \"Update RETRY_LIMIT to 5 only in the main entry file among tests/fixtures/retry_a.py, retry_b.py, retry_main.py. Use discovery, choose the file that defines main(). Do not touch the others. Use safe_write and report the change. Fail if more than one file changed or wrong file.\",\n            True,\n        ),\n        \"human_bytes\": (\n            \"Implement human_readable_bytes in tests/fixtures/util_feat.py (B, KB, MB, GB) with rounding to 1 decimal for KB+ and exact int for B. Then run pytest -q tests/fixtures/test_util_feat.py. Report change and test result.\",\n            True,\n        ),\n"
if anchor not in t:
    raise SystemExit('anchor not found')
insert_pos=t.index(anchor)
insert_pos=t.index("\n", insert_pos)
insert_pos=t.index("\n", insert_pos+1)
new = t[:insert_pos+1] + block + t[insert_pos+1:]
p.write_text(new)
