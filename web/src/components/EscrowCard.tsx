/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * The escrow state machine: Draft -> Armed -> Settling -> Settled.
 * Each status has a distinct colour, label, and progress bar so a judge
 * recognises the transition on a 30-second glance at 1080p. Action buttons
 * drive the clickthrough that the demo video will be recorded from.
 */
import { useEffect, useState } from 'react'
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
  /** Last error from POST /api/oracle/odv/submit, surfaced under the action row. */
  odvError?: string | null
  /** True while an ODV submit is in flight. OracleEngineer reports 11-30s
   *  typical, 52s worst-case cold, on the live Preprod wrapper. The button
   *  renders a spinner + elapsed seconds so judges never wonder whether the
   *  app froze. */
  odvPending?: boolean
}

export function EscrowCard({ settlement, currentPrice, onArmOracle, onRelease, onReset, odvError, odvPending }: Props) {
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
        <Detail label="Counterparty" value={truncateAddress(settlement.beneficiary)} mono small />
        <Detail label="Condition" value={directionLabel(settlement.direction, settlement.triggerPrice)} />
        <Detail label="Expires" value={new Date(settlement.expiresAt).toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TxLine label="Lock tx" hash={settlement.lockTxHash} />
        <TxLine label="ODV request" hash={settlement.odvTxHash} />
        <TxLine label="Release tx" hash={settlement.releaseTxHash} emphasise={settlement.status === 'settled'} />
      </div>

      {settlement.datumCborHex && settlement.datumFields && (
        <DatumPreview cborHex={settlement.datumCborHex} fields={settlement.datumFields} />
      )}

      {odvError && settlement.status === 'armed' && (
        <OdvErrorBanner message={odvError} />
      )}

      <footer className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-edge">
        <ConditionReadout settlement={settlement} currentPrice={currentPrice} crossed={crossed} />
        <div className="flex flex-col items-end gap-1">
          {settlement.status === 'armed' && (
            <OdvSubmitButton
              pending={!!odvPending}
              crossed={crossed}
              onClick={onArmOracle}
            />
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

function OdvErrorBanner({ message }: { message: string }) {
  // The wrapper can return very long error strings (Ogmios evaluateTransaction
  // can bake a 400+ char JSON blob into one field). Show a short, readable
  // headline inline, surface the full text via hover title + expandable detail.
  const [expanded, setExpanded] = useState(false)
  const headline = deriveHeadline(message)
  return (
    <div className="text-xs font-mono text-bad bg-bad/10 border border-bad/40 rounded px-3 py-2 flex flex-col gap-1">
      <div className="flex items-start justify-between gap-3">
        <span title={message} className="break-words">
          ODV submit failed: {headline}
        </span>
        <button
          onClick={() => setExpanded((x) => !x)}
          className="shrink-0 text-[11px] text-bad/80 hover:text-bad underline decoration-dotted"
        >
          {expanded ? 'hide' : 'details'}
        </button>
      </div>
      {expanded && (
        <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] leading-snug text-bad/90">
{message}
        </pre>
      )}
    </div>
  )
}

function deriveHeadline(message: string): string {
  // Common wrapper shapes: "Failed to build ODV transaction: Failed to build
  // script transaction: Failed to build transaction: Ogmios responded with error: ..."
  // Pluck the first readable segment and cap length so the banner stays one line
  // on typical widths.
  const first = message.split(':').map((s) => s.trim()).find((s) => s.length > 0) ?? message
  const capped = first.length > 120 ? first.slice(0, 117) + '...' : first
  return capped
}

function OdvSubmitButton({
  pending,
  crossed,
  onClick,
}: {
  pending: boolean
  crossed: boolean
  onClick: () => void
}) {
  // Elapsed seconds since pending flipped true. Reset on release. Judges watch
  // a number tick up instead of wondering whether the app froze. OracleEngineer
  // reports 11-30s typical, 52s worst cold.
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!pending) {
      setElapsed(0)
      return
    }
    const started = Date.now()
    setElapsed(0)
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000))
    }, 500)
    return () => window.clearInterval(id)
  }, [pending])

  return (
    <>
      <button
        onClick={onClick}
        disabled={pending}
        className={
          'px-3 py-2 rounded text-sm font-medium border transition inline-flex items-center gap-2 ' +
          (pending
            ? 'border-edge text-muted cursor-wait'
            : crossed
            ? 'border-accent text-accent hover:bg-accent/10 animate-pulse'
            : 'border-edge text-muted hover:text-slate-200')
        }
        title="Send the ODV request to Charli3 to pull a fresh oracle tick"
      >
        {pending && <Spinner />}
        <span>
          {pending
            ? `Submitting ODV... ${elapsed}s`
            : 'Request ODV tick'}
        </span>
      </button>
      {pending && (
        <span className="text-[11px] font-mono text-muted">
          on-chain confirmation, typical 10 to 30 s
        </span>
      )}
    </>
  )
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
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

function DatumPreview({ cborHex, fields }: { cborHex: string; fields: Record<string, string> }) {
  const onCopy = () => {
    if (navigator.clipboard) void navigator.clipboard.writeText(cborHex)
  }
  return (
    <details className="bg-ink border border-edge rounded p-3 group" open>
      <summary className="flex items-center justify-between cursor-pointer text-xs uppercase tracking-wider text-muted">
        <span>EscrowDatum (Plutus Data CBOR)</span>
        <span className="text-[10px] font-mono text-muted">{cborHex.length / 2} bytes</span>
      </summary>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono">
        {Object.entries(fields).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <span className="text-muted">{k}</span>
            <span className="text-slate-200 break-all text-right">{v}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-start gap-2">
        <pre className="flex-1 bg-panel border border-edge rounded p-2 text-[11px] font-mono text-slate-200 break-all whitespace-pre-wrap">
{cborHex}
        </pre>
        <button
          onClick={onCopy}
          className="text-[11px] px-2 py-1 rounded border border-edge text-muted hover:text-accent hover:border-accent/40"
          title="Copy CBOR hex"
        >
          copy
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Encoded against the 6-field `escrow.escrow.spend` schema (cha-22-day2). Oracle identity is a
        compile-time parameter of the validator, not a datum field. Saturday this attaches to the lock
        UTxO via the CIP-30 tx builder.
      </p>
    </details>
  )
}
