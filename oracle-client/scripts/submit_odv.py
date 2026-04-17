#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 MorganOnCode
"""Submit a Charli3 ODV aggregation transaction to Preprod.

This is the full Day 2 path: requests fresh signed feeds from the
configured oracle node operators, builds the ODV aggregation transaction,
signs with the wallet behind WALLET_MNEMONIC, submits it, and prints the
resulting tx hash + oracle UTxO reference + decoded price / timestamp /
expiry. Output is shaped so the Frontend Dev, Smart Contract Dev, and
Demo Director can copy-paste into their own tools.

Usage:
    WALLET_MNEMONIC='word1 word2 ...' python scripts/submit_odv.py
    python scripts/submit_odv.py --json
    python scripts/submit_odv.py --no-wait  # return as soon as mempool accepts

Requires a funded Preprod wallet (~20 ADA covers collateral + fees for a
handful of submissions).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
import time
from pathlib import Path

# Make the oracle_client package importable when the script is run from the
# repo without installing the package.
REPO_SRC = Path(__file__).resolve().parents[1] / "src"
if REPO_SRC.exists() and str(REPO_SRC) not in sys.path:
    sys.path.insert(0, str(REPO_SRC))

from oracle_client import OdvSubmission, submit_odv_tx  # noqa: E402

LOG = logging.getLogger("submit_odv")


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "-c",
        "--config",
        type=Path,
        default=None,
        help=(
            "Path to the ODV YAML config. "
            "Defaults to oracle-client/configs/ada-usd-preprod.yml."
        ),
    )
    parser.add_argument(
        "--no-wait",
        action="store_true",
        help="Return as soon as the node accepts the tx (no confirmation wait).",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit a JSON blob on stdout instead of a human summary.",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable DEBUG logging.",
    )
    return parser.parse_args(argv)


def _check_wallet() -> None:
    mnemonic = os.environ.get("WALLET_MNEMONIC", "").strip()
    if not mnemonic or mnemonic.lower().startswith("abandon abandon"):
        print(
            "WALLET_MNEMONIC is not set or still points at the BIP-39 zero-ADA "
            "test vector. Fund a Preprod wallet with at least 20 tADA from "
            "https://docs.cardano.org/cardano-testnets/tools/faucet/ and "
            "export the 24-word mnemonic before running this script.",
            file=sys.stderr,
        )
        sys.exit(2)


def _print_summary(result: OdvSubmission, latency_ms: float) -> None:
    print()
    print("Charli3 ODV tx submitted on Preprod")
    print("=" * 60)
    print(f"Tx hash           : {result.tx_hash}")
    print(f"Oracle UTxO ref   : {result.oracle_utxo_ref}")
    print(f"Price             : {result.price.price}")
    print(f"Price (6 dp USD)  : {result.price.median_six_dp}")
    print(f"Timestamp (ms)    : {result.price.timestamp_ms}")
    print(f"Expiry (ms)       : {result.price.expiry_ms}")
    print(f"Node feeds used   : {result.price.node_feeds_count}")
    print(f"Submission wall ms: {latency_ms:.0f}")
    print()


async def _run(args: argparse.Namespace) -> OdvSubmission:
    t0 = time.perf_counter()
    result = await submit_odv_tx(
        config_path=args.config, wait_confirmation=not args.no_wait
    )
    latency_ms = (time.perf_counter() - t0) * 1000.0
    if args.json:
        print(
            json.dumps(
                {
                    "tx_hash": result.tx_hash,
                    "oracle_utxo_ref": result.oracle_utxo_ref,
                    "price": result.price.price,
                    "price_six_dp": result.price.median_six_dp,
                    "timestamp_ms": result.price.timestamp_ms,
                    "expiry_ms": result.price.expiry_ms,
                    "node_feeds_count": result.price.node_feeds_count,
                    "submission_wall_ms": round(latency_ms, 2),
                },
                indent=2,
                sort_keys=True,
            )
        )
    else:
        _print_summary(result, latency_ms)
    return result


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    _check_wallet()
    try:
        asyncio.run(_run(args))
    except Exception as exc:
        LOG.error("ODV submission failed: %s", exc)
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
