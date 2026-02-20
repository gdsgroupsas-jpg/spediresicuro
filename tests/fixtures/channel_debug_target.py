"""Fixture per channel_debug: add(a,b) con bug - ritorna concatenazione invece di somma."""

def add(a, b):
    return str(a) + str(b)  # BUG: should return a + b for numbers
