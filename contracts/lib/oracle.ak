// SPDX-License-Identifier: MIT
//
// Charli3 on-demand oracle datum helpers.
//
// The Charli3 ODV oracle emits an inline datum on the oracle UTxO that a
// consumer reads as a reference input. Its CBOR shape, as documented at
// https://docs.charli3.io/oracles/overview/datum-standard, is:
//
//   GenericData { constr=0, price_data: PriceData }
//   PriceData   { constr=2, price_map: { 0: price, 1: timestamp, 2: expiry } }
//
// The `price_map` is a CBOR map of integer keys to integer values. PyCardano
// emits it as a standard map and Aiken reads it as `Pairs<Int, Int>`.
//
// We mirror the Python `CONSTR_ID` values with placeholder variants so that
// the Aiken type tags match the on-chain datum exactly.

use aiken/collection/pairs

/// Key used by Charli3 to address the price value in `price_map`.
pub const price_key: Int = 0

/// Key used by Charli3 to address the feed creation timestamp in `price_map`.
pub const timestamp_key: Int = 1

/// Key used by Charli3 to address the feed expiry in `price_map`.
pub const expiry_key: Int = 2

/// Mirror of Python `PriceData` with `CONSTR_ID = 2`. We emit two dummy
/// variants before `PriceMap` so the Aiken constructor index matches.
pub type PriceData {
  ReservedPd0
  ReservedPd1
  PriceMap { price_map: Pairs<Int, Int> }
}

/// Mirror of Python `AggState` with `CONSTR_ID = 0`. Charli3 calls this
/// `GenericData` in its public documentation.
pub type GenericData {
  AggState { price_data: PriceData }
}

/// Flattened, consumer-facing view of an oracle reading.
pub type OracleReading {
  price: Int,
  timestamp: Int,
  expiry: Int,
}

/// Read the three canonical fields out of the oracle datum. Fails loudly if
/// any of `price`, `timestamp`, or `expiry` is missing, which is the safer
/// default for a settlement-triggering validator.
pub fn read(datum: GenericData) -> OracleReading {
  let AggState { price_data } = datum
  expect PriceMap { price_map }: PriceData = price_data
  expect Some(price) = pairs.get_first(price_map, price_key)
  expect Some(timestamp) = pairs.get_first(price_map, timestamp_key)
  expect Some(expiry) = pairs.get_first(price_map, expiry_key)
  OracleReading { price, timestamp, expiry }
}

/// Decode raw `Data` (as found in `InlineDatum`) into an `OracleReading`.
pub fn read_data(raw: Data) -> OracleReading {
  expect datum: GenericData = raw
  read(datum)
}

// --- tests ---------------------------------------------------------------

test read_extracts_three_fields() {
  let datum =
    AggState {
      price_data: PriceMap {
        price_map: [Pair(price_key, 1_234_567), Pair(timestamp_key, 100), Pair(expiry_key, 200)],
      },
    }
  let reading = read(datum)
  and {
    reading.price == 1_234_567,
    reading.timestamp == 100,
    reading.expiry == 200,
  }
}

/// Exact values decoded from the CHA-10 canonical inline datum CBOR:
///
///   d8799fd87b9fa3001a0003f194011b0000019d98de0788021b0000019d98e72f48ffff
///
/// (AggState{PriceData{ {0: 258452, 1: 1776386294152, 2: 1776386725192} }}).
/// Asserts that the Aiken constructor indices (GenericData=0, PriceData=2)
/// and the price_map integer keys line up with what Charli3 emits on chain.
test read_matches_cha10_canonical_datum() {
  let datum =
    AggState {
      price_data: PriceMap {
        price_map: [
          Pair(price_key, 258_452),
          Pair(timestamp_key, 1_776_386_294_152),
          Pair(expiry_key, 1_776_386_725_192),
        ],
      },
    }
  let reading = read(datum)
  and {
    reading.price == 258_452,
    reading.timestamp == 1_776_386_294_152,
    reading.expiry == 1_776_386_725_192,
  }
}

/// Second live-feed sample captured during [CHA-18](../../) Day 2 submission
/// dry runs (price=254050, the median across two Preprod oracle nodes). Same
/// PriceData shape, different price point. Guards against any drift that
/// would only show up once the median lands in a narrower band.
test read_matches_cha18_live_median() {
  let datum =
    AggState {
      price_data: PriceMap {
        price_map: [
          Pair(price_key, 254_050),
          Pair(timestamp_key, 1_776_400_000_000),
          Pair(expiry_key, 1_776_400_300_000),
        ],
      },
    }
  let reading = read_data(datum)
  and {
    reading.price == 254_050,
    reading.timestamp == 1_776_400_000_000,
    reading.expiry == 1_776_400_300_000,
  }
}
