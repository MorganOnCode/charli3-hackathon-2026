# SPDX-License-Identifier: MIT
# Copyright (c) 2026 MorganOnCode
"""oracle_client.settlement - project wrapper around Charli3's pull oracle.

Three callables, one config. Everything else lives in the Charli3 MIT SDK:

- `request_fresh_price(config_path)` asks the configured Preprod node
  operators for signed price messages, aggregates them locally, and returns
  the median price plus timestamp / expiry. It does not touch the chain.
  Good for the frontend price panel and health checks.

- `submit_odv_tx(config_path, wait)` does everything `request_fresh_price`
  does and then builds, signs, and submits the ODV aggregation transaction
  that writes the fresh reading to the oracle UTxO. Returns the tx hash,
  the fresh UTxO reference, and the decoded price / timestamp / expiry.

- `build_and_submit_release(...)` builds a dApp transaction that spends a
  UTxO at our escrow validator while referencing the fresh oracle UTxO as
  a reference input. Signs and submits it. Returns the release tx hash and
  the same price triplet.

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
from typing import Iterable

from pycardano import (
    Address,
    ExtendedSigningKey,
    PaymentSigningKey,
    PlutusV3Script,
    Redeemer,
    RedeemerTag,
    Transaction,
    TransactionBuilder,
    TransactionOutput,
    UTxO,
    VerificationKeyHash,
)

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
from charli3_odv_client.models.requests import OdvFeedRequest

LOG = logging.getLogger(__name__)

DEFAULT_CONFIG_PATH = (
    Path(__file__).resolve().parents[2] / "configs" / "ada-usd-preprod.yml"
)

# Canonical Preprod identifiers for the ADA/USD feed. Hard-coded only so the
# release wrapper can filter the oracle UTxO set to the one asset we care
# about. Everything authoritative still comes from the YAML config.
AGG_STATE_ASSET_NAME_HEX = "43334153"  # C3AS


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


@dataclass(frozen=True)
class ReleaseSubmission:
    """Result of submitting the escrow-release dApp tx."""

    release_tx_hash: str
    odv: OdvSubmission


@dataclass(frozen=True)
class _Settings:
    """Loaded view of the YAML config. Keeps the Charli3 types on the edge."""

    config_path: Path
    client: ODVClientConfig
    reference_script: ReferenceScriptConfig


def load_settings(config_path: Path | str | None = None) -> _Settings:
    path = Path(config_path) if config_path else DEFAULT_CONFIG_PATH
    # The SDK's KeyManager validates the mnemonic at parse time. Accept the
    # BIP-39 test vector for read-only flows; callers that submit must set
    # WALLET_MNEMONIC themselves.
    os.environ.setdefault(
        "WALLET_MNEMONIC",
        "abandon abandon abandon abandon abandon abandon abandon abandon "
        "abandon abandon abandon about",
    )
    return _Settings(
        config_path=path,
        client=ODVClientConfig.from_yaml(path),
        reference_script=ReferenceScriptConfig.from_yaml(path),
    )


async def _collect_aggregated_feed(settings: _Settings, *, tx_manager) -> FreshPrice:
    """Hit the configured oracle nodes and aggregate a fresh reading."""
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
    expiry_ms = timestamp_ms + settings.client.odv_validity_length
    return FreshPrice(
        price=int(median),
        timestamp_ms=timestamp_ms,
        expiry_ms=expiry_ms,
        node_feeds_count=aggregate.node_feeds_count,
        median_six_dp=round(median / 1_000_000, 6),
    )


async def request_fresh_price(
    config_path: Path | str | None = None,
) -> FreshPrice:
    """Return a freshly aggregated ADA/USD reading without touching the chain."""
    settings = load_settings(config_path)
    chain_query = create_chain_query(settings.client)
    tx_manager, _tx_builder = setup_transaction_builder(
        settings.client, settings.reference_script, chain_query
    )
    try:
        return await _collect_aggregated_feed(settings, tx_manager=tx_manager)
    finally:
        close = getattr(chain_query, "close", None)
        if callable(close):
            maybe_awaitable = close()
            if asyncio.iscoroutine(maybe_awaitable):
                await maybe_awaitable


async def submit_odv_tx(
    config_path: Path | str | None = None,
    *,
    wait_confirmation: bool = True,
) -> OdvSubmission:
    """Submit the ODV aggregation tx on Preprod.

    Requires `WALLET_MNEMONIC` pointing at a funded Preprod wallet.
    """
    settings = load_settings(config_path)
    chain_query = create_chain_query(settings.client)
    tx_manager, tx_builder = setup_transaction_builder(
        settings.client, settings.reference_script, chain_query
    )
    try:
        price = await _collect_aggregated_feed(settings, tx_manager=tx_manager)
        validity_window = tx_manager.calculate_validity_window(
            settings.client.odv_validity_length
        )
        client = ODVClient()
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
        signing_key, _pay_vk, _stake_vk, change_address = KeyManager.load_from_config(
            settings.client.wallet
        )
        odv_result = await tx_builder.build_odv_tx(
            node_messages=node_messages,
            signing_key=signing_key,
            change_address=change_address,
            validity_window=validity_window,
        )
        status, submitted_tx = await tx_manager.sign_and_submit(
            odv_result.transaction,
            signing_keys=[signing_key],
            wait_confirmation=wait_confirmation,
        )
        if status not in ("submitted", "confirmed"):
            raise RuntimeError(f"ODV submission returned status={status!r}")
        # The AggState output is always the second script_output in the SDK's
        # build_odv_tx (account_output, agg_state_output). Match that ordering
        # so the oracle_utxo_ref lines up with what reference-input consumers
        # will fetch next.
        tx_hash = str(submitted_tx.id)
        agg_state_index = 1
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
        )
    finally:
        close = getattr(chain_query, "close", None)
        if callable(close):
            maybe_awaitable = close()
            if asyncio.iscoroutine(maybe_awaitable):
                await maybe_awaitable


async def build_and_submit_release(
    *,
    escrow_utxo: UTxO,
    release_redeemer_cbor: bytes,
    escrow_plutus_script: PlutusV3Script,
    beneficiary_signing_key: PaymentSigningKey | ExtendedSigningKey,
    beneficiary_address: Address,
    beneficiary_vkh: VerificationKeyHash,
    release_outputs: Iterable[TransactionOutput],
    config_path: Path | str | None = None,
    odv: OdvSubmission | None = None,
    wait_confirmation: bool = True,
) -> ReleaseSubmission:
    """Build and submit the escrow-release dApp tx.

    If `odv` is None, first submits the ODV aggregation tx so the dApp tx
    can reference the fresh UTxO in the same block. If `odv` is supplied,
    reuses it (the caller has already produced a fresh reading).
    """
    settings = load_settings(config_path)
    if odv is None:
        odv = await submit_odv_tx(config_path=config_path, wait_confirmation=False)

    chain_query = create_chain_query(settings.client)
    tx_manager, tx_builder = setup_transaction_builder(
        settings.client, settings.reference_script, chain_query
    )
    try:
        # Resolve the fresh AggState UTxO on chain by (tx_hash, output_index).
        oracle_ref_tx_hash, oracle_ref_index = odv.oracle_utxo_ref.split("#")
        oracle_utxos = [
            utxo
            for utxo in await chain_query.get_utxos(settings.client.oracle_address)
            if str(utxo.input.transaction_id) == oracle_ref_tx_hash
            and utxo.input.index == int(oracle_ref_index)
        ]
        if not oracle_utxos:
            raise RuntimeError(
                f"Fresh oracle UTxO {odv.oracle_utxo_ref} not yet visible at "
                f"{settings.client.oracle_address}. Wait for confirmation "
                "before building the release tx."
            )
        oracle_utxo = oracle_utxos[0]

        # Validity window hugs the oracle reading. Max staleness is enforced
        # on chain by the escrow validator so we keep the window tight.
        validity_start_ms = odv.price.timestamp_ms
        validity_end_ms = odv.price.expiry_ms
        validity_start_slot = tx_builder.network_config.posix_to_slot(
            validity_start_ms
        )
        validity_end_slot = tx_builder.network_config.posix_to_slot(validity_end_ms)

        redeemer = Redeemer(tag=RedeemerTag.SPEND, data=release_redeemer_cbor)

        tx = await tx_manager.build_script_tx(
            script_inputs=[(escrow_utxo, redeemer, escrow_plutus_script)],
            script_outputs=list(release_outputs),
            reference_inputs={oracle_utxo},
            required_signers=[beneficiary_vkh],
            change_address=beneficiary_address,
            signing_key=beneficiary_signing_key,
            validity_start=validity_start_slot,
            validity_end=validity_end_slot,
        )
        status, submitted_tx = await tx_manager.sign_and_submit(
            tx,
            signing_keys=[beneficiary_signing_key],
            wait_confirmation=wait_confirmation,
        )
        if status not in ("submitted", "confirmed"):
            raise RuntimeError(f"Release submission returned status={status!r}")
        release_tx_hash = str(submitted_tx.id)
        LOG.info(
            "release submitted tx=%s status=%s ref_oracle=%s",
            release_tx_hash,
            status,
            odv.oracle_utxo_ref,
        )
        return ReleaseSubmission(
            release_tx_hash=release_tx_hash,
            odv=odv,
        )
    finally:
        close = getattr(chain_query, "close", None)
        if callable(close):
            maybe_awaitable = close()
            if asyncio.iscoroutine(maybe_awaitable):
                await maybe_awaitable


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
