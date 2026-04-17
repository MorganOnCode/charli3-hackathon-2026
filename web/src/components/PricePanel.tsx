/*
 * Charli3 Hackathon settlement demo. MIT License.
 */
import { usePrice } from '../hooks/usePrice'

export function PricePanel() {
  const { tick, error, loading } = usePrice(5000)
  const fetchedLabel = tick ? new Date(tick.fetchedAt).toLocaleTimeString() : '—'

  return (
    <section className="bg-panel border border-edge rounded-xl p-5 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-widest text-muted">Live Price</h2>
        <span className="text-xs font-mono px-2 py-1 rounded bg-warn/10 text-warn">stub feed</span>
      </header>

      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-muted">{tick?.pair ?? 'ADA/USD'}</span>
        <span className="text-5xl font-mono text-accent tabular-nums">
          {tick ? tick.price.toFixed(4) : loading ? '…' : '—'}
        </span>
      </div>

      <dl className="text-xs font-mono text-muted grid grid-cols-2 gap-y-1">
        <dt>source</dt>
        <dd className="text-right text-slate-200">{tick?.source ?? '—'}</dd>
        <dt>fetched</dt>
        <dd className="text-right text-slate-200">{fetchedLabel}</dd>
      </dl>

      {error && <p className="text-bad text-xs font-mono">{error}</p>}
      <p className="text-xs text-muted">
        By Saturday EOD this panel reads the live ODV oracle through the off-chain service.
      </p>
    </section>
  )
}
