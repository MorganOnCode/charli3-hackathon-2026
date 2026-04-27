# SPDX-License-Identifier: MIT
# Copyright (c) 2026 MorganOnCode
"""charli3-settlement - MIT building blocks for price-conditional settlement.

Two modules, one public surface:

- `oracle` exposes `load_settings`, `request_fresh_price`, `submit_odv_tx`,
  `decode_oracle_datum_cbor`, and the `FreshPrice` / `OdvSubmission`
  dataclasses.
- `tx` exposes `build_with_oracle_reference`, a generic helper that resolves
  the fresh oracle UTxO and hands a ready-to-build context to any dApp
  consumer callback.

Depends only on the MIT-licensed `odv-multisig-charli3-client-sdk` and
pycardano. Does NOT depend on the AGPL `charli3-pull-oracle-sdk`.

Quickstart (read-only):

    from charli3_settlement import request_fresh_price
    fresh = await request_fresh_price("configs/ada-usd-preprod.yml")
    print(fresh.price, fresh.timestamp_ms)

Quickstart (submit + consume):

    from charli3_settlement import submit_odv_tx, build_with_oracle_reference
    submission = await submit_odv_tx("configs/ada-usd-preprod.yml")
    async def spend_my_validator(ctx):
        # ctx.tx_manager.build_script_tx(
        #     script_inputs=[...],
        #     reference_inputs={ctx.oracle_utxo},
        #     validity_start=ctx.validity_start_slot,
        #     validity_end=ctx.validity_end_slot,
        #     ...,
        # )
        ...
    await build_with_oracle_reference(
        submission=submission,
        consumer_fn=spend_my_validator,
        config_path="configs/ada-usd-preprod.yml",
    )
"""
from charli3_settlement.oracle import (
    AGG_STATE_ASSET_NAME_HEX,
    FreshPrice,
    OdvSubmission,
    Settings,
    decode_oracle_datum_cbor,
    load_settings,
    request_fresh_price,
    submit_odv_tx,
)
from charli3_settlement.tx import (
    OracleReferenceContext,
    build_with_oracle_reference,
)

__all__ = [
    "AGG_STATE_ASSET_NAME_HEX",
    "FreshPrice",
    "OdvSubmission",
    "OracleReferenceContext",
    "Settings",
    "build_with_oracle_reference",
    "decode_oracle_datum_cbor",
    "load_settings",
    "request_fresh_price",
    "submit_odv_tx",
]

__version__ = "0.1.0"
