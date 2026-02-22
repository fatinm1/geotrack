"""
Pytest fixtures - extended in Step 8.
"""
import pytest


@pytest.fixture
def anyio_backend():
    return "asyncio"
