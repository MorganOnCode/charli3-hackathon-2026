#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 MorganOnCode
"""Poll the Charli3 ODV pull oracle for a fresh ADA/USD price on Preprod.

What this script does, end to end:

1. Loads a YAML config (charli3-pull-oracle-client shape) pointing at the
   Charli3 Preprod Ogmios/Kupo endpoints and the ADA/USD feed nodes.
2. Opens a chain context and computes an ODV validity window from the current
   chain tip.
3. Hits POST /odv/feed on every configured oracle node in parallel, collecting
   SignedOracleNodeMessage responses.
4. Verifies each signature via the SDK, aggregates the node feeds, and prints
   the median price, per-node price + timestamp, request round-trip latency,
   and a canonical OracleNodeMessage CBOR sample for the SmartContractDev.
5. Optionally, if --build-tx is set and a real wallet mnemonic is supplied via
   WALLET_MNEMONIC, builds the ODV transaction locally and prints its id and
   expected on-chain datum. It never submits.

This is the Day 1 deliverable from CHA-10. No on-chain submission. Future
scripts (Saturday) will submit the ODV tx and chain a dApp settlement tx in
the same block.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from charli3_odv_client.config import (
    KeyManager,
    ODVClientConfig,
    ReferenceScriptConfig,
)
from charli3_odv_client.core.aggregation import build_aggregate_message
from charli3_odv_client.core.client import ODVClient
from charli3_odv_client.models.base import TxValidityInterval
from charli3_odv_client.models.message import SignedOracleNodeMessage
from charli3_odv_client.models.requests import OdvFeedRequest
from charli3_odv_client.cli.utils.shared import (
    create_chain_query,
    setup_transaction_builder,
)

LOG = logging.getLogger("poll_price")


@dataclass
class PollResult:
    config_path: Path
    network: str
    policy_id: str
    oracle_address: str
    chain_slot: int
    chain_time_ms: int
    validity_start_ms: int
    validity_end_ms: int
    feed_request_latency_ms: float
    node_feeds: dict[str, dict[str, object]]
    median_price: int
    node_feeds_count: int
    sample_node_message_cbor: str
    built_tx: Optional[dict[str, object]] = None

    def to_dict(self) -> dict[str, object]:
        data = self.__dict__.copy()
        data["config_path"] = str(self.config_path)
        return data


def _configure_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def _load_config(config_path: Path) -> tuple[ODVClientConfig, ReferenceScriptConfig]:
    # Fall back to the BIP-39 test vector mnemonic when WALLET_MNEMONIC is not
    # set so the SDK validator passes. The mnemonic is only used to derive a
    # change address and never signs anything that reaches the network unless
    # --build-tx is set on a funded wallet.
    os.environ.setdefault(
        "WALLET_MNEMONIC",
        "abandon abandon abandon abandon abandon abandon abandon abandon "
        "abandon abandon abandon about",
    )
    return (
        ODVClientConfig.from_yaml(config_path),
        ReferenceScriptConfig.from_yaml(config_path),
    )


async def _collect_feeds(
    client_config: ODVClientConfig,
    ref_script_config: ReferenceScriptConfig,
    build_tx: bool,
) -> PollResult:
    chain_query = create_chain_query(client_config)
    tx_manager, tx_builder = setup_transaction_builder(
        client_config, ref_script_config, chain_query
    )

    chain_slot = chain_query.last_block_slot
    chain_time_ms = chain_query.get_current_posix_chain_time_ms()
    validity_window = tx_manager.calculate_validity_window(
        client_config.odv_validity_length
    )

    LOG.info(
        "chain tip slot=%s time_ms=%s validity=[%s, %s] length=%sms",
        chain_slot,
        chain_time_ms,
        validity_window.validity_start,
        validity_window.validity_end,
        client_config.odv_validity_length,
    )

    feed_request = OdvFeedRequest(
        oracle_nft_policy_id=client_config.policy_id,
        tx_validity_interval=TxValidityInterval(
            start=validity_window.validity_start,
            end=validity_window.validity_end,
        ),
    )

    client = ODVClient()

    LOG.info(
        "requesting feed from %d nodes at policy_id=%s",
        len(client_config.nodes),
        client_config.policy_id,
    )

    t0 = time.perf_counter()
    node_messages = await client.collect_feed_updates(
        nodes=client_config.nodes, feed_request=feed_request
    )
    latency_ms = (time.perf_counter() - t0) * 1000.0

    if not node_messages:
        raise RuntimeError(
            "No node responded with a valid signed feed. Verify node URLs, "
            "Preprod health, and that the oracle_nft_policy_id still matches "
            "the ADA/USD feed."
        )

    per_node = _summarize_nodes(node_messages)
    aggregate_message = build_aggregate_message(list(node_messages.values()))

    # Median of the aggregated sorted feed map is what the on-chain datum
    # will carry. The SDK's AggregateMessage stores a sorted mapping, so just
    # grab the median of the values.
    sorted_values = sorted(aggregate_message.node_feeds_sorted_by_feed.values())
    median_price = _median(sorted_values)

    sample_pub_key, sample_msg = next(iter(node_messages.items()))
    sample_cbor = sample_msg.message.to_cbor().hex()

    result = PollResult(
        config_path=Path(""),
        network=client_config.network.network,
        policy_id=client_config.policy_id,
        oracle_address=client_config.oracle_address,
        chain_slot=chain_slot,
        chain_time_ms=chain_time_ms,
        validity_start_ms=validity_window.validity_start,
        validity_end_ms=validity_window.validity_end,
        feed_request_latency_ms=round(latency_ms, 2),
        node_feeds=per_node,
        median_price=median_price,
        node_feeds_count=aggregate_message.node_feeds_count,
        sample_node_message_cbor=sample_cbor,
    )

    if build_tx:
        signing_key, _, _, change_address = KeyManager.load_from_config(
            client_config.wallet
        )
        LOG.info("building ODV transaction with change_address=%s", change_address)

        odv_result = await tx_builder.build_odv_tx(
            node_messages=node_messages,
            signing_key=signing_key,
            change_address=change_address,
            validity_window=validity_window,
        )
        result.built_tx = {
            "tx_id": str(odv_result.transaction.id),
            "median_value": odv_result.median_value,
            "cbor_length_hex_chars": len(odv_result.transaction.to_cbor_hex()),
        }

    return result


def _summarize_nodes(
    node_messages: dict[str, SignedOracleNodeMessage],
) -> dict[str, dict[str, object]]:
    summary: dict[str, dict[str, object]] = {}
    for pub_key, msg in node_messages.items():
        summary[pub_key] = {
            "feed": msg.message.feed,
            "timestamp_ms": int(msg.message.timestamp),
            "oracle_nft_policy_id": msg.message.oracle_nft_policy_id.hex(),
            "signature_hex_prefix": msg.signature.payload.hex()[:32] + "...",
        }
    return summary


def _median(values: list[int]) -> int:
    if not values:
        raise ValueError("empty feed list")
    values = sorted(values)
    n = len(values)
    mid = n // 2
    if n % 2 == 1:
        return values[mid]
    return (values[mid - 1] + values[mid]) // 2


def _print_human_summary(result: PollResult) -> None:
    print()
    print("Charli3 ODV pull oracle - Preprod feed result")
    print("=" * 60)
    print(f"Network           : {result.network}")
    print(f"Oracle NFT policy : {result.policy_id}")
    print(f"Oracle address    : {result.oracle_address}")
    print(
        f"Chain tip         : slot {result.chain_slot} "
        f"time_ms {result.chain_time_ms}"
    )
    print(
        f"Validity window   : [{result.validity_start_ms}, "
        f"{result.validity_end_ms}]"
    )
    print(f"Round-trip latency: {result.feed_request_latency_ms} ms")
    print(f"Nodes responded   : {result.node_feeds_count}")
    print()
    print(f"Median price      : {result.median_price}")
    print(f"Median as decimal : {result.median_price / 1_000_000:.6f} (6 dp)")
    print()
    print("Per-node feeds:")
    for pub_key, feed in result.node_feeds.items():
        print(
            f"  {pub_key[:16]}... feed={feed['feed']} "
            f"timestamp_ms={feed['timestamp_ms']}"
        )
    print()
    print("Sample OracleNodeMessage CBOR (hex):")
    print(f"  {result.sample_node_message_cbor}")
    if result.built_tx:
        print()
        print("ODV transaction built locally (not submitted):")
        for key, value in result.built_tx.items():
            print(f"  {key}: {value}")
    print()


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "-c",
        "--config",
        type=Path,
        default=Path(__file__).with_name("configs") / "ada-usd-preprod.yml",
        help="Path to the ODV client YAML config.",
    )
    parser.add_argument(
        "--build-tx",
        action="store_true",
        help=(
            "Also build the ODV transaction locally (requires a funded wallet "
            "via WALLET_MNEMONIC). The transaction is NEVER submitted by this "
            "script."
        ),
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit the full result as JSON on stdout instead of the human summary.",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable DEBUG logging.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    _configure_logging(args.verbose)

    try:
        client_config, ref_script_config = _load_config(args.config)
    except Exception as exc:
        LOG.error("failed to load config %s: %s", args.config, exc)
        return 2

    try:
        result = asyncio.run(
            _collect_feeds(client_config, ref_script_config, args.build_tx)
        )
    except Exception as exc:
        LOG.error("feed collection failed: %s", exc)
        return 3

    result.config_path = args.config

    if args.json:
        print(json.dumps(result.to_dict(), indent=2, sort_keys=True))
    else:
        _print_human_summary(result)

    return 0


if __name__ == "__main__":
    sys.exit(main())
