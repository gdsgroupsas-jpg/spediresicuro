def slugify(text: str) -> str:
    import re
    # Lowercase
    text = text.lower()
    # Replace spaces, underscores, hyphens with hyphen
    text = re.sub(r"[ _-]+", "-", text)
    # Remove non-alphanumeric or hyphen
    text = re.sub(r"[^a-z0-9-]", "", text)
    # Trim hyphens
    text = text.strip('-')
    return text

# Self-check
assert slugify("Hello, World!") == "hello-world"