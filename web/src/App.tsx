/*
 * Charli3 Hackathon settlement demo. MIT License.
 */
import { WalletPanel } from './components/WalletPanel'
import { PricePanel } from './components/PricePanel'
import { DepositForm } from './components/DepositForm'
import { useWallet } from './hooks/useWallet'

function App() {
  const wallet = useWallet()
  const isConnected = wallet.status === 'connected'

  return (
    <div className="min-h-screen w-full">
      <header className="border-b border-edge px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-accent font-mono text-lg">◉</span>
          <div>
            <h1 className="text-base font-semibold text-slate-100">Conditional Settlement</h1>
            <p className="text-xs text-muted">Charli3 ODV oracle • Cardano Preprod • Hackathon 2026</p>
          </div>
        </div>
        <span className="text-xs font-mono text-muted">v0.1 / Day 1 harness</span>
      </header>

      <main className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WalletPanel wallet={wallet} />
        <PricePanel />
        <DepositForm disabled={!isConnected} />
      </main>

      <footer className="border-t border-edge px-6 py-3 text-xs text-muted flex justify-between">
        <span>MIT License</span>
        <span>Stub feed today, live ODV by Saturday EOD</span>
      </footer>
    </div>
  )
}

export default App
