# Architecture

Price-conditional settlement agent on Cardano, driven by the Charli3 ODV pull oracle.

## One-line description

A user locks funds in an escrow validator behind a price trigger. When the trigger is met, an off-chain agent pulls fresh signed price data from Charli3 oracle nodes, writes it to the oracle UTXO, and releases the escrow in the same block.

## System overview

```
+------------------+        1. lock funds + trigger rule       +----------------------+
|   Browser        |  ---------------------------------------> |  Escrow Validator    |
|   (React + CIP-30)|                                           |  (Aiken, Plutus V3)  |
+------------------+                                           +----------------------+
        |                                                                 ^
        | 2. request settlement                                           | 5. redeem with
        v                                                                 |    oracle reference
+------------------+   3. HTTP: get signed    +-----------------+         | input
|  Settlement      |   price feed messages    | Charli3 Oracle  |         |
|  Agent           |   ---------------------> | Node Operators  |         |
|  (Python /       |                          | (off-chain)     |         |
|   PyCardano /    |   <---------------------                    |         |
|   charli3-pull-  |   signed feed bytes                         |         |
|   oracle-client) |                                                       |
+------------------+                                                       |
        |                                                                 |
        | 4. build + submit ODV tx writing aggregated price to oracle UTXO|
        v                                                                 |
+------------------+                                                       |
| Cardano Preprod  |-------------------------------------------------------+
| node (Ogmios)    |  same block: oracle UTXO created, escrow redeemed
+------------------+  referencing that oracle UTXO as reference_input
```

## Transaction pair

The oracle is a request-response pull oracle. A settlement requires two transactions submitted to the same node, landing in the same block:

1. **ODV transaction.** Built by the off-chain agent. Inputs: oracle nodes' aggregated signatures. Output: a UTXO at the Charli3 oracle script carrying `GenericData { price_data: PriceData { price_map: { 0: price, 1: timestamp, 2: expiry } } }` in its datum.
2. **Settlement transaction.** Built by the off-chain agent. Inputs: the user's escrow UTXO. Reference inputs: the oracle UTXO created by (1), read pre-finalization. Output: funds to the beneficiary per the escrow datum's payout rule. The validator decodes the reference input's datum, extracts `price_map[0]`, compares against the trigger rule, enforces beneficiary address and amount, and approves.

Latency between (1) and (2) is roughly 300 ms. Same node, same block.

## Subsystem interfaces

### oracle-client (Python, off-chain)

Owner: Oracle Integration Engineer.

Public surface consumed by the settlement agent and the web backend:

```python
# oracle_client/settlement.py  (contract, not final signature)

from dataclasses import dataclass
from pycardano import Address, UTxO, Transaction

@dataclass
class TriggerRule:
    feed_id: str          # e.g. "ADA/USD"
    direction: str        # "above" | "below"
    threshold_micros: int # 6 decimals, same scale as oracle price_map[0]

@dataclass
class EscrowContext:
    escrow_utxo: UTxO
    beneficiary: Address
    trigger: TriggerRule

async def fetch_oracle_utxo(feed_id: str) -> tuple[UTxO, Transaction]:
    """Request signed feed messages, aggregate, build ODV tx. Return (oracle_utxo_ref, odv_tx)."""

async def build_settlement_tx(
    ctx: EscrowContext,
    oracle_utxo: UTxO,
) -> Transaction:
    """Build the settlement tx referencing the oracle UTXO as reference input."""

async def submit_pair(odv_tx: Transaction, settlement_tx: Transaction) -> str:
    """Submit both txs to the same node. Returns the settlement tx hash."""
```

### contracts (Aiken, on-chain)

Owner: Cardano Smart Contract Developer.

Public surface, one validator:

- `validators/settlement_escrow.ak`: parameterized by the Charli3 oracle script hash. Datum: `EscrowDatum { beneficiary: Address, trigger: TriggerRule, refund_after: PosixTime, depositor: Address }`. Redeemer: `Redeem { Release | Refund }`. Release requires a reference input at the oracle script, decoded as `GenericData`, with `price_map[0]` satisfying the trigger and `price_map[2]` (expiry) not yet elapsed. Refund requires `refund_after` to have passed.

Blueprint output (`plutus.json`) is committed at `contracts/plutus.json` so the off-chain agent can load the validator hash and build escrow addresses. The blueprint is the handoff contract.

### web (React + Vite, frontend)

Owner: Full-Stack Frontend Developer.

Public surface, three screens:

- `/` — connect wallet (CIP-30), show ADA/USD spot from the oracle-client backend, CTA to "Create a price-triggered settlement."
- `/create` — form: feed, direction, threshold, beneficiary address, amount, refund-after. Builds and submits the lock transaction via CIP-30 `signTx`.
- `/settlement/:txHash` — status page. Polls the oracle-client backend for trigger state. When triggered, shows "Settling..." then "Settled" with the settlement tx hash.

The web app talks to the oracle-client over a thin JSON HTTP surface at `/api/*` (served by the oracle-client process or a sidecar):

```
GET  /api/spot?feed=ADA/USD                -> { price, timestamp, expiry }
POST /api/escrow/build-lock                -> { cbor, witnessSet }  # for CIP-30 signTx
POST /api/escrow/watch  { escrowTxHash }   -> { status: "armed" | "ready" | "settled" | "refundable" }
POST /api/escrow/settle { escrowTxHash }   -> { settlementTxHash }
```

## Handoff order (Day 1 into Day 2)

1. Today: repo layout, ARCHITECTURE.md, CI stubs. Oracle Engineer clones `charli3-pull-oracle-client` and reads `datum-demo-v3`.
2. Tomorrow AM: Smart Contract Dev lands the validator skeleton and publishes `plutus.json`. Oracle Engineer lands `fetch_oracle_utxo`. Frontend Dev lands wallet connect and the create form mocked against a fake backend.
3. Tomorrow PM: integrate. First end-to-end lock → trigger → release on Preprod.

## What is out of scope for the submission

- Mainnet deployment.
- Multiple feeds beyond ADA/USD.
- Non-ADA settlement assets.
- A dispute mechanism. Refund-after timeout is the only recovery path.

## License boundary

We depend on `charli3-pull-oracle-client` (MIT). We do not import `charli3-pull-oracle-sdk` (AGPL-3.0). Any code sample adapted from `datum-demo-v3` or the swap-contract demo is reviewed for license headers before inclusion.
