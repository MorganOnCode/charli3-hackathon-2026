#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 MorganOnCode
"""Tiny aiohttp shim around `oracle_client.settlement` for FrontendDev.

Two routes, contract pinned in CHA-18:

  GET  /price       Read-only. Returns the locked nine-field snake_case
                    JSON that mirrors `oracle-client/out/sample-run.json`
                    so `web/src/hooks/usePrice.ts` can flip
                    `ORACLE_FEED_LIVE` to `true` with no reshape.

  POST /odv/submit  Submits the ODV aggregation tx to Preprod and returns
                    `{ odv_tx_hash, oracle_utxo_ref, price, built_tx }`.
                    Body is ignored (accepts empty `{}` or no body).
                    Requires a funded Preprod wallet via WALLET_MNEMONIC.

The wrapper binds `127.0.0.1:8001` and adds no CORS headers; the dev web
app reaches it through Vite's proxy at `/api/oracle/*`. Stateless: each
request opens a fresh chain context so we never serve a stale view.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from pathlib import Path
from typing import Any

from aiohttp import web

from charli3_odv_client.cli.utils.shared import (
    create_chain_query,
    setup_transaction_builder,
)
from charli3_odv_client.core.aggregation import build_aggregate_message
from charli3_odv_client.core.client import ODVClient
from charli3_odv_client.models.base import TxValidityInterval
from charli3_odv_client.models.requests import OdvFeedRequest

from .settlement import _Settings, load_settings, submit_odv_tx

LOG = logging.getLogger("oracle_client.http_app")


def _median(values: list[int]) -> int:
    values = sorted(values)
    n = len(values)
    mid = n // 2
    if n % 2:
        return values[mid]
    return (values[mid - 1] + values[mid]) // 2


async def _collect_wire(settings: _Settings) -> dict[str, Any]:
    """Hit the configured oracle nodes once and return the locked JSON shape."""
    cfg = settings.client
    chain_query = create_chain_query(cfg)
    tx_manager, _tx_builder = setup_transaction_builder(
        cfg, settings.reference_script, chain_query
    )
    try:
        chain_time_ms = chain_query.get_current_posix_chain_time_ms()
        window = tx_manager.calculate_validity_window(cfg.odv_validity_length)
        feed_request = OdvFeedRequest(
            oracle_nft_policy_id=cfg.policy_id,
            tx_validity_interval=TxValidityInterval(
                start=window.validity_start, end=window.validity_end
            ),
        )
        client = ODVClient()
        t0 = time.perf_counter()
        node_messages = await client.collect_feed_updates(
            nodes=cfg.nodes, feed_request=feed_request
        )
        latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        if not node_messages:
            raise RuntimeError("No oracle node responded with a signed feed.")
        agg = build_aggregate_message(list(node_messages.values()))
        median_price = _median(list(agg.node_feeds_sorted_by_feed.values()))
        return {
            "median_price": int(median_price),
            "chain_time_ms": int(chain_time_ms),
            "validity_start_ms": int(window.validity_start),
            "validity_end_ms": int(window.validity_end),
            "node_feeds_count": int(agg.node_feeds_count),
            "oracle_address": cfg.oracle_address,
            "policy_id": cfg.policy_id,
            "network": cfg.network.network,
            "feed_request_latency_ms": latency_ms,
        }
    finally:
        close = getattr(chain_query, "close", None)
        if callable(close):
            maybe_awaitable = close()
            if asyncio.iscoroutine(maybe_awaitable):
                await maybe_awaitable


def _odv_price_block(submission_price, settings: _Settings) -> dict[str, Any]:
    """Reconstruct the wire shape from a submitted OdvSubmission's FreshPrice.

    `submit_odv_tx` returns FreshPrice with chain_time_ms in `timestamp_ms`
    and the 300s-centered window's end in `expiry_ms` (centred-window math
    matches the SDK's `calculate_validity_window`). Half-window derives the
    start so the response matches the GET /price contract byte-for-byte.
    """
    cfg = settings.client
    half_window = cfg.odv_validity_length // 2
    return {
        "median_price": int(submission_price.price),
        "chain_time_ms": int(submission_price.timestamp_ms),
        "validity_start_ms": int(submission_price.timestamp_ms - half_window),
        "validity_end_ms": int(submission_price.timestamp_ms + half_window),
        "node_feeds_count": int(submission_price.node_feeds_count),
        "oracle_address": cfg.oracle_address,
        "policy_id": cfg.policy_id,
        "network": cfg.network.network,
        "feed_request_latency_ms": 0.0,
    }


async def _price_handler(request: web.Request) -> web.Response:
    config_path = request.app["config_path"]
    try:
        settings = load_settings(config_path)
        wire = await _collect_wire(settings)
    except Exception as exc:
        LOG.exception("price collection failed")
        return web.json_response({"error": str(exc)}, status=502)
    return web.json_response(wire)


async def _submit_handler(request: web.Request) -> web.Response:
    config_path = request.app["config_path"]
    try:
        result = await submit_odv_tx(config_path=config_path, wait_confirmation=True)
        settings = load_settings(config_path)
    except Exception as exc:
        LOG.exception("odv submission failed")
        return web.json_response({"error": str(exc)}, status=502)
    return web.json_response(
        {
            "odv_tx_hash": result.tx_hash,
            "oracle_utxo_ref": result.oracle_utxo_ref,
            "price": _odv_price_block(result.price, settings),
            "built_tx": None,
        }
    )


async def _health_handler(_request: web.Request) -> web.Response:
    return web.json_response({"status": "ok"})


def create_app(config_path: str | Path | None = None) -> web.Application:
    app = web.Application()
    app["config_path"] = config_path
    app.add_routes(
        [
            web.get("/healthz", _health_handler),
            web.get("/price", _price_handler),
            web.post("/odv/submit", _submit_handler),
        ]
    )
    return app


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    config_path = os.environ.get("ORACLE_CONFIG_PATH")
    host = os.environ.get("ORACLE_HTTP_HOST", "127.0.0.1")
    port = int(os.environ.get("ORACLE_HTTP_PORT", "8001"))
    LOG.info(
        "starting oracle-client http shim host=%s port=%s config=%s",
        host,
        port,
        config_path or "<default>",
    )
    web.run_app(create_app(config_path), host=host, port=port, print=lambda _msg: None)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
