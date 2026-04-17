/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * Day 1: stub form only. Saturday wires this to the Aiken escrow validator
 * and signs the lock tx through the connected CIP-30 wallet.
 */
import { useState } from 'react'
import type { FormEvent } from 'react'

type Direction = 'above' | 'below'

interface DraftSettlement {
  beneficiary: string
  amountAda: string
  triggerPrice: string
  direction: Direction
  expiryHours: string
}

const blank: DraftSettlement = {
  beneficiary: '',
  amountAda: '',
  triggerPrice: '',
  direction: 'above',
  expiryHours: '24',
}

export function DepositForm({ disabled }: { disabled: boolean }) {
  const [draft, setDraft] = useState<DraftSettlement>(blank)
  const [preview, setPreview] = useState<DraftSettlement | null>(null)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setPreview(draft)
  }

  const update = <K extends keyof DraftSettlement>(key: K, value: DraftSettlement[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  return (
    <section className="bg-panel border border-edge rounded-xl p-5 flex flex-col gap-4 lg:col-span-2">
      <header className="flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-widest text-muted">Create Settlement</h2>
        <span className="text-xs font-mono px-2 py-1 rounded bg-warn/10 text-warn">UI stub</span>
      </header>

      <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={onSubmit}>
        <Field label="Beneficiary address" hint="Preprod bech32 (addr_test1...)">
          <input
            value={draft.beneficiary}
            onChange={(e) => update('beneficiary', e.target.value)}
            placeholder="addr_test1..."
            className={inputClass}
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
            className={inputClass}
          />
        </Field>

        <Field label="Trigger price (USD per ADA)">
          <input
            type="number"
            min="0"
            step="0.0001"
            value={draft.triggerPrice}
            onChange={(e) => update('triggerPrice', e.target.value)}
            placeholder="0.80"
            className={inputClass}
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

        <Field label="Expiry (hours from now)">
          <input
            type="number"
            min="1"
            max="240"
            value={draft.expiryHours}
            onChange={(e) => update('expiryHours', e.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="flex items-end justify-end">
          <button
            type="submit"
            disabled={disabled}
            className={
              'px-4 py-2 rounded font-medium text-sm border transition ' +
              (disabled
                ? 'border-edge text-muted cursor-not-allowed'
                : 'border-accent text-accent hover:bg-accent/10')
            }
            title={disabled ? 'Connect a wallet first' : 'Preview settlement (Day 1: no tx submitted)'}
          >
            Preview deposit
          </button>
        </div>
      </form>

      {preview && (
        <pre className="bg-ink border border-edge rounded p-3 text-xs font-mono text-slate-200 overflow-x-auto">
{JSON.stringify(preview, null, 2)}
        </pre>
      )}

      <p className="text-xs text-muted">
        Day 1 stub. Saturday this submits a Plutus lock tx to the Aiken escrow with the Charli3
        ODV oracle UTXO referenced as a read-only input.
      </p>
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  )
}

const inputClass =
  'bg-ink border border-edge rounded px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-accent transition'
