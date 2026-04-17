/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * Day 1: form validates and emits a draft. Saturday this swaps the onCreate
 * callback for the lock-tx builder that signs via the connected CIP-30 wallet.
 */
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { isPreprodAddress } from '../lib/address'
import { draftIsValid } from '../state/settlement'
import type { Direction, SettlementDraft } from '../state/settlement'

interface Props {
  disabled: boolean
  hasActiveSettlement: boolean
  onCreate: (draft: SettlementDraft) => void
}

function defaultExpiry(): string {
  const now = new Date()
  now.setHours(now.getHours() + 24)
  now.setSeconds(0, 0)
  return now.toISOString().slice(0, 16)
}

const blank = (): SettlementDraft => ({
  beneficiary: '',
  amountAda: '',
  triggerPrice: '',
  direction: 'above',
  expiresAt: defaultExpiry(),
})

export function DepositForm({ disabled, hasActiveSettlement, onCreate }: Props) {
  const [draft, setDraft] = useState<SettlementDraft>(blank)

  const addressError = useMemo(() => {
    if (!draft.beneficiary) return null
    return isPreprodAddress(draft.beneficiary) ? null : 'Must be a Preprod bech32 address (addr_test1...)'
  }, [draft.beneficiary])

  const valid = draftIsValid(draft)
  const canSubmit = !disabled && !hasActiveSettlement && valid

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    onCreate(draft)
    setDraft(blank())
  }

  const update = <K extends keyof SettlementDraft>(key: K, value: SettlementDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const buttonLabel = disabled
    ? 'Connect wallet to deposit'
    : hasActiveSettlement
    ? 'Settle the active escrow first'
    : valid
    ? 'Lock tADA into escrow'
    : 'Complete the form'

  return (
    <section className="bg-panel border border-edge rounded-xl p-5 flex flex-col gap-4 lg:col-span-2">
      <header className="flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-widest text-muted">Create Settlement</h2>
        <span className="text-xs font-mono px-2 py-1 rounded bg-accent/10 text-accent">Preprod</span>
      </header>

      <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={onSubmit}>
        <Field label="Beneficiary address" hint={addressError ?? 'Preprod bech32 (addr_test1...)'} error={Boolean(addressError)}>
          <input
            value={draft.beneficiary}
            onChange={(e) => update('beneficiary', e.target.value)}
            placeholder="addr_test1..."
            autoComplete="off"
            spellCheck={false}
            className={inputClass(Boolean(addressError))}
          />
        </Field>

        <Field label="Amount (tADA)">
          <input
            type="number"
            min="1"
            step="0.1"
            value={draft.amountAda}
            onChange={(e) => update('amountAda', e.target.value)}
            placeholder="100"
            className={inputClass(false)}
          />
        </Field>

        <Field label="Trigger price (USD per ADA)">
          <input
            type="number"
            min="0"
            step="0.001"
            value={draft.triggerPrice}
            onChange={(e) => update('triggerPrice', e.target.value)}
            placeholder="0.80"
            className={inputClass(false)}
          />
        </Field>

        <Field label="Direction">
          <div className="flex gap-2">
            {(['above', 'below'] as Direction[]).map((d) => (
              <label
                key={d}
                className={
                  'flex-1 text-center text-sm py-2 rounded border cursor-pointer ' +
                  (draft.direction === d
                    ? 'border-accent text-accent bg-accent/10'
                    : 'border-edge text-muted hover:text-slate-200')
                }
              >
                <input
                  type="radio"
                  name="direction"
                  value={d}
                  className="sr-only"
                  checked={draft.direction === d}
                  onChange={() => update('direction', d)}
                />
                {d === 'above' ? 'Release when price ≥ trigger' : 'Release when price ≤ trigger'}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Expiry (local time)">
          <input
            type="datetime-local"
            value={draft.expiresAt}
            onChange={(e) => update('expiresAt', e.target.value)}
            className={inputClass(false)}
          />
        </Field>

        <div className="flex items-end justify-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className={
              'px-4 py-2 rounded font-medium text-sm border transition ' +
              (canSubmit
                ? 'border-accent text-accent hover:bg-accent/10'
                : 'border-edge text-muted cursor-not-allowed')
            }
          >
            {buttonLabel}
          </button>
        </div>
      </form>

      <p className="text-xs text-muted">
        Day 1 stub: submit advances the escrow card to Armed with a mock lock tx. Saturday this signs a
        real Plutus lock tx and references the Charli3 ODV oracle UTXO as a read-only input.
      </p>
    </section>
  )
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-muted">{label}</span>
      {children}
      {hint && <span className={`text-xs ${error ? 'text-bad' : 'text-muted'}`}>{hint}</span>}
    </label>
  )
}

function inputClass(error: boolean): string {
  return (
    'bg-ink border rounded px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none transition ' +
    (error ? 'border-bad focus:border-bad' : 'border-edge focus:border-accent')
  )
}
