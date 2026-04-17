// SPDX-License-Identifier: MIT
//
// Price-conditional settlement escrow.
//
// A depositor locks value at this validator with an inline `EscrowDatum` that
// pins a trigger rule (price, direction, expiry, oracle identity). The
// beneficiary can only spend the UTxO along the `Release` path when the
// transaction carries the canonical Charli3 oracle UTxO as a reference input
// and the oracle's reading satisfies the rule. The depositor can walk the
// funds back along the `Reclaim` path once the escrow has expired.
//
// The oracle NFT (policy + asset name) is pinned in the datum so that this
// validator cannot be tricked into reading a look-alike reference input.

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/interval.{Finite, Interval, IntervalBound}
use cardano/assets.{AssetName, PolicyId, quantity_of}
use cardano/transaction.{InlineDatum, Input, OutputReference, Transaction}
use oracle.{OracleReading, read_data}

/// Which side of the trigger price unlocks the escrow.
pub type Direction {
  Above
  Below
}

/// Settlement rule encoded on the escrow UTxO.
pub type EscrowDatum {
  /// PubKey hash allowed to claim via `Release` when the rule is satisfied.
  beneficiary: VerificationKeyHash,
  /// PubKey hash allowed to reclaim via `Reclaim` after `expiry_posix`.
  sender: VerificationKeyHash,
  /// Trigger price in the oracle's native units (for ADA/USD that is
  /// 1/10^decimals USD per ADA, matching Charli3's feed scaling).
  trigger_price: Int,
  /// Which side of `trigger_price` releases the funds.
  direction: Direction,
  /// POSIX time (milliseconds) after which `Reclaim` becomes available.
  expiry_posix: Int,
  /// Maximum age (milliseconds) of the oracle reading at the moment the
  /// transaction is considered valid.
  max_staleness_ms: Int,
  /// Policy id of the authentication NFT carried by the canonical oracle
  /// UTxO. Pinning this prevents a counterfeit reference input.
  oracle_policy_id: PolicyId,
  /// Asset name of the authentication NFT carried by the canonical oracle
  /// UTxO.
  oracle_asset_name: AssetName,
}

pub type EscrowRedeemer {
  Release
  Reclaim
}

validator escrow {
  spend(
    datum: Option<EscrowDatum>,
    redeemer: EscrowRedeemer,
    _own_ref: OutputReference,
    self: Transaction,
  ) {
    expect Some(d) = datum
    when redeemer is {
      Release -> check_release(d, self)
      Reclaim -> check_reclaim(d, self)
    }
  }
}

/// Pull the oracle reading out of the transaction's reference inputs, if any.
/// The canonical oracle UTxO is identified by the (policy, name) pair stored
/// in the escrow datum.
pub fn find_oracle_reading(
  tx: Transaction,
  policy: PolicyId,
  name: AssetName,
) -> Option<OracleReading> {
  let matches =
    list.filter(
      tx.reference_inputs,
      fn(input: Input) { quantity_of(input.output.value, policy, name) == 1 },
    )
  when matches is {
    [single] ->
      when single.output.datum is {
        InlineDatum(raw) -> Some(read_data(raw))
        _ -> None
      }
    _ -> None
  }
}

/// The transaction's validity interval must be tight enough that any slot in
/// it carries a live oracle reading, i.e. `[tx.lower, tx.upper]` is contained
/// in `[timestamp, min(expiry, timestamp + max_staleness_ms)]`.
pub fn reading_is_live(
  reading: OracleReading,
  range: Interval,
  max_staleness_ms: Int,
) -> Bool {
  let Interval { lower_bound, upper_bound } = range
  let IntervalBound { bound_type: lo, .. } = lower_bound
  let IntervalBound { bound_type: hi, .. } = upper_bound
  when (lo, hi) is {
    (Finite(lo_v), Finite(hi_v)) -> and {
        lo_v >= reading.timestamp,
        hi_v <= reading.expiry,
        hi_v <= reading.timestamp + max_staleness_ms,
        lo_v <= hi_v,
      }
    _ -> False
  }
}

pub fn matches_direction(reading_price: Int, trigger: Int, direction: Direction) -> Bool {
  when direction is {
    Above -> reading_price >= trigger
    Below -> reading_price <= trigger
  }
}

pub fn check_release(d: EscrowDatum, tx: Transaction) -> Bool {
  expect Some(reading) =
    find_oracle_reading(tx, d.oracle_policy_id, d.oracle_asset_name)
  and {
    reading_is_live(reading, tx.validity_range, d.max_staleness_ms),
    matches_direction(reading.price, d.trigger_price, d.direction),
    list.has(tx.extra_signatories, d.beneficiary),
  }
}

pub fn check_reclaim(d: EscrowDatum, tx: Transaction) -> Bool {
  let Interval { lower_bound, .. } = tx.validity_range
  let IntervalBound { bound_type: lo, .. } = lower_bound
  let after_expiry =
    when lo is {
      Finite(lo_v) -> lo_v >= d.expiry_posix
      _ -> False
    }
  and {
    after_expiry,
    list.has(tx.extra_signatories, d.sender),
  }
}

// --- tests ---------------------------------------------------------------

use aiken/interval as ivl
use cardano/address
use cardano/assets
use cardano/transaction as tx_mod
use oracle.{AggState, PriceMap}

const beneficiary_vkh: VerificationKeyHash =
  #"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

const sender_vkh: VerificationKeyHash =
  #"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

const mock_oracle_policy: PolicyId =
  #"c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0"

const mock_oracle_asset: AssetName = #"4f524143"

fn mock_oracle_input(price: Int, timestamp: Int, expiry: Int) -> Input {
  let datum =
    AggState {
      price_data: PriceMap {
        price_map: [Pair(0, price), Pair(1, timestamp), Pair(2, expiry)],
      },
    }
  let value =
    assets.from_asset(mock_oracle_policy, mock_oracle_asset, 1)
      |> assets.add(#"", #"", 2_000_000)
  Input {
    output_reference: OutputReference {
      transaction_id: #"0000000000000000000000000000000000000000000000000000000000000001",
      output_index: 0,
    },
    output: tx_mod.Output {
      address: address.from_script(
        #"dddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      ),
      value,
      datum: InlineDatum(datum),
      reference_script: None,
    },
  }
}

fn mock_datum(direction: Direction, trigger: Int, expiry: Int) -> EscrowDatum {
  EscrowDatum {
    beneficiary: beneficiary_vkh,
    sender: sender_vkh,
    trigger_price: trigger,
    direction,
    expiry_posix: expiry,
    max_staleness_ms: 60_000,
    oracle_policy_id: mock_oracle_policy,
    oracle_asset_name: mock_oracle_asset,
  }
}

test release_above_trigger_ok() {
  let datum = mock_datum(Above, 1_000_000, 10_000_000)
  let tx =
    Transaction {
      ..tx_mod.placeholder,
      reference_inputs: [mock_oracle_input(1_500_000, 1000, 5000)],
      validity_range: ivl.between(1100, 1200),
      extra_signatories: [beneficiary_vkh],
    }
  check_release(datum, tx)
}

test release_blocked_below_trigger() fail {
  let datum = mock_datum(Above, 1_000_000, 10_000_000)
  let tx =
    Transaction {
      ..tx_mod.placeholder,
      reference_inputs: [mock_oracle_input(800_000, 1000, 5000)],
      validity_range: ivl.between(1100, 1200),
      extra_signatories: [beneficiary_vkh],
    }
  check_release(datum, tx)
}

test reclaim_after_expiry_ok() {
  let datum = mock_datum(Above, 1_000_000, 5_000)
  let tx =
    Transaction {
      ..tx_mod.placeholder,
      validity_range: ivl.after(6_000),
      extra_signatories: [sender_vkh],
    }
  check_reclaim(datum, tx)
}

test reclaim_before_expiry_blocked() fail {
  let datum = mock_datum(Above, 1_000_000, 5_000)
  let tx =
    Transaction {
      ..tx_mod.placeholder,
      validity_range: ivl.after(1_000),
      extra_signatories: [sender_vkh],
    }
  check_reclaim(datum, tx)
}

test release_without_beneficiary_signature_blocked() fail {
  let datum = mock_datum(Above, 1_000_000, 10_000_000)
  let tx =
    Transaction {
      ..tx_mod.placeholder,
      reference_inputs: [mock_oracle_input(1_500_000, 1000, 5000)],
      validity_range: ivl.between(1100, 1200),
      extra_signatories: [sender_vkh],
    }
  check_release(datum, tx)
}

test release_with_stale_feed_blocked() fail {
  let datum = mock_datum(Above, 1_000_000, 10_000_000)
  let tx =
    Transaction {
      ..tx_mod.placeholder,
      reference_inputs: [mock_oracle_input(1_500_000, 1000, 5000)],
      validity_range: ivl.between(4500, 4999),
      extra_signatories: [beneficiary_vkh],
    }
  check_release(datum, tx)
}
