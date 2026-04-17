/*
 * Charli3 Hackathon settlement demo. MIT License.
 */
import { KNOWN_WALLETS, NETWORK_LABEL } from '../lib/cip30'
import { lovelaceToAda } from '../lib/cip30'
import type { useWallet } from '../hooks/useWallet'

type WalletApi = ReturnType<typeof useWallet>

export function WalletPanel({ wallet }: { wallet: WalletApi }) {
  const networkLabel = wallet.networkId !== null ? NETWORK_LABEL[wallet.networkId] ?? `id ${wallet.networkId}` : '—'
  const networkOk = wallet.networkId === 0
  const ada = wallet.api ? `${lovelaceToAda(wallet.lovelace)} tADA` : '—'

  return (
    <section className="bg-panel border border-edge rounded-xl p-5 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-widest text-muted">Wallet</h2>
        <span
          className={
            'text-xs font-mono px-2 py-1 rounded ' +
            (networkOk ? 'bg-accent/10 text-accent' : 'bg-warn/10 text-warn')
          }
        >
          {networkLabel}
        </span>
      </header>

      {wallet.status !== 'connected' ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Connect a Cardano wallet to begin. Lace on Preprod is preferred for the demo.
          </p>
          <div className="flex gap-2 flex-wrap">
            {KNOWN_WALLETS.map((w) => {
              const installed = wallet.installed.includes(w.key)
              return (
                <button
                  key={w.key}
                  disabled={!installed || wallet.status === 'connecting'}
                  onClick={() => wallet.connect(w.key)}
                  className={
                    'px-3 py-2 rounded border text-sm font-medium transition ' +
                    (installed
                      ? 'border-accent/40 text-accent hover:bg-accent/10'
                      : 'border-edge text-muted cursor-not-allowed')
                  }
                  title={installed ? `Connect ${w.label}` : `${w.label} not detected in window.cardano`}
                >
                  {w.label}
                  {!installed && <span className="ml-2 text-xs">(missing)</span>}
                </button>
              )
            })}
          </div>
          {wallet.error && <p className="text-bad text-sm font-mono">{wallet.error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Row label="Provider" value={wallet.label ?? '—'} />
          <Row label="Balance" value={ada} mono />
          <Row label="Address" value={truncate(wallet.changeAddress)} mono small />
          <div className="flex gap-2">
            <button
              onClick={wallet.reload}
              className="text-xs px-2 py-1 rounded border border-edge text-muted hover:text-slate-200"
            >
              Refresh
            </button>
            <button
              onClick={wallet.disconnect}
              className="text-xs px-2 py-1 rounded border border-edge text-muted hover:text-bad"
            >
              Disconnect
            </button>
          </div>
          {!networkOk && (
            <p className="text-warn text-xs font-mono">
              Wallet is not on Preprod. Switch network in the wallet extension before depositing.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function Row({ label, value, mono, small }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-xs uppercase tracking-wider text-muted">{label}</span>
      <span
        className={
          (mono ? 'font-mono ' : '') +
          (small ? 'text-xs ' : 'text-sm ') +
          'text-slate-100 break-all text-right'
        }
      >
        {value}
      </span>
    </div>
  )
}

function truncate(addr: string | null): string {
  if (!addr) return '—'
  if (addr.length <= 24) return addr
  return `${addr.slice(0, 12)}…${addr.slice(-10)}`
}
