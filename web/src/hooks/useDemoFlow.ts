/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * Day 1 flow orchestration. Wraps the single-settlement store + tx activity
 * feed, mocks the lock/ODV/release tx hashes, and refreshes the wallet
 * balance on each simulated confirmation. On Saturday, createSettlement and
 * release will be swapped for real CIP-30 tx builds via the Oracle Engineer
 * service; the interface stays the same so the UI does not change.
 */
import { useCallback, useState } from 'react'
import { mockTxHash } from '../lib/explorer'
import { buildEscrowDatumFromDraft } from '../lib/escrowDatum'
import type { Settlement, SettlementDraft, TxActivity } from '../state/settlement'

interface Deps {
  refreshWallet: () => Promise<void> | void
  /** Connected wallet's change address; used as the EscrowDatum.sender field. */
  senderAddress: string | null
}

export function useDemoFlow({ refreshWallet, senderAddress }: Deps) {
  const [settlement, setSettlement] = useState<Settlement | null>(null)
  const [activity, setActivity] = useState<TxActivity[]>([])
  const [datumError, setDatumError] = useState<string | null>(null)

  const pushTx = useCallback((kind: TxActivity['kind'], label: string, hash: string) => {
    const tx: TxActivity = {
      id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind,
      label,
      hash,
      createdAt: Date.now(),
    }
    setActivity((xs) => [tx, ...xs].slice(0, 5))
  }, [])

  const dismissToast = useCallback((id: string) => {
    setActivity((xs) => xs.filter((t) => t.id !== id))
  }, [])

  const createSettlement = useCallback(
    (draft: SettlementDraft) => {
      const now = Date.now()
      const lockTxHash = mockTxHash('lock')

      let datumCborHex: string | undefined
      let datumFields: Record<string, string> | undefined
      if (senderAddress) {
        try {
          const encoded = buildEscrowDatumFromDraft(draft, senderAddress)
          datumCborHex = encoded.cborHex
          datumFields = encoded.fields
          setDatumError(null)
        } catch (err) {
          setDatumError(err instanceof Error ? err.message : 'datum encoding failed')
        }
      } else {
        setDatumError('no wallet change address; datum not encoded')
      }

      const next: Settlement = {
        id: Math.random().toString(36).slice(2, 8),
        beneficiary: draft.beneficiary.trim(),
        amountAda: draft.amountAda,
        triggerPrice: draft.triggerPrice,
        direction: draft.direction,
        expiresAt: draft.expiresAt,
        status: 'armed',
        lockTxHash,
        datumCborHex,
        datumFields,
        createdAt: now,
        updatedAt: now,
      }
      setSettlement(next)
      pushTx('lock', 'Lock tx submitted', lockTxHash)
      void refreshWallet()
    },
    [pushTx, refreshWallet, senderAddress],
  )

  const requestOracle = useCallback(() => {
    setSettlement((cur) => {
      if (!cur || cur.status !== 'armed') return cur
      const odvTxHash = mockTxHash('odv')
      pushTx('odv', 'ODV oracle request', odvTxHash)
      return { ...cur, status: 'settling', odvTxHash, updatedAt: Date.now() }
    })
  }, [pushTx])

  const release = useCallback(() => {
    setSettlement((cur) => {
      if (!cur || cur.status !== 'settling') return cur
      const releaseTxHash = mockTxHash('release')
      pushTx('release', 'Release tx submitted', releaseTxHash)
      return { ...cur, status: 'settled', releaseTxHash, updatedAt: Date.now() }
    })
    void refreshWallet()
  }, [pushTx, refreshWallet])

  const reset = useCallback(() => {
    setSettlement(null)
  }, [])

  return {
    settlement,
    activity,
    datumError,
    createSettlement,
    requestOracle,
    release,
    reset,
    dismissToast,
  }
}
