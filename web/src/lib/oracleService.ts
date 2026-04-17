/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * Typed wrappers for the Oracle Engineer's Python service (CHA-18). The
 * service is reached same-origin through the Vite proxy declared in
 * `vite.config.ts`; in production any reverse proxy that routes
 * `/api/oracle/*` to the wrapper works the same way.
 *
 * Wire shape is locked: the service returns the exact JSON that
 * `oracle-client/poll_price.py` already writes to `out/sample-run.json`.
 * Confirmed by the Oracle Engineer in CHA-12 comment a645f8d5 on
 * 2026-04-17. Snake_case is preserved on the wire and adapted to camelCase
 * inside `usePrice`.
 */
const BASE = '/api/oracle'

export const ORACLE_PRICE_URL = `${BASE}/price`
export const ORACLE_ODV_SUBMIT_URL = `${BASE}/odv/submit`
export const ORACLE_FEED_STUB_URL = '/stub/oracle-feed.json'

/** Wire shape returned by `GET /api/oracle/price` and the stub snapshot. */
export interface RawOracleFeed {
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

/** Wire shape returned by `POST /api/oracle/odv/submit`. */
export interface OdvSubmitResponse {
  /** Hash of the submitted ODV request transaction (the oracle pull). */
  odv_tx_hash: string
  /** "txHash#index" pointing at the freshly written oracle UTxO. The release
   *  tx must attach this as a reference input so the validator can read it. */
  oracle_utxo_ref: string
  /** Snapshot of the price embedded in that oracle UTxO. */
  price: RawOracleFeed
  /** Optional pre-built CBOR for the ODV tx, present only when the wrapper
   *  is configured to assemble (rather than just submit) the transaction. */
  built_tx: string | null
}

/**
 * Fetch the latest oracle tick. `liveOnly=true` forces the live endpoint;
 * the default falls back to the bundled snapshot when `live` is false so the
 * panel never blanks during demos.
 */
export async function fetchOracleFeed(live: boolean, signal?: AbortSignal): Promise<RawOracleFeed> {
  const url = live ? ORACLE_PRICE_URL : ORACLE_FEED_STUB_URL
  const sep = url.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${sep}_=${Date.now()}`, { cache: 'no-store', signal })
  if (!res.ok) throw new Error(`oracle feed HTTP ${res.status}`)
  return (await res.json()) as RawOracleFeed
}

/**
 * Trigger a fresh ODV pull. The wrapper signs and submits the request tx
 * server-side using the funded preprod wallet and returns the on-chain
 * coordinates of the new oracle UTxO.
 *
 * On failure (e.g. 502 while the wrapper wallet is unfunded) the wrapper
 * returns `{"error": "..."}`. We surface that message verbatim so the UI
 * can show the underlying chain reason rather than a generic HTTP code.
 */
export async function submitOdvRequest(signal?: AbortSignal): Promise<OdvSubmitResponse> {
  const res = await fetch(ORACLE_ODV_SUBMIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    signal,
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body?.error) detail = body.error
    } catch {
      // body not JSON; keep the HTTP status fallback.
    }
    throw new Error(detail)
  }
  return (await res.json()) as OdvSubmitResponse
}

/**
 * Single-source-of-truth flag. Wrapper from CHA-18 confirmed reachable on
 * 127.0.0.1:8001 (Oracle Engineer ack 2026-04-17 in CHA-12 comment
 * 69e9a37c). The price hook and demo flow both read from here so wire-up
 * is a one-line change.
 *
 * Note: `POST /odv/submit` returns 502 until the Preprod wallet at
 * `addr_test1qquj2z80zhxqzzt5elt5t3cyufg4s23vtxx8lsg8tg6yc9aghkxat8ym4gd7jd8y2dx7tmrj80a4mrttkjphzyfjmftq3lpt4u`
 * is funded (tracked in CHA-18). The price panel and read-only flow are
 * fully live regardless; the Settle button surfaces the error inline.
 */
export const ORACLE_FEED_LIVE = true
