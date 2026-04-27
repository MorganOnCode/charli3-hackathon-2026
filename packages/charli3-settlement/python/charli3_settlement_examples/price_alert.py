# SPDX-License-Identifier: MIT
# Copyright (c) 2026 MorganOnCode
"""Price alert example using `request_fresh_price`; no wallet env var required."""
from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

from charli3_settlement import request_fresh_price


def _default_config() -> Path:
    root = Path(__file__).resolve().parents[4]
    return root / "oracle-client" / "configs" / "ada-usd-preprod.yml"


async def _main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--threshold", type=int, required=True)
    parser.add_argument("--direction", choices=("above", "below"), default="above")
    parser.add_argument("--config", type=Path, default=_default_config())
    args = parser.parse_args()

    fresh = await request_fresh_price(args.config)
    crossed = (
        fresh.price >= args.threshold
        if args.direction == "above"
        else fresh.price <= args.threshold
    )
    status = "CROSSED" if crossed else "NOT_CROSSED"
    print(
        f"{status} price={fresh.price} threshold={args.threshold} "
        f"direction={args.direction} timestamp_ms={fresh.timestamp_ms}"
    )
    return 0 if crossed else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_main()))
