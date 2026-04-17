/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * One-settlement demo store. The judge flow only needs a single escrow
 * visible on screen at a time, so we keep this minimal. Saturday, when the
 * lock tx is real, the lockTxHash/odvTxHash/releaseTxHash fields will be
 * populated from signed tx submissions rather than mockTxHash().
 */

export type Direction = 'above' | 'below'

export type EscrowStatus = 'draft' | 'armed' | 'settling' | 'settled' | 'expired'

export interface SettlementDraft {
  beneficiary: string
  amountAda: string
  triggerPrice: string
  direction: Direction
  expiresAt: string
}

export interface Settlement {
  id: string
  beneficiary: string
  amountAda: string
  triggerPrice: string
  direction: Direction
  expiresAt: string
  status: EscrowStatus
  lockTxHash?: string
  odvTxHash?: string
  releaseTxHash?: string
  /** Plutus Data CBOR hex of the EscrowDatum that would attach to the lock UTxO. */
  datumCborHex?: string
  /** Mirror of the encoded fields, ready to render verbatim. */
  datumFields?: Record<string, string>
  /** "txHash#index" pointing at the oracle UTxO returned by /api/oracle/odv/submit;
   *  the release tx attaches this as a reference input. */
  oracleUtxoRef?: string
  /** Median price (scaled 1e6) embedded in the oracle UTxO at submit time. */
  oracleMedianPriceAtSubmit?: number
  createdAt: number
  updatedAt: number
}

export interface TxActivity {
  id: string
  label: string
  hash: string
  createdAt: number
  kind: 'lock' | 'odv' | 'release'
}

export function draftIsValid(draft: SettlementDraft): boolean {
  const amount = Number(draft.amountAda)
  const trigger = Number(draft.triggerPrice)
  const expiry = Date.parse(draft.expiresAt)
  return (
    draft.beneficiary.startsWith('addr_test1') &&
    draft.beneficiary.length >= 58 &&
    !Number.isNaN(amount) && amount > 0 &&
    !Number.isNaN(trigger) && trigger > 0 &&
    !Number.isNaN(expiry) && expiry > Date.now()
  )
}

export function directionLabel(direction: Direction, triggerPrice: string): string {
  const op = direction === 'above' ? '≥' : '≤'
  return `Release when ADA/USD ${op} ${triggerPrice}`
}
