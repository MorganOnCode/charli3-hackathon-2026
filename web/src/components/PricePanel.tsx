/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * Displays the Charli3 ODV price feed. Day 1 the underlying source is a
 * local JSON stub, so the card shows a "stub feed" chip and the raw source
 * URL. The headline label always reads "Charli3 ODV" so the demo video's
 * frame F3 reads correctly whether we are live or stubbed.
 */
import type { PriceTick } from '../hooks/usePrice'

interface Props {
  tick: PriceTick | null
  error: string | null
  loading: boolean
}

export function PricePanel({ tick, error, loading }: Props) {
  const isStub = !tick || tick.source.startsWith('stub')
  const fetchedLabel = tick ? new Date(tick.fetchedAt).toLocaleTimeString() : 'no data'
  const displayPrice = tick ? tick.price.toFixed(3) : loading ? '…' : 'no data'

  return (
    <section className="bg-panel border border-edge rounded-xl p-5 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-widest text-muted">Charli3 ODV</h2>
        <span
          className={
            'text-xs font-mono px-2 py-1 rounded ' +
            (isStub ? 'bg-warn/10 text-warn' : 'bg-accent/10 text-accent')
          }
        >
          {isStub ? 'stub feed' : 'live ODV'}
        </span>
      </header>

      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-muted">{tick?.pair ?? 'ADA/USD'}</span>
        <span className="text-6xl font-mono text-accent tabular-nums leading-none">{displayPrice}</span>
        <span className="text-xs text-muted font-mono">USD per ADA · tenth-of-a-cent precision</span>
      </div>

      <dl className="text-xs font-mono text-muted grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt>source</dt>
        <dd className="text-right text-slate-200 break-all">{tick?.source ?? 'no data'}</dd>
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
