# SPDX-License-Identifier: MIT
# Copyright (c) 2026 MorganOnCode
"""charli3_settlement.oracle - pull oracle building blocks.

Three callables and three dataclasses, all MIT licensed, all reusable by
any Cardano dApp that wants price-conditional settlement on top of Charli3's
pull oracle:

- `load_settings(path)` parses a Charli3 ODV client YAML into typed config.
- `request_fresh_price(path)` asks the configured Preprod node operators
  for signed price messages, aggregates them, and returns the median price
  plus timestamp / expiry. No on-chain write.
- `submit_odv_tx(path)` does everything `request_fresh_price` does and then
  builds, signs, and submits the ODV aggregation transaction that writes
  the fresh reading to the oracle UTxO.
- `decode_oracle_datum_cbor(hex)` turns a raw inline-datum CBOR hex into
  the same `FreshPrice` shape. Useful for frontends that read the oracle
  UTxO directly.

The wallet mnemonic is pulled from the `WALLET_MNEMONIC` env var. For
read-only flows the SDK falls back to the BIP-39 zero-ADA test vector.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pycardano import Address, ScriptHash, TransactionId, TransactionInput, UTxO
from charli3_odv_client.cli.utils.shared import (
    create_chain_query,
    setup_transaction_builder,
)
from charli3_odv_client.config import (
    KeyManager,
    ODVClientConfig,
    ReferenceScriptConfig,
)
from charli3_odv_client.core.aggregation import build_aggregate_message
from charli3_odv_client.core.client import ODVClient
from charli3_odv_client.models.base import TxValidityInterval
from charli3_odv_client.models.datums import AggState
from charli3_odv_client.models.requests import OdvFeedRequest, OdvTxSignatureRequest
from charli3_odv_client.utils.oracle import chain_operations, state_validation

LOG = logging.getLogger(__name__)

# Canonical Preprod asset name for the ADA/USD AggState. Exposed for filtering
# oracle UTxOs by asset when a dApp wants to short-circuit the UTxO scan.
AGG_STATE_ASSET_NAME_HEX = "43334153"  # "C3AS"

# BIP-39 zero-ADA test vector; valid mnemonic for read-only flows so the
# SDK's KeyManager.from_config passes validation. Never used for signing
# anything that reaches the network.
_BIP39_TEST_VECTOR = (
    "abandon abandon abandon abandon abandon abandon abandon abandon "
    "abandon abandon abandon about"
)


@dataclass(frozen=True)
class FreshPrice:
    """Decoded read from the oracle (no on-chain write)."""

    price: int
    timestamp_ms: int
    expiry_ms: int
    node_feeds_count: int
    median_six_dp: float

    @property
    def is_fresh(self) -> bool:
        now_ms = int(time.time() * 1000)
        return self.timestamp_ms <= now_ms <= self.expiry_ms


@dataclass(frozen=True)
class OdvSubmission:
    """Result of submitting the ODV aggregation tx."""

    tx_hash: str
    oracle_utxo_ref: str  # "<tx_hash>#<output_index>"
    price: FreshPrice
    oracle_utxo: UTxO | None = None


@dataclass(frozen=True)
class Settings:
    """Loaded view of the YAML config. Keeps SDK types on the edge."""

    config_path: Path
    client: ODVClientConfig
    reference_script: ReferenceScriptConfig


def load_settings(config_path: Path | str) -> Settings:
    """Parse a Charli3 ODV client YAML into typed config.

    Sets `WALLET_MNEMONIC` to the BIP-39 test vector when unset so the SDK's
    mnemonic validator passes on read-only flows. Callers that submit on
    chain must export their own funded mnemonic before importing the SDK.
    """
    path = Path(config_path)
    os.environ.setdefault("WALLET_MNEMONIC", _BIP39_TEST_VECTOR)
    return Settings(
        config_path=path,
        client=ODVClientConfig.from_yaml(path),
        reference_script=ReferenceScriptConfig.from_yaml(path),
    )


async def _collect_aggregated_feed(
    settings: Settings, *, tx_manager: Any
) -> FreshPrice:
    """Hit the configured oracle nodes and aggregate a fresh reading."""
    oracle_address = Address.from_primitive(settings.client.oracle_address)
    policy_id = ScriptHash.from_primitive(bytes.fromhex(settings.client.policy_id))
    script_utxos = await chain_operations.get_script_utxos(oracle_address, tx_manager)
    settings_datum, _settings_utxo = state_validation.get_oracle_settings_by_policy_id(
        script_utxos, policy_id
    )

    validity_window = tx_manager.calculate_validity_window(
        settings.client.odv_validity_length
    )
    feed_request = OdvFeedRequest(
        oracle_nft_policy_id=settings.client.policy_id,
        tx_validity_interval=TxValidityInterval(
            start=validity_window.validity_start,
            end=validity_window.validity_end,
        ),
    )
    client = ODVClient()
    LOG.info(
        "requesting feed from %d nodes policy_id=%s",
        len(settings.client.nodes),
        settings.client.policy_id,
    )
    t0 = time.perf_counter()
    node_messages = await client.collect_feed_updates(
        nodes=settings.client.nodes, feed_request=feed_request
    )
    latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    LOG.info("feed collection latency_ms=%s nodes=%d", latency_ms, len(node_messages))
    if not node_messages:
        raise RuntimeError("No oracle node returned a signed feed.")
    aggregate = build_aggregate_message(list(node_messages.values()))
    # Median across verified node feeds matches what the ODV tx writes on
    # chain. Use the SDK's sorted map so we never drift from what lands.
    feeds = list(aggregate.node_feeds_sorted_by_feed.values())
    feeds.sort()
    median = feeds[len(feeds) // 2] if len(feeds) % 2 else (
        (feeds[len(feeds) // 2 - 1] + feeds[len(feeds) // 2]) // 2
    )
    timestamp_ms = int(validity_window.current_time)
    expiry_ms = timestamp_ms + settings_datum.aggregation_liveness_period
    return FreshPrice(
        price=int(median),
        timestamp_ms=timestamp_ms,
        expiry_ms=expiry_ms,
        node_feeds_count=aggregate.node_feeds_count,
        median_six_dp=round(median / 1_000_000, 6),
    )


async def _close_chain_query(chain_query: Any) -> None:
    close = getattr(chain_query, "close", None)
    if callable(close):
        maybe_awaitable = close()
        if asyncio.iscoroutine(maybe_awaitable):
            await maybe_awaitable


async def request_fresh_price(config_path: Path | str) -> FreshPrice:
    """Return a freshly aggregated reading without touching the chain."""
    settings = load_settings(config_path)
    chain_query = create_chain_query(settings.client)
    tx_manager, _tx_builder = setup_transaction_builder(
        settings.client, settings.reference_script, chain_query
    )
    try:
        return await _collect_aggregated_feed(settings, tx_manager=tx_manager)
    finally:
        await _close_chain_query(chain_query)


async def submit_odv_tx(
    config_path: Path | str,
    *,
    wait_confirmation: bool = True,
) -> OdvSubmission:
    """Submit the ODV aggregation tx on Preprod.

    Requires `WALLET_MNEMONIC` pointing at a funded Preprod wallet.
    """
    settings = load_settings(config_path)
    client = ODVClient()

    # Build the feed request on one query context, then reopen a fresh query
    # right before ODV tx construction. This avoids reusing a stale Kupo UTxO
    # snapshot across the gap between feed collection and script-input lookup.
    initial_chain_query = create_chain_query(settings.client)
    initial_tx_manager, _initial_tx_builder = setup_transaction_builder(
        settings.client, settings.reference_script, initial_chain_query
    )
    try:
        price = await _collect_aggregated_feed(settings, tx_manager=initial_tx_manager)
        validity_window = initial_tx_manager.calculate_validity_window(
            settings.client.odv_validity_length
        )
        feed_request = OdvFeedRequest(
            oracle_nft_policy_id=settings.client.policy_id,
            tx_validity_interval=TxValidityInterval(
                start=validity_window.validity_start,
                end=validity_window.validity_end,
            ),
        )
        node_messages = await client.collect_feed_updates(
            nodes=settings.client.nodes, feed_request=feed_request
        )
        if not node_messages:
            raise RuntimeError("Feed collection returned no node messages on submit.")
    finally:
        await _close_chain_query(initial_chain_query)

    signing_key, _pay_vk, _stake_vk, change_address = KeyManager.load_from_config(
        settings.client.wallet
    )

    fresh_chain_query = create_chain_query(settings.client)
    tx_manager, tx_builder = setup_transaction_builder(
        settings.client, settings.reference_script, fresh_chain_query
    )
    try:
        odv_result = await tx_builder.build_odv_tx(
            node_messages=node_messages,
            signing_key=signing_key,
            change_address=change_address,
            validity_window=validity_window,
        )
        # Pull tx signatures from each oracle node so the final witness set
        # satisfies the multisig required_signers on the AggState output. The
        # SDK's CLI aggregate command does this same two-step: build then sign.
        tx_request = OdvTxSignatureRequest(
            node_messages=node_messages,
            tx_body_cbor=odv_result.transaction.transaction_body.to_cbor_hex(),
        )
        node_signatures = await client.collect_tx_signatures(
            nodes=settings.client.nodes, tx_request=tx_request
        )
        if not node_signatures:
            raise RuntimeError("No oracle node returned a tx signature.")
        odv_result.transaction = client.attach_signature_witnesses(
            original_tx=odv_result.transaction,
            signatures=node_signatures,
            node_messages=node_messages,
        )
        LOG.info(
            "attached %d node tx signatures policy_id=%s",
            len(node_signatures),
            settings.client.policy_id,
        )
        status, _submitted = await tx_manager.sign_and_submit(
            odv_result.transaction,
            signing_keys=[signing_key],
            wait_confirmation=wait_confirmation,
        )
        if status not in ("submitted", "confirmed"):
            raise RuntimeError(f"ODV submission returned status={status!r}")
        # The SDK's Ogmios path returns a UTxO list from the confirmation
        # query rather than the original Transaction, so we read the tx hash
        # off the signed transaction we just submitted. The AggState output
        # is always the second script_output in the SDK's build_odv_tx
        # (account_output, agg_state_output), so reference_index=1 lines up
        # with what reference-input consumers will fetch next.
        tx_hash = str(odv_result.transaction.id)
        agg_state_index = 1
        predicted_oracle_utxo = UTxO(
            input=TransactionInput(
                TransactionId.from_primitive(bytes.fromhex(tx_hash)), agg_state_index
            ),
            output=odv_result.agg_state_output,
        )
        LOG.info(
            "ODV submitted tx=%s status=%s median=%s ts=%s",
            tx_hash,
            status,
            odv_result.median_value,
            price.timestamp_ms,
        )
        return OdvSubmission(
            tx_hash=tx_hash,
            oracle_utxo_ref=f"{tx_hash}#{agg_state_index}",
            price=price,
            oracle_utxo=predicted_oracle_utxo,
        )
    finally:
        await _close_chain_query(fresh_chain_query)


def decode_oracle_datum_cbor(cbor_hex: str) -> FreshPrice:
    """Decode a raw inline-datum CBOR hex into our `FreshPrice` shape.

    Useful for the frontend: given an on-chain fetch of the oracle UTxO's
    inline datum, surface the same shape the live feed returns. Keeps one
    decode path for the whole project.
    """
    data = AggState.from_cbor(bytes.fromhex(cbor_hex))
    price_map = {int(k): int(v) for k, v in data.price_data.price_map.items()}
    timestamp_ms = price_map[1]
    expiry_ms = price_map[2]
    return FreshPrice(
        price=price_map[0],
        timestamp_ms=timestamp_ms,
        expiry_ms=expiry_ms,
        node_feeds_count=-1,  # Unknown from datum alone; fetch signatures for that.
        median_six_dp=round(price_map[0] / 1_000_000, 6),
    )
