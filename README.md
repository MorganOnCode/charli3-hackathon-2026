# Price-conditional settlement on Cardano

Lock ADA with a price rule, and it pays out the moment [Charli3](https://charli3.io)'s ODV pull oracle proves the rule is true, in a single Cardano transaction.

Built for the [Charli3 Hackathon](https://charli3.io), April 17 to 19, 2026. Primary track: **Best in Real World Settlements**. Compound target: **People's Choice**.

## What this is

A depositor locks ADA in an on-chain Aiken escrow with one rule: release to the beneficiary when ADA/USD crosses a trigger. An off-chain Python agent watches Charli3's ODV feed, builds the ODV transaction, and submits a settlement transaction in the same block. The Aiken validator refuses to release the payout unless Charli3's oracle UTXO, attached as a reference input, proves the trigger is satisfied. Remove the oracle and the release never fires.

## Why it matters

Cardano has swaps. It does not yet have a settled, atomic, price-conditional payment rail. This project ships that rail. The same validator supports automated remittance at spot, invoice settlement at today's FX, DAO treasury rebalancing, and automated liquidation for under-collateralized positions. Every product on top of the rail inherits the same property: no custodian, no second signer, no off-chain promise.

## How the oracle is used

Charli3's ODV pull oracle is not a data source we read. It is a piece of infrastructure we transact against. The Python agent requests the ODV feed using the [Charli3 client SDK](https://pypi.org/project/charli3-pull-oracle-client/) (MIT) and attaches the oracle UTXO as a reference input to our settlement transaction. The Aiken validator at `contracts/validators/escrow.ak` decodes the oracle's `PriceData` CBOR from the reference input and enforces the trigger rule on-chain. If the oracle is absent or expired, the transaction fails and the funds stay locked. The hackathon's "meaningfully uses the oracle" requirement is satisfied by the script itself, not by a client-side check.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full diagram and interface contracts (owned by CTO). Three components:

- `oracle-client/` Python agent (PyCardano + Charli3 client SDK). Watches the ODV feed, composes the combined ODV update and settlement transaction, submits via Ogmios on Preprod.
- `contracts/` Aiken smart contracts (Plutus V3). `escrow.ak` gates every payout on the oracle reference input. Datum: beneficiary, trigger price, direction (above or below), expiry slot. Redeemer paths: `Release` (oracle-gated payout) and `Reclaim` (depositor refund after expiry).
- `web/` Vite + React + TypeScript front end. CIP-30 wallet connect targeting Lace, live price panel reading the oracle, deposit form, and a settlement panel that shows the three demo moments live.

## Canonical stack

- Off-chain: Python 3.11 on [PyCardano](https://pycardano.readthedocs.io), using [`charli3-pull-oracle-client`](https://pypi.org/project/charli3-pull-oracle-client/) (MIT).
- On-chain: [Aiken](https://aiken-lang.org) (Plutus V3).
- Frontend: React, Vite, TypeScript. Wallet via [CIP-30](https://cips.cardano.org/cip/CIP-30).
- Network: Cardano Preprod. Ogmios `http://35.209.192.203:1337/`. Kupo `http://35.209.192.203:1442/`.

## Status

- April 17, 2026 (Day 1): repo scaffolded, oracle feed reading on Preprod, Aiken escrow skeleton, wallet connection panel, pitch and criteria map drafted.
- April 18, 2026 (Day 2): end-to-end settlement on Preprod. Demo video recorded by 4:00 PM Bangkok.
- April 19, 2026 (Day 3): submission at 10:00 PM Bangkok.

## Quickstart

_Landing Saturday. Will cover local Preprod setup, running `poll_price.py`, building `escrow.ak` with `aiken check`, and bringing up `web` with `pnpm dev`._

## Demo

_Link lands Saturday evening. The recorded walk through is 2 to 3 minutes and covers three moments: deposit, price cross, release. The live Sunday demo follows the same three moments._

## License and provenance

MIT. See [LICENSE](./LICENSE). All code written April 16 to 19, 2026 for this hackathon. We depend on `charli3-pull-oracle-client` (MIT). We do **not** use `charli3-pull-oracle-sdk` (AGPL-3.0) because its copyleft terms would contaminate our MIT release.

## Team

Four-day venture. Six agent roles plus the Human Founder and CEO.

- CTO: architecture, interface contracts, CI.
- Oracle Integration Engineer: Charli3 ODV flow, end to end.
- Cardano Smart Contract Developer: Aiken escrow validator.
- Frontend and Demo UI Developer: React and CIP-30 wallet connection.
- Product Strategist and Community Manager: pitch, README, judging-criteria map, daily check-ins.
- Demo Director: Sunday live demo, 2 to 3 minute video.

Every commit co-authored `Paperclip <noreply@paperclip.ing>`.
