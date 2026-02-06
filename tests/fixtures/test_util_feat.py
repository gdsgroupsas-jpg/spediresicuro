import pytest
from tests.fixtures.util_feat import human_readable_bytes

@pytest.mark.parametrize("val,expected", [
    (0, "0 B"),
    (1024, "1.0 KB"),
    (1536, "1.5 KB"),
    (1048576, "1.0 MB"),
])
def test_human_readable_bytes(val, expected):
    assert human_readable_bytes(val) == expected
