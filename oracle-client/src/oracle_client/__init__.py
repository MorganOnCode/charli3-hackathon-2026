# SPDX-License-Identifier: MIT
# Copyright (c) 2026 MorganOnCode
"""oracle_client - thin project-specific wrapper around charli3_odv_client.

The Charli3 MIT SDK does the heavy lifting: HTTP feed collection, signature
aggregation, datum construction, ODV transaction building. This package
exposes a small callable surface the rest of the project can use without
learning the SDK:

- `request_fresh_price` returns a live price reading without touching the
  chain. Use this for read-only checks and for the frontend price panel.
- `submit_odv_tx` submits the ODV aggregation transaction on Preprod and
  returns the tx hash, the fresh oracle UTxO reference, and the decoded
  price / timestamp / expiry.
- `build_and_submit_release` builds a settlement-release transaction that
  spends a UTxO at the project's escrow validator while referencing the
  fresh oracle UTxO as a reference input, signs, and submits it.

All three read config from the YAML file (`configs/ada-usd-preprod.yml`)
that already ships with the oracle-client package. The wallet mnemonic is
pulled from the `WALLET_MNEMONIC` environment variable.
"""
from oracle_client.settlement import (
    FreshPrice,
    OdvSubmission,
    ReleaseSubmission,
    build_and_submit_release,
    load_settings,
    request_fresh_price,
    submit_odv_tx,
)

__all__ = [
    "FreshPrice",
    "OdvSubmission",
    "ReleaseSubmission",
    "build_and_submit_release",
    "load_settings",
    "request_fresh_price",
    "submit_odv_tx",
]
