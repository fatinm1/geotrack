import asyncio
from app.services.broadcast import broadcast_text

class Client:
    def __init__(self, slow=False):
        self.slow = slow
        self.messages = []
    async def send_text(self, text):
        if self.slow:
            await asyncio.sleep(10)
        self.messages.append(text)

def test_slow_client_is_removed_without_losing_fast_delivery():
    fast, slow = Client(), Client(True)
    connections = {fast, slow}
    asyncio.run(broadcast_text(connections, "update", timeout=0.01))
    assert fast.messages == ["update"]
    assert connections == {fast}

def test_empty_connection_set():
    asyncio.run(broadcast_text(set(), "update"))
