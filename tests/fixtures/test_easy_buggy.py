"""Test for hard_fix_traceback."""
from tests.fixtures.easy_buggy_sample import get_first

def test_get_first():
    assert get_first([1, 2, 3]) == 1
    assert get_first([]) is None
