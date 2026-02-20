"""Test for hard_rename_cross: add_numbers renamed from calc_sum."""
from tests.fixtures.easy_calc_module import add_numbers
from tests.fixtures.easy_calc_user import total

def test_add_numbers():
    assert add_numbers(2, 3) == 5

def test_total():
    assert total(1, 4) == 5
