#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 MorganOnCode
"""Scripted ODV push for the live demo moment.

The demo storyboard (CHA-15) needs a deterministic way to make the
settlement trigger cross within 15 seconds of the rule being armed. We
cannot wait on natural ADA/USD movement during a 4-minute pitch slot.

Strategy: **we do not fake prices**. Charli3 nodes sign only real ADA/USD
feeds and falsifying them would disqualify us on transparency grounds.
Instead, at `t0` the DemoDirector arms an escrow rule pinned just below
(or just above) the current live price. This script then:

1. Polls the configured oracle nodes for a *real* fresh feed.
2. Verifies that the fresh feed crosses the supplied `--trigger-price`
   in the supplied `--direction` (Above/Below). If it does not, exits
   non-zero so the demo code can retry or reframe.
3. Submits the ODV aggregation transaction on Preprod and prints the tx
   hash, oracle UTxO reference, and decoded price + timestamp + expiry.
4. Emits a human-readable line and a JSON blob for easy splicing into
   the on-screen narration.

The whole round-trip is budgeted for <=15 seconds against the public
Preprod instance (warm oracle path is ~300 ms; submission + confirmation
adds the rest).

Usage on the presenter laptop on cue:
    WALLET_MNEMONIC=...funded... python scripts/demo_push.py \
        --trigger-price 250000 --direction above

Both --trigger-price and --direction are read from the escrow datum the
DemoDirector just armed; pass them in verbatim.
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

REPO_SRC = Path(__file__).resolve().parents[1] / "src"
if REPO_SRC.exists() and str(REPO_SRC) not in sys.path:
    sys.path.insert(0, str(REPO_SRC))

from oracle_client import (  # noqa: E402
    FreshPrice,
    OdvSubmission,
    request_fresh_price,
    submit_odv_tx,
)

LOG = logging.getLogger("demo_push")

DEADLINE_SECONDS = 15.0


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--trigger-price",
        type=int,
        required=True,
        help=(
            "Trigger price in oracle units (USD * 1e6). Must match the "
            "armed escrow datum. Example: 250000 means 0.250 USD/ADA."
        ),
    )
    parser.add_argument(
        "--direction",
        choices=("above", "below"),
        required=True,
        help=(
            "Trigger direction: 'above' releases when feed >= trigger, "
            "'below' releases when feed <= trigger. Must match the armed "
            "escrow datum."
        ),
    )
    parser.add_argument(
        "-c",
        "--config",
        type=Path,
        default=None,
        help="Override ODV YAML config (defaults to ADA/USD Preprod).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "Only read the live feed and confirm it crosses the trigger. "
            "Do NOT submit the ODV tx. Useful for the dry-run latency log."
        ),
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit a JSON blob on stdout instead of the human summary.",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable DEBUG logging.",
    )
    return parser.parse_args(argv)


def _crosses(price: int, trigger: int, direction: str) -> bool:
    return price >= trigger if direction == "above" else price <= trigger


def _check_wallet(dry_run: bool) -> None:
    if dry_run:
        return
    mnemonic = os.environ.get("WALLET_MNEMONIC", "").strip()
    if not mnemonic or mnemonic.lower().startswith("abandon abandon"):
        print(
            "WALLET_MNEMONIC is not set or still points at the BIP-39 zero-ADA "
            "test vector. For the live demo run, export the funded 24-word "
            "mnemonic before launching this script.",
            file=sys.stderr,
        )
        sys.exit(2)


async def _live_demo_run(args: argparse.Namespace) -> int:
    started = time.perf_counter()

    LOG.info("step 1 / 2: polling oracle nodes for fresh feed")
    poll_start = time.perf_counter()
    fresh = await request_fresh_price(config_path=args.config)
    poll_ms = (time.perf_counter() - poll_start) * 1000.0

    crosses = _crosses(fresh.price, args.trigger_price, args.direction)
    LOG.info(
        "fresh reading price=%s trigger=%s direction=%s crosses=%s "
        "poll_ms=%.0f",
        fresh.price,
        args.trigger_price,
        args.direction,
        crosses,
        poll_ms,
    )

    if not crosses:
        _emit(
            args,
            {
                "phase": "poll",
                "crosses": False,
                "fresh": _fresh_to_dict(fresh),
                "trigger_price": args.trigger_price,
                "direction": args.direction,
                "poll_latency_ms": round(poll_ms, 2),
                "elapsed_ms": round(
                    (time.perf_counter() - started) * 1000.0, 2
                ),
                "advice": (
                    "Re-arm the escrow with a trigger on the other side "
                    "of the current price, or wait for natural movement."
                ),
            },
            human=_human_poll_miss,
        )
        return 4

    if args.dry_run:
        _emit(
            args,
            {
                "phase": "dry-run",
                "crosses": True,
                "fresh": _fresh_to_dict(fresh),
                "trigger_price": args.trigger_price,
                "direction": args.direction,
                "poll_latency_ms": round(poll_ms, 2),
                "elapsed_ms": round(
                    (time.perf_counter() - started) * 1000.0, 2
                ),
            },
            human=_human_dry_run,
        )
        return 0

    LOG.info("step 2 / 2: submitting ODV tx on Preprod")
    submit_start = time.perf_counter()
    odv: OdvSubmission = await submit_odv_tx(
        config_path=args.config, wait_confirmation=True
    )
    submit_ms = (time.perf_counter() - submit_start) * 1000.0

    total_ms = (time.perf_counter() - started) * 1000.0
    under_deadline = total_ms <= DEADLINE_SECONDS * 1000.0

    _emit(
        args,
        {
            "phase": "submitted",
            "crosses": True,
            "fresh": _fresh_to_dict(fresh),
            "odv": {
                "tx_hash": odv.tx_hash,
                "oracle_utxo_ref": odv.oracle_utxo_ref,
                "price": odv.price.price,
                "price_six_dp": odv.price.median_six_dp,
                "timestamp_ms": odv.price.timestamp_ms,
                "expiry_ms": odv.price.expiry_ms,
                "node_feeds_count": odv.price.node_feeds_count,
            },
            "trigger_price": args.trigger_price,
            "direction": args.direction,
            "poll_latency_ms": round(poll_ms, 2),
            "submit_latency_ms": round(submit_ms, 2),
            "total_latency_ms": round(total_ms, 2),
            "under_15s": under_deadline,
        },
        human=_human_submitted,
    )
    return 0 if under_deadline else 5


def _fresh_to_dict(fresh: FreshPrice) -> dict:
    return {
        "price": fresh.price,
        "price_six_dp": fresh.median_six_dp,
        "timestamp_ms": fresh.timestamp_ms,
        "expiry_ms": fresh.expiry_ms,
        "node_feeds_count": fresh.node_feeds_count,
        "is_fresh": fresh.is_fresh,
    }


def _emit(args: argparse.Namespace, payload: dict, human) -> None:
    if args.json:
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        human(payload)


def _human_poll_miss(payload: dict) -> None:
    fresh = payload["fresh"]
    print()
    print("Demo push ABORTED: fresh feed does not cross the armed trigger.")
    print(f"  Fresh price     : {fresh['price']} ({fresh['price_six_dp']:.6f} USD/ADA)")
    print(f"  Trigger price   : {payload['trigger_price']}")
    print(f"  Direction       : {payload['direction']}")
    print(f"  Poll latency ms : {payload['poll_latency_ms']:.0f}")
    print("Advice:", payload["advice"])


def _human_dry_run(payload: dict) -> None:
    fresh = payload["fresh"]
    print()
    print("Dry run PASSED: fresh feed already crosses the armed trigger.")
    print(f"  Fresh price     : {fresh['price']} ({fresh['price_six_dp']:.6f} USD/ADA)")
    print(f"  Trigger price   : {payload['trigger_price']}")
    print(f"  Direction       : {payload['direction']}")
    print(f"  Node feeds used : {fresh['node_feeds_count']}")
    print(f"  Poll latency ms : {payload['poll_latency_ms']:.0f}")
    print(f"  Elapsed ms      : {payload['elapsed_ms']:.0f}")


def _human_submitted(payload: dict) -> None:
    odv = payload["odv"]
    print()
    print("Demo push SUBMITTED.")
    print(f"  Tx hash           : {odv['tx_hash']}")
    print(f"  Oracle UTxO ref   : {odv['oracle_utxo_ref']}")
    print(f"  On-chain price    : {odv['price']} ({odv['price_six_dp']:.6f} USD/ADA)")
    print(f"  Timestamp (ms)    : {odv['timestamp_ms']}")
    print(f"  Expiry (ms)       : {odv['expiry_ms']}")
    print(f"  Node feeds used   : {odv['node_feeds_count']}")
    print(f"  Poll latency ms   : {payload['poll_latency_ms']:.0f}")
    print(f"  Submit latency ms : {payload['submit_latency_ms']:.0f}")
    print(f"  Total latency ms  : {payload['total_latency_ms']:.0f}")
    print(f"  Under 15s         : {payload['under_15s']}")


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    _check_wallet(args.dry_run)
    try:
        return asyncio.run(_live_demo_run(args))
    except Exception as exc:
        LOG.error("demo push failed: %s", exc)
        return 3


if __name__ == "__main__":
    sys.exit(main())
