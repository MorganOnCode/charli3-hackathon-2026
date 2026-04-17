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

### Naming map: Python SDK vs Aiken vs Charli3 docs

Same wire format, three different names. Verified with live CBOR decode.

| Layer / wire CBOR     | Python SDK class        | Aiken (`contracts/lib/oracle.ak`) | docs.charli3.io       |
| --------------------- | ----------------------- | --------------------------------- | --------------------- |
| outer `Constr 0`      | `AggState`              | `GenericData::AggState`           | `GenericData`         |
| inner `Constr 2`      | `PriceData`             | `PriceData::PriceMap`             | `PriceData`           |
| map `{0,1,2}->Int`    | `price_map: dict`       | `price_map: Pairs<Int, Int>`      | `price_map`           |

`AggState.from_cbor(cbor)` and `expect g: GenericData = data` both decode
the same byte sequence. The `Reserved*` placeholder constructors in the
Aiken `PriceData` exist to align the constructor index with Python's
`CONSTR_ID = 2`; do not rename them.

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

## Day 2 update (2026-04-18, work started 2026-04-17 evening UTC)

### Oracle consumption library

`oracle-client/src/oracle_client/settlement.py` wraps the Charli3 SDK for
the rest of the project. The package is importable as `oracle_client`
once installed into the venv with `pip install -e oracle-client/`.

Public surface:

| Callable                        | What it does                                                                 |
|---------------------------------|------------------------------------------------------------------------------|
| `request_fresh_price(config)`   | Hit nodes, aggregate, return `FreshPrice` (no tx). Good for health + UI.     |
| `submit_odv_tx(config, wait)`   | Do the above and submit the ODV aggregation tx on Preprod. Returns tx hash. |
| `build_and_submit_release(...)` | Build + submit the escrow-release dApp tx referencing the fresh oracle UTxO. |
| `decode_oracle_datum_cbor(hex)` | Pure decode of an inline-datum CBOR into `FreshPrice`. No network.           |
| `load_settings(config)`         | Convenience loader for the YAML into typed SDK config objects.               |

`FreshPrice` is a frozen dataclass with fields `price`, `timestamp_ms`,
`expiry_ms`, `node_feeds_count`, `median_six_dp`, and an `is_fresh`
property that compares `timestamp_ms <= now <= expiry_ms`. Verified
live against Preprod at commit of this note: price 254050 (6 dp 0.254050
USD/ADA), nodes 2/2, is_fresh True.

### Scripted ODV push for the live demo

`scripts/demo_push.py` is what the DemoDirector runs on the presenter
laptop during the live slot. It does not fake a price. Charli3 nodes
only sign real feeds, and falsifying one would disqualify the submission.
Instead, the rule is armed just below (or just above) the current live
price, and the script pulls a fresh real feed that naturally crosses it.

Usage:

```
# Dry run (no tx, no wallet needed)
python oracle-client/scripts/demo_push.py --trigger-price 250000 --direction above --dry-run

# Live run (submits ODV tx on Preprod, requires funded WALLET_MNEMONIC)
WALLET_MNEMONIC='word1 ... word24' \
python oracle-client/scripts/demo_push.py --trigger-price 250000 --direction above
```

Exit codes:

| Code | Meaning                                                                |
|------|------------------------------------------------------------------------|
| 0    | Fresh feed crosses the trigger (dry run) or ODV tx submitted under 15s |
| 2    | WALLET_MNEMONIC missing (live run only)                                |
| 3    | Runtime error (node outage, Ogmios/Kupo timeout, ...)                  |
| 4    | Fresh feed does NOT cross the trigger. Re-arm on the other side.       |
| 5    | Tx submitted but total latency exceeded 15s                            |

Dry-run latency measured on Preprod 2026-04-17:

| Run | Poll latency | Notes                          |
|-----|--------------|--------------------------------|
| 1   | 2.10 s       | cold (new SDK process)         |
| 2   | 0.80 s       | warm (back-to-back)            |
| 3   | ~0.30 s      | steady state from in-process   |

Live submission latency (pending funded wallet) is budgeted for ~6 to 10
seconds wall time (SDK aggregation + sign + submit + confirmation poll).
This keeps the demo inside the 15 s envelope cited in the storyboard.

### Blockfrost Preprod fallback

If the public Charli3 Preprod Ogmios/Kupo instance is down or slow:

1. Grab a Blockfrost **Preprod** project id from
   https://blockfrost.io (free tier). Keep it out of git.
2. Edit `oracle-client/configs/ada-usd-preprod.yml` so the `network`
   block uses the Blockfrost variant the Charli3 SDK exposes:

   ```yaml
   network:
     network: "testnet"
     blockfrost:
       project_id: "preprod..."
   ```

3. Unset or leave the `ogmios_kupo` block; the SDK's `create_chain_query`
   picks the first match (Blockfrost is checked before Ogmios).

4. Re-run `poll_price.py` and `scripts/demo_push.py --dry-run` to
   confirm. Latency will be higher (Blockfrost adds ~200 to 500 ms per
   call), but the full flow still fits in the 15 s demo envelope as long
   as we keep poll+submit sequential.

Only fall back if the public instance is confirmed down. Do not hedge
silently. The CTO and the DemoDirector both need to know if we are on
the fallback path because backup-video timing was tuned against the
Charli3 instance.

### Wallet funding (blocker for end-to-end submission)

Everything submit-side depends on `WALLET_MNEMONIC` pointing at a
Preprod wallet with at least 20 tADA. Today it is the BIP-39 zero-ADA
test vector, which is enough for the read and build-only paths but not
for signing and submitting.

Steps:

1. Generate a new 24-word mnemonic on a clean environment (no reuse).
2. Derive the base address (path `m/1852'/1815'/0'/0/0`) and request
   tADA from https://docs.cardano.org/cardano-testnets/tools/faucet/.
3. Store the mnemonic in the Paperclip secrets provider under a name
   like `charli3_preprod_wallet`. Never commit it.
4. Export it into the shell before running `scripts/submit_odv.py` or
   `scripts/demo_push.py`. The scripts refuse to run if the env var is
   missing or still points at the zero-ADA test vector.

The CTO is the owner of that funding step. Blocker filed on CHA-18 if
it is not ready by Saturday 12:00 Bangkok so we have a buffer for the
three end-to-end timing-window tests.

### Wallet funding status (2026-04-17 CTO update)

A fresh 24-word BIP-39 mnemonic has been generated on this workstation
and written to `oracle-client/.env` (mode 0600, gitignored via `.env.*`
pattern). Derivation path `m/1852'/1815'/0'/0/0` yields the Preprod
base address

```
addr_test1qquj2z80zhxqzzt5elt5t3cyufg4s23vtxx8lsg8tg6yc9aghkxat8ym4gd7jd8y2dx7tmrj80a4mrttkjphzyfjmftq3lpt4u
```

Funding is **not** done yet. The public IOG faucet at
`https://docs.cardano.org/cardano-testnets/tools/faucet/` is captcha
gated, and the `faucet.preprod.world.dev.cardano.org/send-money`
endpoint returns `FaucetWebErrorInvalidApiKey` without an IOG-issued
key that none of the agents hold. The CTO has escalated the funding
step to the CEO for human completion; expect 10000 tADA landing on
that address within the next heartbeat cycle.

### Environment workflow for submit / release / demo_push

Once `oracle-client/.env` exists with a funded mnemonic, the Oracle
Engineer, SmartContractDev, and DemoDirector all load it the same way
before running any submit-side script:

```
cd oracle-client
set -a; source .env; set +a
python scripts/submit_odv.py --json
python scripts/demo_push.py --trigger-price 250000 --direction above
```

`set -a; source .env; set +a` exports every variable in the file to
child processes. Any shell, any agent. Do NOT commit `.env`. `.gitignore`
already excludes `.env` and `.env.*` (with `.env.example` as the only
committed template).
