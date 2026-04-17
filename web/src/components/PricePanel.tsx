/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * Displays the Charli3 ODV price feed. The wire shape is the same on stub and
 * live (`request_fresh_price` JSON), so the surface here only flips a chip
 * from "stub feed" to "live ODV" when usePrice marks the tick live.
 *
 * Layout fits 1080p / 125% browser zoom. Storyboard frame F3 needs the
 * "Charli3 ODV" header, the headline price, and a freshness signal legible
 * in the first 30 seconds of the demo.
 */
import { useEffect, useState } from 'react'
import type { PriceTick } from '../hooks/usePrice'

interface Props {
  tick: PriceTick | null
  error: string | null
  loading: boolean
}

function shortHex(hex: string, head = 8, tail = 6): string {
  if (hex.length <= head + tail + 1) return hex
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`
}

function fmtClock(ms: number): string {
  return new Date(ms).toLocaleTimeString()
}

function fmtAgo(ms: number, now: number): string {
  const diff = Math.max(0, Math.floor((now - ms) / 1000))
  if (diff < 60) return `${diff}s ago`
  return `${Math.floor(diff / 60)}m ${diff % 60}s ago`
}

function fmtCountdown(targetMs: number, now: number): string {
  const diff = Math.floor((targetMs - now) / 1000)
  if (diff <= 0) return 'expired'
  if (diff < 60) return `${diff}s`
  return `${Math.floor(diff / 60)}m ${diff % 60}s`
}

export function PricePanel({ tick, error, loading }: Props) {
  // Tick the clock every second so the freshness countdown stays alive
  // even when the price hook is between polls.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const isLive = !!tick?.live
  const fresh = tick ? now <= tick.expiryMs : false
  const displayPrice = tick ? tick.price.toFixed(4) : loading ? '…' : 'no data'

  return (
    <section className="bg-panel border border-edge rounded-xl p-5 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-widest text-muted">Charli3 ODV</h2>
        <div className="flex items-center gap-2">
          {tick && (
            <span
              className={
                'text-xs font-mono px-2 py-1 rounded ' +
                (fresh ? 'bg-accent/10 text-accent' : 'bg-bad/10 text-bad')
              }
            >
              {fresh ? `fresh · ${fmtCountdown(tick.expiryMs, now)}` : 'stale'}
            </span>
          )}
          <span
            className={
              'text-xs font-mono px-2 py-1 rounded ' +
              (isLive ? 'bg-accent/10 text-accent' : 'bg-warn/10 text-warn')
            }
          >
            {isLive ? 'live ODV' : 'stub feed'}
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-muted">{tick?.pair ?? 'ADA/USD'}</span>
        <span className="text-6xl font-mono text-accent tabular-nums leading-none">{displayPrice}</span>
        <span className="text-xs text-muted font-mono">USD per ADA · scaled 1e6 on chain</span>
      </div>

      <dl className="text-xs font-mono text-muted grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt>source</dt>
        <dd className="text-right text-slate-200 break-all">{tick?.source ?? 'no data'}</dd>
        <dt>scaled price</dt>
        <dd className="text-right text-slate-200 tabular-nums">
          {tick ? tick.medianPrice.toLocaleString() : 'no data'}
        </dd>
        <dt>nodes signed</dt>
        <dd className="text-right text-slate-200">
          {tick ? `${tick.nodeFeedsCount}` : 'no data'}
        </dd>
        <dt>chain time</dt>
        <dd className="text-right text-slate-200">
          {tick ? `${fmtClock(tick.timestampMs)} (${fmtAgo(tick.timestampMs, now)})` : 'no data'}
        </dd>
        <dt>expires</dt>
        <dd className="text-right text-slate-200">
          {tick ? `${fmtClock(tick.expiryMs)}` : 'no data'}
        </dd>
        <dt>policy</dt>
        <dd className="text-right text-slate-200 font-mono">
          {tick ? shortHex(tick.policyId) : 'no data'}
        </dd>
      </dl>

      {error && <p className="text-bad text-xs font-mono">{error}</p>}
      {!isLive && (
        <p className="text-xs text-muted">
          Saturday EOD: this panel reads the live ODV oracle through the Oracle
          Engineer&apos;s HTTP service. Wire shape is identical to the snapshot.
        </p>
      )}
    </section>
  )
}
