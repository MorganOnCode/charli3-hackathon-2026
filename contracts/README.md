<!-- SPDX-License-Identifier: MIT -->

# contracts

Aiken on-chain code for the price-conditional settlement escrow. The validator locks a UTxO with a settlement rule (threshold price, beneficiary, expiry) and releases the funds only when a reference-input oracle reading from Charli3's on-demand pull oracle satisfies that rule.

The oracle identity (policy id + asset name of the authentication NFT on the canonical oracle UTxO) is a **compile-time parameter** of the validator, not a datum field. That pins the entire on-chain feed we will accept at blueprint-apply time and prevents a look-alike reference input from slipping past the validator.

This directory is the Aiken workspace. Build output is `plutus.json` at the contracts root, which is the blueprint the off-chain team imports.

## Layout

```
contracts/
  aiken.toml            Aiken project manifest (MIT, plutus v3)
  lib/
    oracle.ak           Decoder for the Charli3 GenericData / PriceData datum
  validators/
    escrow.ak           The price-conditional settlement validator + tests
  plutus.json           Compiled blueprint (committed; Preprod-applied)
```

## Quickstart

```sh
aiken check                                           # type-check + run tests
aiken build                                           # emit un-parameterized blueprint (overwrites plutus.json)
aiken blueprint apply -m escrow -v escrow <policy-cbor>   # apply oracle_policy (1/2)
aiken blueprint apply -m escrow -v escrow <asset-cbor>    # apply oracle_asset  (2/2)
aiken blueprint address -m escrow -v escrow           # Preprod testnet address
```

The committed `plutus.json` is the Preprod-applied variant. If you run `aiken build`, it is regenerated in its un-parameterized form and the pinned Preprod address below will change. Re-apply the two parameters (see **Preprod parameters** below) to restore the canonical build.

## Validator contract

`escrow.escrow.spend` is a Plutus V3 spending validator parameterized by the oracle NFT identity.

### Parameters (compile-time)

| Parameter        | Type        | Meaning                                                                    |
|------------------|-------------|----------------------------------------------------------------------------|
| `oracle_policy`  | `PolicyId`  | Policy id of the authentication NFT on the canonical oracle UTxO           |
| `oracle_asset`   | `AssetName` | Asset name of that NFT                                                     |

### Datum: `EscrowDatum`

| Field               | Type                   | Meaning                                                              |
|---------------------|------------------------|----------------------------------------------------------------------|
| `beneficiary`       | `VerificationKeyHash`  | Pubkey allowed to spend along the `Release` path                     |
| `sender`            | `VerificationKeyHash`  | Pubkey allowed to spend along the `Reclaim` path after expiry        |
| `trigger_price`     | `Int`                  | Threshold price in the oracle's native integer scaling               |
| `direction`         | `Direction`            | `Above` = release when oracle >= trigger, `Below` = when oracle <=   |
| `expiry_posix`      | `Int`                  | POSIX milliseconds after which `Reclaim` becomes valid               |
| `max_staleness_ms`  | `Int`                  | Max age (ms) of the oracle reading at tx submission time             |

### Redeemer: `EscrowRedeemer`

- `Release`: beneficiary path. Requires:
  1. Exactly one reference input carries `(oracle_policy, oracle_asset)` with quantity 1.
  2. That input's inline datum decodes as `GenericData { AggState { PriceData { price_map } } }` with all three keys (0=price, 1=timestamp, 2=expiry).
  3. The tx validity range `[lo, hi]` is finite and sits inside `[timestamp, min(expiry, timestamp + max_staleness_ms)]`.
  4. `reading.price` is on the rule-correct side of `trigger_price`.
  5. `beneficiary` signed (appears in `extra_signatories`).
- `Reclaim`: sender path. Requires the tx validity range lower bound to be at or after `expiry_posix`, and `sender` to have signed.

### `Direction` variants

`Above` and `Below` only. We considered adding an `Equals` variant for exact-match settlement and decided against it based on the empirical feed data OracleEngineer captured during CHA-18 (live Preprod prices 252827, 254050, 255685, 258452 across back-to-back polls). The feed moves by hundreds to thousands of integer units per tick, so `price == trigger` is a measure-zero event in practice. `Above` with a tight band is the semantically correct consumer pattern; `Equals` would simply be unreachable on this feed.

### On-chain oracle datum decoding

The helper module `lib/oracle.ak` mirrors Charli3's Python datum (`charli3_odv_client.models.datums`) with its exact constructor indices:

```
GenericData { constr=0, price_data: PriceData }
PriceData   { constr=2, price_map: { 0: price, 1: timestamp, 2: expiry } }
```

We reserve two placeholder variants in `PriceData` so the Aiken constructor index lands on 2, matching Python's `CONSTR_ID = 2`.

## Preprod parameters (baked into `plutus.json`)

The committed blueprint is parameterized with the live Preprod Charli3 ADA/USD feed:

| Parameter        | Value                                                          | CBOR                                                           |
|------------------|----------------------------------------------------------------|----------------------------------------------------------------|
| `oracle_policy`  | `886dcb2363e160c944e63cf544ce6f6265b22ef7c4e2478dd975078e`     | `581c886dcb2363e160c944e63cf544ce6f6265b22ef7c4e2478dd975078e` |
| `oracle_asset`   | `43334153` (ASCII "C3AS")                                      | `4443334153`                                                   |

To reproduce the applied blueprint from a clean checkout:

```sh
aiken build
aiken blueprint apply -m escrow -v escrow \
  581c886dcb2363e160c944e63cf544ce6f6265b22ef7c4e2478dd975078e
aiken blueprint apply -m escrow -v escrow \
  4443334153
```

## Tests

Run under `aiken check`. Current coverage (11 tests, all passing):

| Test                                            | Module  | Expectation |
|-------------------------------------------------|---------|-------------|
| `read_extracts_three_fields`                    | oracle  | decoder returns price / timestamp / expiry |
| `read_matches_cha10_canonical_datum`            | oracle  | decodes live CHA-10 CBOR (price=258452, ts=1776386294152, expiry=1776386725192) |
| `read_matches_cha18_live_median`                | oracle  | round-trips CHA-18 live median (price=254050) |
| `release_above_trigger_ok`                      | escrow  | pass when oracle price above trigger, fresh, signed |
| `release_blocked_below_trigger`                 | escrow  | fail when oracle price below trigger |
| `reclaim_after_expiry_ok`                       | escrow  | pass when tx.lower >= expiry and sender signed |
| `reclaim_before_expiry_blocked`                 | escrow  | fail when reclaiming before expiry |
| `release_without_beneficiary_signature_blocked` | escrow  | fail when beneficiary signature missing |
| `release_with_stale_feed_blocked`               | escrow  | fail when feed age exceeds `max_staleness_ms` |
| `release_with_wrong_oracle_policy_blocked`      | escrow  | fail when reference input carries a counterfeit policy |
| `release_happy_path_preprod_live_price`         | escrow  | pass against the live Preprod NFT + CHA-10 canonical price |

## Handoff to off-chain

- Blueprint: `contracts/plutus.json` (Preprod-applied; committed).
- Validator title: `escrow.escrow.spend`.
- Current compiled script hash: `fdf53d4444f328cf9829fd84b758fca14f7ef06ec8547b9dbd19a4d8`.
- Current Preprod testnet address: `addr_test1wr7l202ygnej3nuc987cfd6cljs57lhsdmy9g7uah5v6fkq52xzwg`.

Off-chain consumers should parse the blueprint with PyCardano's `PlutusV3Script` / `ScriptHash` helpers and build the `EscrowDatum` / `EscrowRedeemer` PlutusData classes mirroring the schema above. The `oracle_policy_id` / `oracle_asset_name` fields have been removed from `EscrowDatum` now that they live in the compile-time parameters.

## License

MIT. Do not copy code from the AGPL `charli3-pull-oracle-sdk`; the datum shape reproduced in `lib/oracle.ak` is the public `docs.charli3.io` standard only.
