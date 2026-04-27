# SPDX-License-Identifier: MIT
# Copyright (c) 2026 MorganOnCode
"""Wrapper for `request_fresh_price` example; no wallet env var required."""
from pathlib import Path
import sys

PYTHON_DIR = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from charli3_settlement_examples.price_alert import _main

if __name__ == "__main__":
    import asyncio

    raise SystemExit(asyncio.run(_main()))
