import pytest
from tests.fixtures.libcalc import add

def test_add_positive():
    assert add(2, 3) == 5

def test_add_negative():
    assert add(-1, -4) == -5
