/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * Builds the EscrowDatum Plutus Data payload for the lock UTxO. The schema
 * is the one in `contracts/validators/escrow.ak` and `contracts/README.md`.
 * Validator title: `escrow.escrow.spend`.
 * Preprod script address (current build): addr_test1wpa7rvc3sse9x2shvx6defy3htm69j8v9q6469xn7yr5mrgzaqyn9
 *
 * The Charli3 ADA/USD ODV oracle on Preprod uses the hackathon-resources
 * canonical config at `oracle-client/configs/ada-usd-preprod.yml`. The
 * oracle authentication NFT asset_name is not yet documented by the Oracle
 * Engineer, so we surface it as an overridable constant that defaults to
 * the Aiken test placeholder. SmartContractDev or Oracle Engineer must
 * confirm before Saturday's real on-chain submit.
 */

import { paymentKeyHashFromAddress } from './bech32'
import { PD, encodePlutusData, hexToBytes, plutusDataHex } from './plutus'
import type { Direction, SettlementDraft } from '../state/settlement'

/**
 * CIP-30 wallets vary on what `getChangeAddress()` returns: Lace returns the
 * raw address bytes as a hex string (1-byte header + 28-byte payment key hash
 * [+ 28-byte stake key hash]), while some wrappers hand back the bech32
 * `addr_test1...` form. Accept both shapes here.
 */
export function paymentKeyHashFromAny(input: string): Uint8Array {
  const v = input.trim()
  if (v.startsWith('addr')) return paymentKeyHashFromAddress(v)
  if (/^[0-9a-fA-F]+$/.test(v) && v.length >= 58) {
    const bytes = hexToBytes(v)
    if (bytes.length < 29) throw new Error('hex address too short for payment key hash')
    return bytes.slice(1, 29)
  }
  throw new Error(`unrecognised address format: ${v.slice(0, 16)}…`)
}

export const ORACLE_PREPROD = {
  scriptAddress: 'addr_test1wpa7rvc3sse9x2shvx6defy3htm69j8v9q6469xn7yr5mrgzaqyn9',
  oracleAddress: 'addr_test1wq3pacs7jcrlwehpuy3ryj8kwvsqzjp9z6dpmx8txnr0vkq6vqeuu',
  oraclePolicyId: '886dcb2363e160c944e63cf544ce6f6265b22ef7c4e2478dd975078e',
  oracleAssetName: '43334153', // ASCII "C3AS" - confirmed by OracleEngineer NOTES.md against live Preprod oracle UTxO.
  priceScale: 1_000_000n,        // Charli3 oracles publish int prices scaled by 1e6.
  defaultStalenessMs: 300_000n,  // 5 minutes, matches odv_validity_length in the YAML config.
}

export interface EscrowDatumInputs {
  beneficiary: string             // bech32 addr_test1...
  sender: string                  // bech32 addr_test1... (connected wallet change addr)
  triggerPrice: string            // human-readable USD per ADA, e.g. "0.80"
  direction: Direction
  expiresAt: string               // ISO datetime-local, parsed via Date.parse
  oraclePolicyId?: string         // hex; defaults to ORACLE_PREPROD.oraclePolicyId
  oracleAssetName?: string        // hex; defaults to ORACLE_PREPROD.oracleAssetName
  maxStalenessMs?: bigint
  priceScale?: bigint
}

export interface EncodedDatum {
  /** Plutus Data CBOR hex, ready to attach as `Datum.from_cbor(hex)` off-chain. */
  cborHex: string
  /** Mirror of the fields exactly as they were encoded. Useful for human review. */
  fields: {
    beneficiaryKeyHash: string
    senderKeyHash: string
    triggerPriceScaled: string
    direction: 'Above' | 'Below'
    expiryPosixMs: string
    maxStalenessMs: string
    oraclePolicyId: string
    oracleAssetName: string
  }
  byteLength: number
}

export function buildEscrowDatum(input: EscrowDatumInputs): EncodedDatum {
  const beneficiary = paymentKeyHashFromAny(input.beneficiary)
  const sender = paymentKeyHashFromAny(input.sender)
  const triggerScaled = scaleHumanPrice(input.triggerPrice, input.priceScale ?? ORACLE_PREPROD.priceScale)
  const directionConstr = input.direction === 'above' ? 0 : 1
  const expiryMs = parseExpiryMs(input.expiresAt)
  const stalenessMs = input.maxStalenessMs ?? ORACLE_PREPROD.defaultStalenessMs
  const policyHex = input.oraclePolicyId ?? ORACLE_PREPROD.oraclePolicyId
  const assetHex = input.oracleAssetName ?? ORACLE_PREPROD.oracleAssetName

  const datum = PD.constr(0, [
    PD.bytes(beneficiary),
    PD.bytes(sender),
    PD.int(triggerScaled),
    PD.constr(directionConstr, []),
    PD.int(expiryMs),
    PD.int(stalenessMs),
    PD.bytes(hexToBytes(policyHex)),
    PD.bytes(hexToBytes(assetHex)),
  ])

  const bytes = encodePlutusData(datum)

  return {
    cborHex: plutusDataHex(datum),
    fields: {
      beneficiaryKeyHash: bytesToHexLocal(beneficiary),
      senderKeyHash: bytesToHexLocal(sender),
      triggerPriceScaled: triggerScaled.toString(),
      direction: input.direction === 'above' ? 'Above' : 'Below',
      expiryPosixMs: expiryMs.toString(),
      maxStalenessMs: stalenessMs.toString(),
      oraclePolicyId: policyHex,
      oracleAssetName: assetHex,
    },
    byteLength: bytes.length,
  }
}

export function buildEscrowDatumFromDraft(
  draft: SettlementDraft,
  senderAddress: string,
  overrides: Partial<EscrowDatumInputs> = {},
): EncodedDatum {
  return buildEscrowDatum({
    beneficiary: draft.beneficiary,
    sender: senderAddress,
    triggerPrice: draft.triggerPrice,
    direction: draft.direction,
    expiresAt: draft.expiresAt,
    ...overrides,
  })
}

function scaleHumanPrice(human: string, scale: bigint): bigint {
  const trimmed = human.trim()
  if (!trimmed) throw new Error('triggerPrice is empty')
  const [whole, fracRaw = ''] = trimmed.split('.')
  if (!/^\d+$/.test(whole) || (fracRaw && !/^\d+$/.test(fracRaw))) {
    throw new Error(`triggerPrice not a decimal: ${human}`)
  }
  const scaleDigits = scale.toString().length - 1
  const frac = (fracRaw + '0'.repeat(scaleDigits)).slice(0, scaleDigits)
  const wholePart = BigInt(whole) * scale
  const fracPart = frac ? BigInt(frac) : 0n
  return wholePart + fracPart
}

function parseExpiryMs(value: string): bigint {
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) throw new Error(`invalid expiry: ${value}`)
  return BigInt(ms)
}

function bytesToHexLocal(b: Uint8Array): string {
  let out = ''
  for (const v of b) out += v.toString(16).padStart(2, '0')
  return out
}
