/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * Polls the Charli3 ODV pull oracle. The data source is selected by the
 * `ORACLE_FEED_LIVE` flag in `lib/oracleService.ts`:
 *   - false (default): /stub/oracle-feed.json, a frozen snapshot of one real
 *     `request_fresh_price` run from `oracle-client/out/sample-run.json`.
 *   - true: /api/oracle/price, proxied via Vite to the Oracle Engineer's
 *     Python wrapper on 127.0.0.1:8001 (CHA-18).
 *
 * Wire shape is identical on disk and over HTTP, so flipping the flag is a
 * one-line change.
 *
 * The Charli3 SDK publishes the price as an integer scaled by 1e6
 * (`oracle-client/src/oracle_client/settlement.py` constant `1_000_000`).
 * The hook divides into a `usdPerAda` float for display, but keeps the
 * scaled `medianPrice` available for downstream code that needs to round-
 * trip into the EscrowDatum without losing precision.
 */
import { useEffect, useRef, useState } from 'react'
import {
  fetchOracleFeed,
  ORACLE_FEED_LIVE,
  ORACLE_FEED_STUB_URL,
  ORACLE_PRICE_URL,
  type RawOracleFeed,
} from '../lib/oracleService'

const PAIR = 'ADA/USD'
const PRICE_SCALE = 1_000_000

export interface PriceTick {
  pair: string
  /** USD per ADA, derived from medianPrice / 1e6. */
  price: number
  /** Source label: stub URL or live HTTP origin. */
  source: string
  /** ISO time the browser resolved this fetch. */
  fetchedAt: string
  /** True when source is the live Oracle Engineer HTTP endpoint. */
  live: boolean

  // Raw oracle fields, kept for the price panel and downstream tx builders.
  medianPrice: number
  timestampMs: number
  validityStartMs: number
  expiryMs: number
  nodeFeedsCount: number
  oracleAddress: string
  policyId: string
  network: string
  feedRequestLatencyMs: number
}

function adapt(raw: RawOracleFeed, source: string, live: boolean): PriceTick {
  return {
    pair: PAIR,
    price: raw.median_price / PRICE_SCALE,
    source,
    fetchedAt: new Date().toISOString(),
    live,
    medianPrice: raw.median_price,
    timestampMs: raw.chain_time_ms,
    validityStartMs: raw.validity_start_ms,
    expiryMs: raw.validity_end_ms,
    nodeFeedsCount: raw.node_feeds_count,
    oracleAddress: raw.oracle_address,
    policyId: raw.policy_id,
    network: raw.network,
    feedRequestLatencyMs: raw.feed_request_latency_ms,
  }
}

export function usePrice(intervalMs = 5000) {
  const [tick, setTick] = useState<PriceTick | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    const sourceLabel = ORACLE_FEED_LIVE ? ORACLE_PRICE_URL : ORACLE_FEED_STUB_URL
    const fetchOnce = async () => {
      try {
        const raw = await fetchOracleFeed(ORACLE_FEED_LIVE)
        if (!cancelled.current) {
          setTick(adapt(raw, sourceLabel, ORACLE_FEED_LIVE))
          setError(null)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled.current) {
          setError(e instanceof Error ? e.message : 'Price fetch failed')
          setLoading(false)
        }
      }
    }
    fetchOnce()
    const id = window.setInterval(fetchOnce, intervalMs)
    return () => {
      cancelled.current = true
      window.clearInterval(id)
    }
  }, [intervalMs])

  return { tick, error, loading }
}
