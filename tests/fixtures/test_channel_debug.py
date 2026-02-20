"""Test per channel_debug: add deve fare somma numerica."""

from tests.fixtures.channel_debug_target import add

def test_add_positive():
    assert add(2, 3) == 5

def test_add_zero():
    assert add(0, 0) == 0
