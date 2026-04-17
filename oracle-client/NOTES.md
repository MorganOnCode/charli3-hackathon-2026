# Oracle Engineer - Day 1 Notes

SPDX-License-Identifier: MIT
Copyright (c) 2026 MorganOnCode

Reading dump, integration surface, on-chain datum shape, and Preprod gotchas
so the SmartContractDev and FrontendDev do not hit them blind on Saturday.

## Status

- Read the canonical repos: `charli3-pull-oracle-client` (MIT SDK),
  `hackathon-resources` (Preprod feed configs), swap-contract demo and pull
  oracle summary docs.
- Scaffolded `oracle-client/` with the SDK installed in a Python 3.11 venv.
- `poll_price.py` pulls a fresh ADA/USD feed from Preprod end to end and
  prints the aggregated median, per-node signed feeds, round-trip latency,
  and a canonical per-node OracleNodeMessage CBOR sample.
- Three back to back runs against live Preprod returned 2/2 node responses,
  identical per-node feed values, and warm latency around 280 ms.

Prohibited: I did NOT read or paste from `charli3-pull-oracle-sdk`
(AGPL-3.0). We depend only on `charli3-pull-oracle-client` (MIT).

## The SDK at a glance

The relevant module paths are:

- `charli3_odv_client.core.client.ODVClient`: per-node HTTP client. Methods
  `collect_feed_updates(nodes, feed_request)` and
  `collect_tx_signatures(nodes, tx_request)`.
- `charli3_odv_client.core.aggregation.build_aggregate_message(list[msg])`:
  verifies signatures, returns the `AggregateMessage` used as the ODV
  redeemer.
- `charli3_odv_client.core.transaction_builder.ODVTransactionBuilder`:
  `build_odv_tx(node_messages, signing_key, change_address, validity_window)`
  assembles the ODV transaction locally. You still need node signatures via
  `collect_tx_signatures` + `ODVClient.attach_signature_witnesses`.
- `charli3_odv_client.cli.utils.shared.create_chain_query` and
  `setup_transaction_builder` - the one liner that wires Ogmios+Kupo or
  Blockfrost into a `ChainQuery` and hands you `TransactionManager` +
  `ODVTransactionBuilder`.
- `charli3_odv_client.config.ODVClientConfig.from_yaml(path)`: loads the same
  YAML shape we copied into `configs/ada-usd-preprod.yml`.
- `charli3_odv_client.config.KeyManager.load_from_config(wallet_config)`:
  derives `(signing_key, pay_vk, stake_vk, change_address)` from a BIP-39
  mnemonic via HD wallet derivation path `m/1852'/1815'/0'/0/0`.
- `charli3_odv_client.models.datums`: holds the Plutus datum shapes. See
  below.

Depending on the SDK directly from its GitHub `main` is fine; the
`pyproject.toml` here pins it via a `git+https://...` requirement. The SDK
uses a Charli3 fork of pycardano on branch
`fix/odv-multisig-v0.17.0-kupo-additions`.

## Two transaction flow

The pull oracle has two transactions, both submitted to the same Cardano
node in the same block:

1. ODV transaction. Writes the aggregated signed price data to the oracle
   script address at `addr_test1wq3p...`. The datum is an `OracleDatum`
   variant wrapping an `AggState { price_data: PriceData { price_map: ... } }`.
2. dApp transaction (ours, Saturday). Consumes user funds at our
   settlement-agent validator address, reads the ODV output from step 1 as
   a reference input, decodes `PriceData`, and releases funds when the
   price crosses the user-defined trigger.

FrontendDev wires step 1 behind a single callable endpoint that returns
`(tx_hash, price, timestamp, expiry)` and then triggers step 2.
SmartContractDev writes the on-chain validator that reads step 1's datum.

## On-chain datum shape (canonical)

From live Preprod, UTxO at `addr_test1wq3pacs...` carrying the C3AS
(`AggState`) NFT with asset name `43334153`:

```
datum_hash: 841ea094b1ad26aba8053d45a640e0f9fcfec2069d366fd419980cfed09ca330
inline datum CBOR (hex):
  d8799fd87b9fa3001a0003f194011b0000019d98de0788021b0000019d98e72f48ffff
```

CBOR tree:

```
d8799f                  Constr 0 + indefinite array  (AggState, CONSTR_ID=0)
  d87b9f                Constr 2 + indefinite array  (PriceData, CONSTR_ID=2)
    a3                  map, 3 entries                (price_map)
      00 1a 0003f194    0 -> uint 258452              (price, 6 dp -> 0.258452 USD/ADA)
      01 1b 0000019d98de0788
                         1 -> uint 1776386294152      (timestamp, ms since epoch)
      02 1b 0000019d98e72f48
                         2 -> uint 1776386894152      (expiry, ms since epoch)
  ff                    end PriceData
ff                      end AggState
```

Decode this off-chain with the SDK:

```python
from charli3_odv_client.models.datums import AggState
agg = AggState.from_cbor(utxo.output.datum.cbor)
price    = agg.price_data.price_map[0]   # int, 6 decimal places
ts_ms    = agg.price_data.price_map[1]   # milliseconds since epoch
expiry   = agg.price_data.price_map[2]   # milliseconds since epoch
```

Full `OracleDatum` union includes `AggState`, `OracleSettingsVariant`, and
`RewardAccountVariant`. Only `AggState` carries price data. Filter by the
`43334153` asset name when fetching the reference UTxO (see below).

## Oracle identifiers (ADA/USD Preprod)

Take these verbatim when you write the Aiken validator or the frontend
reference-input lookup.

| Field                   | Value |
| ----------------------- | ----- |
| Oracle script address   | `addr_test1wq3pacs7jcrlwehpuy3ryj8kwvsqzjp9z6dpmx8txnr0vkq6vqeuu` |
| Oracle NFT policy id    | `886dcb2363e160c944e63cf544ce6f6265b22ef7c4e2478dd975078e` |
| AggState asset name     | `43334153` (ASCII "C3AS"; this UTxO holds the price datum) |
| RewardAccount asset name| `43335241` (ASCII "C3RA"; NOT the price feed) |
| Reference script addr   | `addr_test1wrtqtdlqc66rzl2hcjhq5p0dfmalw944pwcne6p5kafthhqtzp03x` |
| Reference script utxo   | tx `7a69e9d3d90826f861107e4b503c56e08c40d092416a50bad37fc89865a78cd1` idx 0 |

### Node operators

Two Preprod node operators with public IPs and published ed25519 pub keys:

- `http://35.208.117.223:8001` pub `582037c6febc9c2f940a38a5c1ea35eb9353ae233497bf9564395c76bf7b0590c4eb`
- `http://35.208.117.223:8002` pub `58205a23e6016659b8c644efcb49301184f6d712037579df6793a50eae332f510248`

These two nodes are what `collect_feed_updates` polls. Each returns a
signed `OracleNodeMessage { feed, timestamp, oracle_nft_policy_id }`, the
SDK verifies ed25519 signatures and aggregates into a sorted map. Both
nodes must agree for the median to converge on a single price.

### Sample per-node signed feed (OracleNodeMessage CBOR)

From a live Preprod call at chain slot 120719689:

```
cbor_hex: d8799f1a0003db1b1b0000019d99dbe7b8581c886dcb2363e160c944e63cf544ce6f6265b22ef7c4e2478dd975078eff
median:   252699                 (ADA/USD, 6 decimal places -> 0.252699)
ts_ms:    1776402819000          (2026-04-17T05:13:39Z)
policy:   886dcb2363e160c944e63cf544ce6f6265b22ef7c4e2478dd975078e
```

Structure: `Constr 0 [uint feed, uint timestamp, bytes policy_id]`.

Per-node messages are signed off-chain and never hit the chain directly.
What the validator must decode is the aggregated `AggState` datum above.

## Authentication with oracle nodes

None. The nodes are open HTTP endpoints behind plain IPs. There is no API
key, bearer token, or signature on our side of the `POST /odv/feed`
request. Our only "auth" is that the SDK verifies the ed25519 signatures on
each node response against their published pub keys. Config file carries
the pub keys, so swapping pub keys would be noticed immediately.

## Feed expiry and freshness

The on-chain `PriceData` carries:

- `price_map[1]`: the feed creation timestamp (ms since epoch)
- `price_map[2]`: the expiry timestamp (ms since epoch)

Spread between the two is controlled by the oracle settings, but the live
`AggState` I sampled had expiry = creation + 600000 ms (10 minutes). Our
`odv_validity_length` in the client config is 300000 ms (5 minutes); that
is the validity window we ask the nodes to sign over, not the on-chain
expiry of the datum.

Validator rule (enforce in Aiken): `tx.validity_range.start < price_map[2]`
i.e. the transaction consuming the reference input must start before the
oracle datum expires. Drop the tx otherwise. Do not fall back to "use the
last known price" - stale oracle data is the demo bomb.

## Preprod gotchas and SDK friction

1. Python 3.12 is NOT supported. The SDK pins `python = ">=3.10,<3.12"`.
   We use Python 3.11 via `/home/hermes/.local/bin/python3.11` and a venv
   at `oracle-client/.venv`. Do not try `python3.12 -m venv`.
2. The `ODVClientConfig.from_yaml` loader validates `wallet` before any
   feed call. You cannot collect feeds with an empty wallet section. The
   config uses the BIP-39 test vector mnemonic ("abandon ... about") as a
   default via the `WALLET_MNEMONIC` env var; this is fine for reading
   feeds, but you MUST override it with a real mnemonic before attempting
   to submit the ODV tx. The sample wallet has zero Preprod ADA and will
   fail collateral selection.
3. The sample config in `hackathon-resources/configs/ada-usd-preprod.yml`
   points at `10.20.0.x` internal IPs. Those are unreachable from outside
   Charli3's VPC. Override with the public endpoints:
   `ws://35.209.192.203:1337` (Ogmios) and `http://35.209.192.203:1442`
   (Kupo). Both are live and responding.
4. Ogmios URL scheme is `ws://` (not `http://`). The SDK's
   `create_chain_query` parses the scheme and passes `secure=False` when
   it is `ws://`. Using `http://` or `https://` will crash.
5. First cold-connection feed request is ~1.5 seconds (websocket handshake
   to Ogmios + TCP setup to both nodes). Warm latency sits around 280 ms,
   matching the TECHNICAL-BRIEF's 300 ms number. For the demo, make the
   first call eagerly at page load so the on-stage call is the warm one.
6. The on-chain datum lives on the UTxO carrying the `43334153` asset
   name ("C3AS"). The other UTxOs at the same oracle address carry
   `43335241` ("C3RA" reward account) datums that have a totally different
   shape and will not decode as `AggState`. Filter by asset name when
   picking the reference input.
7. `tx_manager.calculate_validity_window` depends on the network's genesis
   parameters; pycardano's `OgmiosV6ChainContext` fetches these from the
   node. If the node is stuck, validity windows come out wrong and node
   feed requests fail validation. `poll_price.py --verbose` shows the tip
   slot on every run so you can eyeball freshness.

## Live feed metrics (Friday 2026-04-17)

Sampled at chain slot 120719689 (time_ms 1776402819000) on the Charli3
Preprod instance:

| Metric                    | Value |
| ------------------------- | ----- |
| Nodes configured          | 2 |
| Nodes responded           | 2 (100 percent) |
| Cold first-call latency   | 1643.27 ms |
| Warm median latency (n=3) | ~280 ms |
| Median price (6 dp)       | 252699 -> 0.252699 USD/ADA |
| Validity window length    | 300000 ms (5 minutes) |

Reproduce: `oracle-client/.venv/bin/python oracle-client/poll_price.py`
or append `--json` for machine output.

## Disqualification defense paragraph (draft for README)

"Without the Charli3 pull oracle, this project cannot function because
the settlement release trigger fires only when a price threshold is
crossed, and the settlement validator reads that price directly from the
Charli3 AggState datum (oracle NFT policy
886dcb2363e160c944e63cf544ce6f6265b22ef7c4e2478dd975078e, asset name
C3AS) as a reference input. Strip the oracle out and the on-chain
validator has no price input, no trigger, and nothing to release."

Product Strategist: paste that sentence into the README and replace
"cannot function" with the right verb if the product concept pivots.

## What SmartContractDev needs Saturday morning

1. Oracle identifiers table above.
2. `AggState` CBOR decoding in Aiken via CIP-0057 data declarations. I
   will paste the Aiken type definitions and a minimal validator that
   reads the reference input into the repo once we have
   `contracts/aiken.toml` scaffolded.
3. A live reference input the validator can test against:
   `(tx e1ec53ebae43599066f9fdfe26d431bad0588871369556a3741f633bfbb68842,
   idx 1)` which currently holds the C3AS NFT and price datum. This moves
   every time a new ODV tx lands, so do not hardcode it for the final
   demo - look it up by policy and asset name.

## What FrontendDev needs Saturday morning

A callable `request_fresh_price()` that wraps the ODV tx submission and
settlement release into a single user-triggered flow, returning the
price, timestamp, tx hash pair. Shape to be delivered as
`offchain/src/oracle.py` by end of Saturday.
