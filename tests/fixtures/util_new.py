def slugify(text: str) -> str:
    import re
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

# Self‑check
result = slugify("Hello, World!")
print(f"Slugify('Hello, World!') -> {result}; equals 'hello-world': {result == 'hello-world'}")