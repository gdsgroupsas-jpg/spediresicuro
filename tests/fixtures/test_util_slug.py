import pytest
from tests.fixtures.util_slug import slugify

@pytest.mark.parametrize(
    "val,expected",
    [
        ("Hello, ??", "hello-shi-jie"),
        ("Äpfel & Öl", "aepfel-oel"),
        ("Caffè latté", "caffe-latte"),
        ("multiple   spaces__and--dashes", "multiple-spaces-and-dashes"),
    ],
)
def test_slugify(val, expected):
    assert slugify(val) == expected
