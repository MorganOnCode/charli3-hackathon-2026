# oracle-client

SPDX-License-Identifier: MIT
Copyright (c) 2026 MorganOnCode

Off-chain Python package that talks to the Charli3 ODV pull oracle on
Cardano Preprod. Part of the Charli3 Hackathon 2026 project. See the root
`README.md` for product context and `NOTES.md` in this folder for the
integration details SmartContractDev and FrontendDev need.

Owner: Oracle Integration Engineer.

## Requirements

- Python 3.10 or 3.11. Python 3.12 is not supported by the Charli3 SDK.
- Network access to `35.209.192.203:1337` (Ogmios) and
  `35.209.192.203:1442` (Kupo) for Preprod chain queries, plus
  `35.208.117.223:8001` / `8002` for the oracle node feed endpoints.

## Dependencies

- [`charli3-pull-oracle-client`](https://github.com/Charli3-Official/charli3-pull-oracle-client)
  (MIT). We do NOT pull from `charli3-pull-oracle-sdk` (AGPL-3.0).
- [pycardano](https://pycardano.readthedocs.io), via the Charli3 fork on
  branch `fix/odv-multisig-v0.17.0-kupo-additions` that the SDK pins.

## Setup

```bash
python3.11 -m venv oracle-client/.venv
oracle-client/.venv/bin/pip install -e oracle-client
```

First install takes a couple of minutes while it builds the pycardano
fork.

## Poll a fresh ADA/USD price

```bash
oracle-client/.venv/bin/python oracle-client/poll_price.py
```

Expected output: current chain tip, ODV validity window, median price,
per-node feeds, round-trip latency, and a sample per-node
`OracleNodeMessage` CBOR. Append `--json` for machine-readable output or
`-v` for DEBUG logging that shows the Ogmios handshake.

The script does not submit any transaction. Saturday's work adds
`submit_odv.py` (ODV tx plus chained dApp settlement release) and
`src/oracle_client/settlement.py` consumed by the frontend backend.

## Serve the HTTP shim (for `/web` dev server)

```bash
oracle-client/.venv/bin/python -m oracle_client.http_app
```

Binds `127.0.0.1:8001`. Two routes consumed by `web/src/lib/oracleService.ts`
through the Vite proxy `/api/oracle/* -> http://127.0.0.1:8001/*`:

- `GET /price` returns the locked nine-field snake_case JSON (matches
  `oracle-client/out/sample-run.json`). Live Preprod feed, ~300ms latency.
- `POST /odv/submit` submits the ODV aggregation tx. Body is ignored. Requires
  a funded Preprod wallet via `WALLET_MNEMONIC` (see `NOTES.md`).
- `GET /healthz` returns `{"status": "ok"}` for readiness probes.

Override host/port/config with `ORACLE_HTTP_HOST`, `ORACLE_HTTP_PORT`,
`ORACLE_CONFIG_PATH`. No CORS headers; the dev web app reaches the shim
through Vite's same-origin proxy.

## Canonical references

1. `charli3-pull-oracle-client` (MIT): the consumer SDK.
2. `hackathon-resources` `/configs`: Preprod feed identifiers.
3. `datum-demo-v3` and the swap-contract demo at docs.charli3.io: the
   reference-UTXO pattern for the dApp side.

## Preprod endpoints

- Ogmios: `ws://35.209.192.203:1337/` (websocket scheme required)
- Kupo: `http://35.209.192.203:1442/`

## Layout

```
oracle-client/
  configs/
    ada-usd-preprod.yml   # endpoints + feed identifiers for Preprod
  out/                    # sample JSON outputs from poll_price runs
  poll_price.py           # Day 1: fetch feed, print price, log latency
  pyproject.toml
  NOTES.md                # SDK notes, datum shapes, gotchas, handoffs
  README.md               # this file
  src/                    # reserved for Saturday's offchain library
```

## License

MIT. See `LICENSE` at the repo root.
