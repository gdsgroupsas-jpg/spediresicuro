from pathlib import Path
p = Path('tests/run_tests.py')
t = p.read_text()
marker = '    }\n\n    names = list(test_map.keys())'
block = (
"        \"ast_cross_move\": (\n"
"            \"Move method util from class Foo in tests/fixtures/ast_cross_a.py to class Bar in tests/fixtures/ast_cross_b.py. Remove util from Foo. Use safe_write. Then run python_exec to assert Bar().util() == \\\"ok\\\" and Foo has no attribute util (AttributeError). Report changes.\",\n"
"            True,\n"
"        ),\n"
"        \"config_multi\": (\n"
"            \"Normalize API_URL to https://api.example.com/v3 and version to 3 across config.json, tests/fixtures/config_multi.yaml, tests/fixtures/config_multi.ini, and tests/fixtures/config_like.txt. Use safe_write and report diffs.\",\n"
"            True,\n"
"        ),\n"
"        \"resilient_flag\": (\n"
"            \"Set MAGIC_FLAG to True in the correct file. It appears only in tests/fixtures/resilient_target.py. Use replace_text; if no replacements, treat as failure. Report the change.\",\n"
"            True,\n"
"        ),\n"
"        \"libcalc_fix\": (\n"
"            \"Fix add(a,b) in tests/fixtures/libcalc.py to perform addition. Use safe_write, then run pytest -q tests/fixtures/test_libcalc.py. Report test result.\",\n"
"            True,\n"
"        ),\n"
)
if marker not in t:
    raise SystemExit('marker not found')
if 'ast_cross_move' in t:
    raise SystemExit('already inserted')
t = t.replace(marker, block + marker)
p.write_text(t)
