"""Concurrent, bounded sends prevent a slow viewer from blocking other clients."""
import asyncio

async def broadcast_text(connections: set, message: str, timeout: float = 2.0) -> None:
    clients = list(connections)
    async def send(client):
        await asyncio.wait_for(client.send_text(message), timeout=timeout)
    results = await asyncio.gather(*(send(client) for client in clients), return_exceptions=True)
    for client, result in zip(clients, results):
        if isinstance(result, BaseException):
            connections.discard(client)
