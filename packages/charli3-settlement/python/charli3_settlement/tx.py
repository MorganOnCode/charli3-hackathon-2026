# SPDX-License-Identifier: MIT
# Copyright (c) 2026 MorganOnCode
"""charli3_settlement.tx - generic tx helper that bolts a fresh oracle UTxO on.

Any dApp that wants price-conditional settlement ends up writing the same
five lines of boilerplate: open a chain context, resolve the fresh oracle
UTxO by (tx_hash, output_index), compute a validity window hugging the
oracle reading, then hand the rest to whoever builds the validator call.

`build_with_oracle_reference` is that boilerplate. The caller passes a
consumer callback that receives an `OracleReferenceContext` with the
resolved oracle UTxO, the SDK's tx_manager and tx_builder, and the slot
bounds. The consumer plugs in dApp-specific inputs, redeemers, outputs,
and signers, then builds and submits through `tx_manager`. The helper
manages chain-context lifecycle so callers do not duplicate the finally
block.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Awaitable, Callable, TypeVar

from pycardano import UTxO

from charli3_odv_client.cli.utils.shared import (
    create_chain_query,
    setup_transaction_builder,
)

from .oracle import (
    OdvSubmission,
    Settings,
    _close_chain_query,
    load_settings,
    submit_odv_tx,
)

LOG = logging.getLogger(__name__)

T = TypeVar("T")


@dataclass(frozen=True)
class OracleReferenceContext:
    """Context handed to consumer callbacks by `build_with_oracle_reference`.

    The consumer builds and submits its dApp transaction via
    `tx_manager.build_script_tx(..., reference_inputs={ctx.oracle_utxo}, ...)`
    and `tx_manager.sign_and_submit(...)`. The slot bounds already hug the
    oracle reading so the on-chain validator can enforce freshness by
    checking the tx validity interval against the AggState timestamp.
    """

    settings: Settings
    submission: OdvSubmission
    oracle_utxo: UTxO
    tx_manager: Any
    tx_builder: Any
    validity_start_slot: int
    validity_end_slot: int


async def build_with_oracle_reference(
    *,
    submission: OdvSubmission | None = None,
    consumer_fn: Callable[[OracleReferenceContext], Awaitable[T]],
    config_path: Path | str | None = None,
    settings: Settings | None = None,
    wait_confirmation_on_submit: bool = False,
) -> T:
    """Attach the fresh oracle UTxO as a reference input and run `consumer_fn`.

    Flow:
      1. Load settings (or reuse the one the caller passed).
      2. If no `submission` given, submit the ODV tx now so we can chain.
      3. Open a chain context and resolve the fresh AggState UTxO by
         (tx_hash, output_index) from `submission.oracle_utxo_ref`.
      4. Compute slot bounds that hug `submission.price.{timestamp_ms, expiry_ms}`.
      5. Call `consumer_fn(ctx)` and return its result.

    The consumer is responsible for building and submitting its dApp tx.
    The helper keeps the chain context open across the consumer call and
    closes it in a finally block.

    Either `settings` or `config_path` must be provided. `submission` is
    optional; if omitted, the helper submits its own ODV aggregation tx
    via `submit_odv_tx` with `wait_confirmation_on_submit` controlling
    whether we wait for it to land before proceeding.
    """
    if settings is None:
        if config_path is None:
            raise ValueError(
                "build_with_oracle_reference requires either settings or config_path."
            )
        settings = load_settings(config_path)
    else:
        # If caller gave us settings, respect its config_path for nested
        # submit_odv_tx calls so both ends read from the same YAML.
        config_path = settings.config_path

    if submission is None:
        submission = await submit_odv_tx(
            config_path, wait_confirmation=wait_confirmation_on_submit
        )

    chain_query = create_chain_query(settings.client)
    tx_manager, tx_builder = setup_transaction_builder(
        settings.client, settings.reference_script, chain_query
    )
    try:
        oracle_utxo = submission.oracle_utxo
        if oracle_utxo is None:
            oracle_ref_tx_hash, oracle_ref_index_s = submission.oracle_utxo_ref.split(
                "#"
            )
            oracle_ref_index = int(oracle_ref_index_s)
            oracle_utxos = [
                utxo
                for utxo in await chain_query.get_utxos(settings.client.oracle_address)
                if str(utxo.input.transaction_id) == oracle_ref_tx_hash
                and utxo.input.index == oracle_ref_index
            ]
            if not oracle_utxos:
                raise RuntimeError(
                    f"Fresh oracle UTxO {submission.oracle_utxo_ref} not yet visible "
                    f"at {settings.client.oracle_address}. Wait for confirmation "
                    "before building the consumer tx."
                )
            oracle_utxo = oracle_utxos[0]

        validity_start_slot = tx_builder.network_config.posix_to_slot(
            submission.price.timestamp_ms
        )
        validity_end_slot = tx_builder.network_config.posix_to_slot(
            submission.price.expiry_ms
        )

        ctx = OracleReferenceContext(
            settings=settings,
            submission=submission,
            oracle_utxo=oracle_utxo,
            tx_manager=tx_manager,
            tx_builder=tx_builder,
            validity_start_slot=validity_start_slot,
            validity_end_slot=validity_end_slot,
        )
        LOG.info(
            "oracle reference resolved utxo=%s validity_slots=[%s,%s]",
            submission.oracle_utxo_ref,
            validity_start_slot,
            validity_end_slot,
        )
        return await consumer_fn(ctx)
    finally:
        await _close_chain_query(chain_query)
