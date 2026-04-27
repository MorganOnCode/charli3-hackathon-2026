# SPDX-License-Identifier: MIT
# Copyright (c) 2026 MorganOnCode
"""Quickstart using `load_settings`, `submit_odv_tx`, and `build_with_oracle_reference`; set `WALLET_MNEMONIC`."""
from __future__ import annotations

import asyncio
from pathlib import Path

from pycardano import TransactionBuilder, TransactionOutput

from charli3_odv_client.config import KeyManager

from charli3_settlement import (
    build_with_oracle_reference,
    load_settings,
    submit_odv_tx,
)


def _default_config() -> Path:
    root = Path(__file__).resolve().parents[4]
    return root / "oracle-client" / "configs" / "ada-usd-preprod.yml"


async def main() -> int:
    settings = load_settings(_default_config())
    signing_key, payment_vk, _stake_vk, change_address = KeyManager.load_from_config(
        settings.client.wallet
    )
    submission = await submit_odv_tx(settings.config_path, wait_confirmation=True)

    async def consumer(ctx) -> str:
        builder = TransactionBuilder(ctx.tx_manager.chain_query.context)
        builder.reference_inputs.add(ctx.oracle_utxo)
        builder.add_output(TransactionOutput(address=change_address, amount=2_000_000))
        tx = await ctx.tx_manager.build_tx(
            builder=builder,
            change_address=change_address,
            signing_key=signing_key,
            required_signers=[payment_vk.hash()],
            validity_start=ctx.validity_start_slot,
            validity_end=ctx.validity_end_slot,
        )
        status, _submitted = await ctx.tx_manager.sign_and_submit(
            tx, signing_keys=[signing_key], wait_confirmation=True
        )
        if status not in ("submitted", "confirmed"):
            raise RuntimeError(f"consumer tx status={status!r}")
        return str(tx.id)

    consumer_tx_hash = await build_with_oracle_reference(
        settings=settings,
        submission=submission,
        consumer_fn=consumer,
    )
    print(
        f"odv_tx={submission.tx_hash} ref={submission.oracle_utxo_ref} "
        f"consumer_tx={consumer_tx_hash}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
