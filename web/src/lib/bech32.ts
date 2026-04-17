/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * Pure-JS bech32 decoder, bech32 only (not bech32m). Sufficient for the
 * Cardano Shelley addresses we accept (`addr_test1...`). The address payload
 * is the 5-bit data the wallet emitted; we collapse it back to bytes and
 * leave parsing of the Cardano address header to the caller.
 */

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
const CHARSET_INDEX: Record<string, number> = {}
for (let i = 0; i < CHARSET.length; i += 1) CHARSET_INDEX[CHARSET[i]] = i

export interface Bech32Decoded {
  prefix: string
  bytes: Uint8Array
}

export function decodeBech32(input: string): Bech32Decoded {
  const lower = input.toLowerCase()
  if (lower !== input && input.toUpperCase() !== input) {
    throw new Error('mixed case bech32 string')
  }
  const sep = lower.lastIndexOf('1')
  if (sep < 1 || sep + 7 > lower.length) {
    throw new Error('invalid bech32 separator position')
  }
  const prefix = lower.slice(0, sep)
  const data = lower.slice(sep + 1)
  const values: number[] = []
  for (const ch of data) {
    const v = CHARSET_INDEX[ch]
    if (v === undefined) throw new Error(`invalid bech32 character: ${ch}`)
    values.push(v)
  }
  if (!verifyChecksum(prefix, values)) {
    throw new Error('bech32 checksum failed')
  }
  const payload = values.slice(0, -6)
  return { prefix, bytes: convertBits(payload, 5, 8, false) }
}

/**
 * Cardano Shelley address: 1 header byte + 28-byte payment part [+ 28-byte
 * stake part]. Return the 28-byte payment key hash regardless of header type.
 */
export function paymentKeyHashFromAddress(addr: string): Uint8Array {
  const { prefix, bytes } = decodeBech32(addr.trim())
  if (!prefix.startsWith('addr')) {
    throw new Error(`expected addr/addr_test prefix, got ${prefix}`)
  }
  if (bytes.length < 29) {
    throw new Error('address payload too short for a payment key hash')
  }
  return bytes.slice(1, 29)
}

function convertBits(values: number[], from: number, to: number, pad: boolean): Uint8Array {
  let acc = 0
  let bits = 0
  const out: number[] = []
  const maxv = (1 << to) - 1
  for (const v of values) {
    if (v < 0 || v >> from !== 0) throw new Error('invalid value in bech32 payload')
    acc = (acc << from) | v
    bits += from
    while (bits >= to) {
      bits -= to
      out.push((acc >> bits) & maxv)
    }
  }
  if (pad) {
    if (bits > 0) out.push((acc << (to - bits)) & maxv)
  } else if (bits >= from || ((acc << (to - bits)) & maxv) !== 0) {
    throw new Error('invalid padding in bech32 payload')
  }
  return new Uint8Array(out)
}

function verifyChecksum(prefix: string, data: number[]): boolean {
  return polymod(hrpExpand(prefix).concat(data)) === 1
}

function polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
  let chk = 1
  for (const v of values) {
    const top = chk >> 25
    chk = ((chk & 0x1ffffff) << 5) ^ v
    for (let i = 0; i < 5; i += 1) {
      if ((top >> i) & 1) chk ^= GEN[i]
    }
  }
  return chk
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = []
  for (let i = 0; i < hrp.length; i += 1) out.push(hrp.charCodeAt(i) >> 5)
  out.push(0)
  for (let i = 0; i < hrp.length; i += 1) out.push(hrp.charCodeAt(i) & 31)
  return out
}
