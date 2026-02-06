import re

def slugify(value: str) -> str:
    """Convert string to slug: lowercase, alphanumeric only, spaces/underscores/hyphens to single hyphen, trim hyphens."""
    value = value.lower()
    value = re.sub(r'[ _-]+', '-', value)
    value = re.sub(r'[^a-z0-9-]', '', value)
    return value.strip('-')