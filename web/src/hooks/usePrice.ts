/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * Polls the Charli3 ODV pull oracle. Day 1 / Day 2 morning the underlying
 * source is `/stub/oracle-feed.json`, a frozen snapshot of one real
 * `request_fresh_price` run from `oracle-client/out/sample-run.json`. By
 * Saturday EOD this URL switches to the Oracle Engineer's HTTP service
 * (CHA-18). The wire shape on disk and over HTTP is intentionally identical
 * so the swap is a one-line change.
 *
 * The Charli3 SDK publishes the price as an integer scaled by 1e6
 * (`oracle-client/src/oracle_client/settlement.py` constant `1_000_000`).
 * The hook divides into a `usdPerAda` float for display, but keeps the
 * scaled `medianPrice` available for downstream code that needs to round-
 * trip into the EscrowDatum without losing precision.
 */
import { useEffect, useRef, useState } from 'react'

const FEED_URL = '/stub/oracle-feed.json'
// Flip to true once the Oracle Engineer's HTTP wrapper of `request_fresh_price`
// is reachable from the dev server. Until then we are reading the snapshot.
const FEED_IS_LIVE = false
const PAIR = 'ADA/USD'
const PRICE_SCALE = 1_000_000

/** Wire shape on disk and over HTTP. Snake_case to match the Python service. */
interface RawOracleFeed {
  median_price: number
  chain_time_ms: number
  validity_start_ms: number
  validity_end_ms: number
  node_feeds_count: number
  oracle_address: string
  policy_id: string
  network: string
  feed_request_latency_ms: number
}

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
    const sourceLabel = FEED_IS_LIVE ? FEED_URL : 'stub://sample-run-snapshot'
    const fetchOnce = async () => {
      try {
        const res = await fetch(`${FEED_URL}?_=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const raw = (await res.json()) as RawOracleFeed
        if (!cancelled.current) {
          setTick(adapt(raw, sourceLabel, FEED_IS_LIVE))
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
