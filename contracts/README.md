<!-- SPDX-License-Identifier: MIT -->

# contracts

Aiken on-chain code for the price-conditional settlement escrow. The validator locks a UTxO with a settlement rule (threshold price, beneficiary, expiry) and releases the funds only when a reference-input oracle reading from Charli3's on-demand pull oracle satisfies that rule.

This directory is the Aiken workspace. Build output is `plutus.json` at the contracts root, which is the blueprint the off-chain team imports.

## Layout

```
contracts/
  aiken.toml            Aiken project manifest (MIT, plutus v3)
  lib/
    oracle.ak           Decoder for the Charli3 GenericData / PriceData datum
  validators/
    escrow.ak           The price-conditional settlement validator + tests
  plutus.json           Compiled blueprint (committed; regenerate with aiken build)
```

## Quickstart

```sh
aiken check     # type-check + run tests
aiken build     # emit plutus.json blueprint
aiken blueprint address --stake none           # Preprod testnet address
aiken blueprint apply                           # parameterize (not used here)
```

## Validator contract

`escrow.escrow.spend` is a Plutus V3 spending validator with two redeemer paths.

### Datum: `EscrowDatum`

| Field               | Type                   | Meaning                                                              |
|---------------------|------------------------|----------------------------------------------------------------------|
| `beneficiary`       | `VerificationKeyHash`  | Pubkey allowed to spend along the `Release` path                     |
| `sender`            | `VerificationKeyHash`  | Pubkey allowed to spend along the `Reclaim` path after expiry        |
| `trigger_price`     | `Int`                  | Threshold price in the oracle's native integer scaling               |
| `direction`         | `Direction`            | `Above` = release when oracle >= trigger, `Below` = when oracle <=   |
| `expiry_posix`      | `Int`                  | POSIX milliseconds after which `Reclaim` becomes valid               |
| `max_staleness_ms`  | `Int`                  | Max age (ms) of the oracle reading at tx submission time             |
| `oracle_policy_id`  | `PolicyId`             | Policy of the authentication NFT on the canonical oracle UTxO        |
| `oracle_asset_name` | `AssetName`            | Asset name of that NFT                                               |

### Redeemer: `EscrowRedeemer`

- `Release` — beneficiary path. Requires:
  1. Exactly one reference input carries `(oracle_policy_id, oracle_asset_name)` with quantity 1.
  2. That input's inline datum decodes as `GenericData { AggState { PriceData { price_map } } }` with all three keys (0=price, 1=timestamp, 2=expiry).
  3. The tx validity range `[lo, hi]` is finite and sits inside `[timestamp, min(expiry, timestamp + max_staleness_ms)]`.
  4. `reading.price` is on the rule-correct side of `trigger_price`.
  5. `beneficiary` signed (appears in `extra_signatories`).
- `Reclaim` — sender path. Requires the tx validity range lower bound to be at or after `expiry_posix`, and `sender` to have signed.

### On-chain oracle datum decoding

The helper module `lib/oracle.ak` mirrors Charli3's Python datum (`charli3_odv_client.models.datums`) with its exact constructor indices:

```
GenericData { constr=0, price_data: PriceData }
PriceData   { constr=2, price_map: { 0: price, 1: timestamp, 2: expiry } }
```

We reserve two placeholder variants in `PriceData` so the Aiken constructor index lands on 2, matching Python's `CONSTR_ID = 2`.

## Tests

Run under `aiken check`. Current coverage:

| Test                                            | Module  | Expectation |
|-------------------------------------------------|---------|-------------|
| `read_extracts_three_fields`                    | oracle  | decoder returns price / timestamp / expiry |
| `release_above_trigger_ok`                      | escrow  | pass when oracle price above trigger, fresh, signed |
| `release_blocked_below_trigger`                 | escrow  | fail when oracle price below trigger |
| `reclaim_after_expiry_ok`                       | escrow  | pass when tx.lower >= expiry and sender signed |
| `reclaim_before_expiry_blocked`                 | escrow  | fail when reclaiming before expiry |
| `release_without_beneficiary_signature_blocked` | escrow  | fail when beneficiary signature missing |
| `release_with_stale_feed_blocked`               | escrow  | fail when feed age exceeds `max_staleness_ms` |

## Handoff to off-chain

- Blueprint: `contracts/plutus.json` (aiken build emits this; it is committed to the repo).
- Validator title: `escrow.escrow.spend`.
- Current compiled script hash: `7be1b3118432532a1761b4dca491baf7a2c8ec28355d14d3f1074d8d`.
- Current Preprod testnet address: `addr_test1wpa7rvc3sse9x2shvx6defy3htm69j8v9q6469xn7yr5mrgzaqyn9`.

Off-chain consumers should parse the blueprint with PyCardano's `PlutusV3Script` / `ScriptHash` helpers and build the `EscrowDatum` / `EscrowRedeemer` PlutusData classes mirroring the schema above.

## License

MIT. Do not copy code from the AGPL `charli3-pull-oracle-sdk`; the datum shape reproduced in `lib/oracle.ak` is the public `docs.charli3.io` standard only.
