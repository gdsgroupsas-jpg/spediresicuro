# Test generici (facili e difficili)

Test generici che validano singoli tool e flussi complessi senza passare per il Request Manager.

## Test facili

| Test | Descrizione | Fixture | Approvazione |
|------|-------------|---------|--------------|
| easy_count_dir | count_dir su tests/fixtures | - | no |
| easy_stat_path | stat_path su file | easy_stat_target.txt | no |
| easy_read_lines | read_file_lines righe 2-5 | easy_read_lines_target.txt | no |
| easy_append | append_file | easy_append_log.txt | sì |
| easy_replace_simple | replace_text OLD→NEW | easy_replace_target.txt | sì |
| easy_ast_outline | python_ast_outline | easy_ast_sample.py | no |
| easy_ast_imports | python_ast_imports | easy_imports_sample.py | no |
| easy_glob | glob_paths | easy_glob_a.py, easy_glob_b.py | no |
| easy_file_hash | file_hash | easy_hash_target.txt | no |

## Test difficili

| Test | Descrizione | Fixture | Approvazione |
|------|-------------|---------|--------------|
| hard_multi_const | Aggiorna VERSION in 2 file + docstring | easy_const_a.py, easy_const_b.py | sì |
| hard_fix_traceback | Fix da traceback + pytest | easy_buggy_sample.py, easy_traceback.txt, test_easy_buggy.py | sì |
| hard_nested_json | Aggiorna port in JSON annidato | easy_nested.json | sì |
| hard_rename_cross | Rinomina funzione cross-module + pytest | easy_calc_module.py, easy_calc_user.py, test_easy_calc.py | sì |
| hard_config_three | Sync KEY in json/yaml/ini | easy_config.json, easy_config.yaml, easy_config.ini | sì |
| hard_docstring_update | Aggiorna docstrings v1→v2 in 3 funzioni | easy_doc_module.py | sì |

## Comandi per eseguire singolarmente

### Test facili

```bash
py tests/run_tests.py easy_count_dir
py tests/run_tests.py easy_stat_path
py tests/run_tests.py easy_read_lines
py tests/run_tests.py easy_append
py tests/run_tests.py easy_replace_simple
py tests/run_tests.py easy_ast_outline
py tests/run_tests.py easy_ast_imports
py tests/run_tests.py easy_glob
py tests/run_tests.py easy_file_hash
```

### Test difficili

```bash
py tests/run_tests.py hard_multi_const
py tests/run_tests.py hard_fix_traceback
py tests/run_tests.py hard_nested_json
py tests/run_tests.py hard_rename_cross
py tests/run_tests.py hard_config_three
py tests/run_tests.py hard_docstring_update
```

### Tutti i test generici (facili + difficili)

```bash
py tests/run_tests.py easy_count_dir easy_stat_path easy_read_lines easy_append easy_replace_simple easy_ast_outline easy_ast_imports easy_glob easy_file_hash hard_multi_const hard_fix_traceback hard_nested_json hard_rename_cross hard_config_three hard_docstring_update
```

## Reset fixture

All'avvio di `run_tests.py` le fixture dei test generici vengono resetate automaticamente:
- easy_append_log.txt, easy_replace_target.txt, easy_hash_target.txt
- easy_const_a.py, easy_const_b.py
- easy_buggy_sample.py
- easy_nested.json
- easy_calc_module.py, easy_calc_user.py
- easy_config.json, easy_config.yaml, easy_config.ini
- easy_doc_module.py

## Log

I log vengono scritti in:
- `tests/test_easy_count_dir.txt`
- `tests/test_easy_stat_path.txt`
- … (test_<nome>.txt per ogni test)
