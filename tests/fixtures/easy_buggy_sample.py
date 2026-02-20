"""Fixture for hard_fix_traceback: IndexError on empty list."""
def get_first(items):
    return items[0]  # IndexError if items is empty
