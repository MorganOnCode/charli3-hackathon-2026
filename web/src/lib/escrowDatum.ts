/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * Builds the EscrowDatum Plutus Data payload for the lock UTxO. The schema
 * is the one in `contracts/validators/escrow.ak`.
 * Validator title: `escrow.escrow.spend`.
 *
 * As of `cha-22-day2` (SmartContractDev) the validator is parameterized at
 * compile time with the live Preprod Charli3 ADA/USD oracle identity
 * (policy + asset). Those two bytes are no longer part of `EscrowDatum`;
 * six fields remain in Constr 0 order:
 *
 *   0 beneficiary       VerificationKeyHash (28 bytes)
 *   1 sender            VerificationKeyHash (28 bytes)
 *   2 trigger_price     Int (oracle's native units, 1e6-scaled for ADA/USD)
 *   3 direction         Constr 0 = Above, Constr 1 = Below
 *   4 expiry_posix      Int (ms epoch)
 *   5 max_staleness_ms  Int (must be >= 300_000)
 *
 * Current Preprod script hash / address, matching `contracts/plutus.json` and
 * `contracts/README.md` at tag `cha-22-day2`:
 *
 *   script_hash: fdf53d4444f328cf9829fd84b758fca14f7ef06ec8547b9dbd19a4d8
 *   address:     addr_test1wr7l202ygnej3nuc987cfd6cljs57lhsdmy9g7uah5v6fkq52xzwg
 */

import { paymentKeyHashFromAddress } from './bech32'
import { PD, encodePlutusData, plutusDataHex } from './plutus'
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
    const bytes = hexToBytesLocal(v)
    if (bytes.length < 29) throw new Error('hex address too short for payment key hash')
    return bytes.slice(1, 29)
  }
  throw new Error(`unrecognised address format: ${v.slice(0, 16)}…`)
}

export const ORACLE_PREPROD = {
  /** Escrow validator address on Preprod, cha-22-day2 applied blueprint. */
  scriptAddress: 'addr_test1wr7l202ygnej3nuc987cfd6cljs57lhsdmy9g7uah5v6fkq52xzwg',
  /** Escrow validator script hash, mirrors contracts/plutus.json. */
  scriptHash: 'fdf53d4444f328cf9829fd84b758fca14f7ef06ec8547b9dbd19a4d8',
  /** Charli3 ADA/USD ODV oracle host address. Reference only; the policy and
   *  asset are baked into the escrow validator at compile time. */
  oracleAddress: 'addr_test1wq3pacs7jcrlwehpuy3ryj8kwvsqzjp9z6dpmx8txnr0vkq6vqeuu',
  /** Charli3 oracles publish int prices scaled by 1e6. */
  priceScale: 1_000_000n,
  /** Default max staleness offered by the UI. Charli3 writes 5-minute validity
   *  windows on Preprod, and SmartContractDev recommends 10 min so the release
   *  tx can still hug the validity window with room to spare. */
  defaultStalenessMs: 600_000n,
  /** Absolute floor imposed by the on-chain check (odv_validity_length). */
  minStalenessMs: 300_000n,
}

export interface EscrowDatumInputs {
  beneficiary: string             // bech32 addr_test1...
  sender: string                  // bech32 addr_test1... (connected wallet change addr)
  triggerPrice: string            // human-readable USD per ADA, e.g. "0.80"
  direction: Direction
  expiresAt: string               // ISO datetime-local, parsed via Date.parse
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
  if (stalenessMs < ORACLE_PREPROD.minStalenessMs) {
    throw new Error(
      `max_staleness_ms ${stalenessMs} is below the Charli3 Preprod floor ${ORACLE_PREPROD.minStalenessMs}; ` +
        `the spend validator will reject even a perfectly fresh feed.`,
    )
  }

  const datum = PD.constr(0, [
    PD.bytes(beneficiary),
    PD.bytes(sender),
    PD.int(triggerScaled),
    PD.constr(directionConstr, []),
    PD.int(expiryMs),
    PD.int(stalenessMs),
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

function hexToBytesLocal(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('odd-length hex')
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

function bytesToHexLocal(b: Uint8Array): string {
  let out = ''
  for (const v of b) out += v.toString(16).padStart(2, '0')
  return out
}
