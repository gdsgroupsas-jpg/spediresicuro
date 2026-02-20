"""Fixture per hard_pipeline_mypy: errore di tipo che mypy rileva e il Debugger deve correggere."""

def get_value() -> int:
    return "hello"  # type error: ritorna str ma il tipo dichiarato è int
