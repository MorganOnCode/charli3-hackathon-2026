/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * Bottom-right stack of tx toasts. Each toast shows the truncated hash and
 * a Cardanoscan Preprod link without requiring hover (hover tooltips will
 * not read on a screen recording, per the storyboard brief).
 */
import { truncateHash } from '../lib/address'
import { txUrl } from '../lib/explorer'
import type { TxActivity } from '../state/settlement'

interface Props {
  items: TxActivity[]
  onDismiss: (id: string) => void
}

export function TxToasts({ items, onDismiss }: Props) {
  if (items.length === 0) return null
  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 w-[340px] max-w-[92vw]">
      {items.map((t) => (
        <article
          key={t.id}
          className="bg-panel border border-edge rounded-lg p-3 shadow-lg shadow-black/40 flex flex-col gap-1"
        >
          <header className="flex items-center justify-between">
            <span className={`text-xs uppercase tracking-wider ${KIND_TONE[t.kind]}`}>{t.label}</span>
            <button
              onClick={() => onDismiss(t.id)}
              className="text-xs text-muted hover:text-slate-200"
              aria-label="Dismiss toast"
            >
              ✕
            </button>
          </header>
          <a
            href={txUrl(t.hash)}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-mono text-slate-100 hover:text-accent break-all"
            title={t.hash}
          >
            {truncateHash(t.hash)} ↗
          </a>
          <span className="text-xs text-muted font-mono">cardanoscan preprod · {relativeTime(t.createdAt)}</span>
        </article>
      ))}
    </div>
  )
}

const KIND_TONE: Record<TxActivity['kind'], string> = {
  lock: 'text-warn',
  odv: 'text-accent',
  release: 'text-accent',
}

function relativeTime(ts: number): string {
  const delta = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (delta < 5) return 'just now'
  if (delta < 60) return `${delta}s ago`
  const mins = Math.floor(delta / 60)
  return `${mins}m ago`
}
