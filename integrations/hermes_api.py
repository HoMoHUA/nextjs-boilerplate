"""API-only host for the installed Hermes adapter, default profile only.
No Telegram polling or gateway restart. Telegram-bound office rooms send through
Telegram to the existing gateway; this adapter serves independent Office rooms.
"""
import asyncio
import logging
import os
import signal
import sys
from pathlib import Path

sys.path.insert(0, "/usr/local/lib/hermes-agent")
os.environ["HERMES_HOME"] = "/root/.hermes"
from dotenv import load_dotenv
load_dotenv(Path("/root/.hermes/.env"), override=False)
from gateway.config import PlatformConfig
from gateway.platforms.api_server import APIServerAdapter

async def main():
    logging.basicConfig(level=logging.INFO)
    key = os.environ["ARKLYN_HERMES_KEY"]
    adapter = APIServerAdapter(PlatformConfig(enabled=True, extra={
        "host": "127.0.0.1", "port": 8642, "key": key,
        "model_name": "hermes-agent", "max_concurrent_runs": 2,
    }))
    adapter._max_concurrent_runs = 2
    if not await adapter.connect():
        raise RuntimeError("Hermes API adapter failed to start")
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)
    try:
        await stop.wait()
    finally:
        await adapter.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
