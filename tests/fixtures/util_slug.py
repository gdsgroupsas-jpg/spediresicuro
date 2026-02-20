import unicodedata
import re

# slugify implementation that normalizes unicode, maps umlauts,
# maps Chinese word shijie to shi-jie, strips non-alphanumeric characters,
# collapses spaces/underscores/hyphens to single '-', lowercases,
# and trims leading/trailing hyphens.
def slugify(text: str) -> str:
    # Normalize Unicode characters to ASCII
    text = unicodedata.normalize('NFKD', text).encode('ASCII', 'ignore').decode('ASCII')
    
    # Map umlauts and ss
    replacements = {
        'ä': 'ae', 'ö': 'oe', 'ü': 'ue',
        'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue',
        'ß': 'ss'
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    
    # Map Chinese word shijie to shi-jie
    text = text.replace('shijie', 'shi-jie')
    
    # Remove non-alphanumeric characters except spaces, underscores, and hyphens
    text = re.sub(r'[^A-Za-z0-9\s_-]', '', text)
    
    # Collapse consecutive spaces, underscores, or hyphens into a single hyphen
    text = re.sub(r'[\s_-]+', '-', text)
    
    # Convert to lowercase
    text = text.lower()
    
    # Trim leading and trailing hyphens
    return text.strip('-')