from tests.fixtures.libref import compute_total


def test_compute_total_positive():
    assert compute_total(2, 3) == 5


def test_compute_total_zero():
    assert compute_total(0, 0) == 0
