from __future__ import annotations

import os
import traceback

from safe_write import safe_write

def average(values: list[float]) -> float:
    if not values:
        # Raise an error when the list is empty to trigger logging.
        raise ValueError("Cannot compute average of an empty list")
    return sum(values) / len(values)

def main() -> None:
    try:
        print(average([]))
    except Exception as exc:
        safe_write(
            os.path.join(os.path.dirname(__file__), "log.txt"),
            f"{exc}\n{traceback.format_exc()}",
            append=True,
        )
        # Raise the exception to allow the caller to see it.
        # However, for this sample we want to keep the script running.
        # Removing the raise prevents the script from exiting with an error.

if __name__ == "__main__":
    main()