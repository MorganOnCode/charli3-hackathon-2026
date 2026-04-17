/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * Minimal CIP-30 type surface and helpers. Spec: https://cips.cardano.org/cip/CIP-30
 */

export type WalletKey = 'lace' | 'eternl' | 'nami'

export interface Cip30Initial {
  apiVersion: string
  name: string
  icon: string
  enable: () => Promise<Cip30Api>
  isEnabled: () => Promise<boolean>
}

export interface Cip30Api {
  getNetworkId: () => Promise<number>
  getBalance: () => Promise<string>
  getUsedAddresses: () => Promise<string[]>
  getUnusedAddresses: () => Promise<string[]>
  getChangeAddress: () => Promise<string>
  getRewardAddresses: () => Promise<string[]>
  signTx: (tx: string, partialSign?: boolean) => Promise<string>
  signData: (addr: string, payload: string) => Promise<{ signature: string; key: string }>
  submitTx: (tx: string) => Promise<string>
}

export const KNOWN_WALLETS: { key: WalletKey; label: string }[] = [
  { key: 'lace', label: 'Lace' },
  { key: 'eternl', label: 'Eternl' },
  { key: 'nami', label: 'Nami' },
]

export const NETWORK_LABEL: Record<number, string> = {
  0: 'Preprod',
  1: 'Mainnet',
}

export function detectInstalledWallets(): WalletKey[] {
  const cardano = (typeof window !== 'undefined' ? (window as Window & { cardano?: Record<string, unknown> }).cardano : undefined)
  if (!cardano) return []
  return KNOWN_WALLETS.map((w) => w.key).filter((k) => Boolean(cardano[k]))
}

export function getInitial(key: WalletKey): Cip30Initial | undefined {
  const cardano = (typeof window !== 'undefined' ? (window as Window & { cardano?: Record<string, Cip30Initial> }).cardano : undefined)
  return cardano ? cardano[key] : undefined
}

/**
 * CIP-30 returns balance as a CBOR-hex Value. Pure-ADA wallets encode it as a
 * single uint (lovelace). Multi-asset balances encode it as a [coin, multiasset]
 * array. We only need the lovelace number here — fall back to 0 on parse miss.
 */
export function lovelaceFromBalanceCbor(hex: string): bigint {
  if (!hex) return 0n
  try {
    const bytes = hexToBytes(hex)
    return decodeLovelace(bytes)
  } catch {
    return 0n
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16)
  }
  return out
}

function decodeLovelace(bytes: Uint8Array): bigint {
  if (bytes.length === 0) return 0n
  const head = bytes[0]
  const major = head >> 5
  if (major === 0) return readUint(bytes, 0).value
  if (major === 4) {
    const arrLen = head & 0x1f
    if (arrLen >= 1) {
      const inner = bytes.slice(1)
      return readUint(inner, 0).value
    }
  }
  return 0n
}

function readUint(bytes: Uint8Array, offset: number): { value: bigint; next: number } {
  const head = bytes[offset]
  const info = head & 0x1f
  if (info < 24) return { value: BigInt(info), next: offset + 1 }
  if (info === 24) return { value: BigInt(bytes[offset + 1]), next: offset + 2 }
  if (info === 25) {
    const v = (BigInt(bytes[offset + 1]) << 8n) | BigInt(bytes[offset + 2])
    return { value: v, next: offset + 3 }
  }
  if (info === 26) {
    let v = 0n
    for (let i = 1; i <= 4; i += 1) v = (v << 8n) | BigInt(bytes[offset + i])
    return { value: v, next: offset + 5 }
  }
  if (info === 27) {
    let v = 0n
    for (let i = 1; i <= 8; i += 1) v = (v << 8n) | BigInt(bytes[offset + i])
    return { value: v, next: offset + 9 }
  }
  return { value: 0n, next: offset + 1 }
}

export function lovelaceToAda(lovelace: bigint): string {
  const whole = lovelace / 1_000_000n
  const frac = lovelace % 1_000_000n
  return `${whole}.${frac.toString().padStart(6, '0').slice(0, 2)}`
}
