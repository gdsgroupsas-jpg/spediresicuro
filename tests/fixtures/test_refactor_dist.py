from tests.fixtures.libref import compute_sum

def test_compute_sum_positive():
    assert compute_sum(2, 3) == 5

def test_compute_sum_zero():
    assert compute_sum(0, 0) == 0