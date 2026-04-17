/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * The escrow state machine: Draft -> Armed -> Settling -> Settled.
 * Each status has a distinct colour, label, and progress bar so a judge
 * recognises the transition on a 30-second glance at 1080p. Action buttons
 * drive the clickthrough that the demo video will be recorded from.
 */
import { truncateAddress, truncateHash } from '../lib/address'
import { txUrl } from '../lib/explorer'
import { directionLabel } from '../state/settlement'
import type { EscrowStatus, Settlement } from '../state/settlement'

interface Props {
  settlement: Settlement | null
  currentPrice: number | null
  onArmOracle: () => void
  onRelease: () => void
  onReset: () => void
}

export function EscrowCard({ settlement, currentPrice, onArmOracle, onRelease, onReset }: Props) {
  if (!settlement) {
    return (
      <section className="bg-panel border border-edge rounded-xl p-5 flex flex-col gap-3 lg:col-span-2">
        <header className="flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-widest text-muted">Escrow</h2>
          <StatusPill status="draft" />
        </header>
        <p className="text-sm text-muted">
          No active settlement. Fill the form above and lock tADA to arm the escrow.
        </p>
      </section>
    )
  }

  const crossed = hasCrossedThreshold(settlement, currentPrice)

  return (
    <section className="bg-panel border border-edge rounded-xl p-5 flex flex-col gap-4 lg:col-span-2">
      <header className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm uppercase tracking-widest text-muted">Escrow</h2>
          <span className="text-xs font-mono text-muted">id {settlement.id}</span>
        </div>
        <StatusPill status={settlement.status} />
      </header>

      <Progress status={settlement.status} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Detail label="Amount locked" value={`${settlement.amountAda} tADA`} mono />
        <Detail label="Beneficiary" value={truncateAddress(settlement.beneficiary)} mono small />
        <Detail label="Condition" value={directionLabel(settlement.direction, settlement.triggerPrice)} />
        <Detail label="Expires" value={new Date(settlement.expiresAt).toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TxLine label="Lock tx" hash={settlement.lockTxHash} />
        <TxLine label="ODV request" hash={settlement.odvTxHash} />
        <TxLine label="Release tx" hash={settlement.releaseTxHash} emphasise={settlement.status === 'settled'} />
      </div>

      <footer className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-edge">
        <ConditionReadout settlement={settlement} currentPrice={currentPrice} crossed={crossed} />
        <div className="flex gap-2">
          {settlement.status === 'armed' && (
            <button
              onClick={onArmOracle}
              className={
                'px-3 py-2 rounded text-sm font-medium border transition ' +
                (crossed
                  ? 'border-accent text-accent hover:bg-accent/10 animate-pulse'
                  : 'border-edge text-muted hover:text-slate-200')
              }
              title="Send the ODV request to Charli3 to pull a fresh oracle tick"
            >
              Request ODV tick
            </button>
          )}
          {settlement.status === 'settling' && (
            <button
              onClick={onRelease}
              className="px-3 py-2 rounded text-sm font-medium border border-accent text-accent hover:bg-accent/10 animate-pulse"
              title="Submit the release tx with the fresh oracle UTXO as a reference input"
            >
              Submit release tx
            </button>
          )}
          {settlement.status === 'settled' && (
            <button
              onClick={onReset}
              className="px-3 py-2 rounded text-sm font-medium border border-edge text-muted hover:text-slate-200"
            >
              Start another
            </button>
          )}
        </div>
      </footer>
    </section>
  )
}

function StatusPill({ status }: { status: EscrowStatus }) {
  const style = STATUS_STYLE[status]
  return (
    <span className={`text-xs font-mono px-2 py-1 rounded ${style.pill}`}>{style.label}</span>
  )
}

const STATUS_STYLE: Record<EscrowStatus, { label: string; pill: string; bar: string; step: number }> = {
  draft:    { label: 'Draft',    pill: 'bg-edge text-muted',       bar: 'bg-edge',   step: 0 },
  armed:    { label: 'Armed',    pill: 'bg-warn/15 text-warn',     bar: 'bg-warn',   step: 1 },
  settling: { label: 'Settling', pill: 'bg-accent/15 text-accent animate-pulse', bar: 'bg-accent', step: 2 },
  settled:  { label: 'Settled',  pill: 'bg-accent/25 text-accent', bar: 'bg-accent', step: 3 },
  expired:  { label: 'Expired',  pill: 'bg-bad/15 text-bad',       bar: 'bg-bad',    step: 0 },
}

function Progress({ status }: { status: EscrowStatus }) {
  const steps: { label: string; key: EscrowStatus }[] = [
    { label: 'Draft', key: 'draft' },
    { label: 'Armed', key: 'armed' },
    { label: 'Settling', key: 'settling' },
    { label: 'Settled', key: 'settled' },
  ]
  const currentStep = STATUS_STYLE[status].step
  return (
    <ol className="flex items-center gap-2 text-xs font-mono">
      {steps.map((s, idx) => {
        const reached = idx <= currentStep
        const active = idx === currentStep
        return (
          <li key={s.key} className="flex items-center gap-2 flex-1">
            <span
              className={
                'inline-flex items-center justify-center w-6 h-6 rounded-full border ' +
                (reached
                  ? active
                    ? 'border-accent text-accent bg-accent/10'
                    : 'border-accent/60 text-accent/80'
                  : 'border-edge text-muted')
              }
            >
              {idx + 1}
            </span>
            <span className={reached ? 'text-slate-100' : 'text-muted'}>{s.label}</span>
            {idx < steps.length - 1 && (
              <span className={`h-px flex-1 ${idx < currentStep ? 'bg-accent/60' : 'bg-edge'}`} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function Detail({ label, value, mono, small }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-xs uppercase tracking-wider text-muted">{label}</span>
      <span
        className={
          (mono ? 'font-mono ' : '') + (small ? 'text-xs ' : 'text-sm ') + 'text-slate-100 break-all text-right'
        }
      >
        {value}
      </span>
    </div>
  )
}

function TxLine({ label, hash, emphasise }: { label: string; hash?: string; emphasise?: boolean }) {
  const tone = emphasise ? 'text-accent' : 'text-slate-200'
  return (
    <div className="flex flex-col gap-1 bg-ink border border-edge rounded p-3">
      <span className="text-xs uppercase tracking-wider text-muted">{label}</span>
      {hash ? (
        <a
          href={txUrl(hash)}
          target="_blank"
          rel="noreferrer"
          className={`text-sm font-mono ${tone} hover:underline break-all`}
          title={hash}
        >
          {truncateHash(hash)} ↗
        </a>
      ) : (
        <span className="text-sm font-mono text-muted">pending</span>
      )}
    </div>
  )
}

function ConditionReadout({
  settlement,
  currentPrice,
  crossed,
}: {
  settlement: Settlement
  currentPrice: number | null
  crossed: boolean
}) {
  if (settlement.status === 'settled') {
    return <span className="text-sm text-accent">Released to beneficiary.</span>
  }
  if (currentPrice === null) {
    return <span className="text-xs text-muted">Waiting on price feed.</span>
  }
  const trigger = Number(settlement.triggerPrice)
  return (
    <span className="text-xs font-mono text-muted">
      oracle {currentPrice.toFixed(3)} vs trigger {trigger.toFixed(3)} (
      <span className={crossed ? 'text-accent' : 'text-muted'}>
        {crossed ? 'threshold crossed' : 'not yet crossed'}
      </span>
      )
    </span>
  )
}

function hasCrossedThreshold(settlement: Settlement, price: number | null): boolean {
  if (price === null) return false
  const trigger = Number(settlement.triggerPrice)
  if (Number.isNaN(trigger)) return false
  return settlement.direction === 'above' ? price >= trigger : price <= trigger
}
