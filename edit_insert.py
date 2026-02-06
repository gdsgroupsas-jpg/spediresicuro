from pathlib import Path
p=Path('tests/run_tests.py')
text=p.read_text()
marker='    }\n\n    names = list(test_map.keys())'
if marker not in text:
    raise SystemExit('marker not found')
new_block="        \"config_sync\": (\n            \"Ensure the API_URL is consistent in config.json and tests/fixtures/config_like.txt, set it to https://api.example.com/v2. Find the files, update both with safe_write, and report the change.\",\n            True,\n        ),\n        \"ast_move_method\": (\n            \"Move beta_extra from class Beta to class Alpha in tests/fixtures/ast_move_sample.py, removing it from Beta. Use safe_write, then run python_exec to assert Alpha().beta_extra() == 'beta extra' and Beta has no beta_extra. Report changes.\",\n            True,\n        ),\n        \"new_function_slugify\": (\n            \"Implement slugify(text) in tests/fixtures/util_new.py: lowercase, alnum only, spaces/underscores/hyphens to single hyphen, trim hyphens. Add a small self-check with python_exec showing slugify(\\\"Hello, World!\\\") == \\\"hello-world\\\". Use safe_write, report change.\",\n            True,\n        ),\n"
text=text.replace(marker, new_block+marker)
p.write_text(text)
