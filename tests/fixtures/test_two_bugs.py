import tests.fixtures.two_bugs_sample as m

def test_foo_returns():
    assert m.foo() is not None

def test_bar_value():
    assert m.bar() == 3
