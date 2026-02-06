# API_VERSION: v2 using safe_write
from tests.fixtures.constants import API_VERSION

def get_endpoint():
    return f"/api/{API_VERSION}/status"