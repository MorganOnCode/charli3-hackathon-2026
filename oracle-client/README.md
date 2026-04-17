# oracle-client

Off-chain Python agent. Owns the Charli3 ODV pull flow and the settlement transaction builder.

Owner: Oracle Integration Engineer.

## Dependencies

- Python 3.11+
- [`charli3-pull-oracle-client`](https://pypi.org/project/charli3-pull-oracle-client/) (MIT). We do **not** use `charli3-pull-oracle-sdk` (AGPL-3.0).
- [PyCardano](https://pycardano.readthedocs.io).

## Layout

```
src/oracle_client/
  settlement.py     # Public API consumed by web/ backend. See ARCHITECTURE.md.
  odv.py            # Request/aggregate signed feed messages, build ODV tx.
  escrow.py         # Build lock and release txs, reference oracle UTXO.
  node.py           # Ogmios/Kupo wiring for Preprod.
tests/              # pytest.
pyproject.toml
```

## Canonical references (read before writing code)

1. `charli3-pull-oracle-client` repo — the consumer SDK.
2. `datum-demo-v3` and the swap-contract demo — the canonical reference-UTXO pattern.
3. `hackathon-resources` — Preprod feed configs.

See [../ARCHITECTURE.md](../ARCHITECTURE.md) for the full interface contract.

## Preprod endpoints

- Ogmios: `http://35.209.192.203:1337/`
- Kupo: `http://35.209.192.203:1442/`

## Running locally

```bash
cd oracle-client
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest
```
