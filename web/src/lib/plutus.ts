/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * Minimal Plutus Data builder and CBOR encoder. Mirrors the EscrowDatum
 * schema in `contracts/validators/escrow.ak` so the deposit form can show
 * the exact CBOR payload it would attach to the lock UTxO.
 *
 * Plutus Data shape (per the Aiken `EscrowDatum` at tag cha-22-day2):
 *   Constr 0 [
 *     ByteString beneficiary,         // 28-byte payment key hash
 *     ByteString sender,              // 28-byte payment key hash
 *     Int        trigger_price,       // oracle native scaling (1e6 for ADA/USD)
 *     Constr {0|1} direction,         // 0 = Above, 1 = Below
 *     Int        expiry_posix,        // POSIX milliseconds
 *     Int        max_staleness_ms,    // must be >= 300_000
 *   ]
 * The oracle policy / asset identity is baked into the validator as a
 * compile-time parameter, not carried on the datum.
 *
 * CBOR encoding for Plutus Data follows the Plutus spec:
 *   Constr n with fields: tag 121+n (n<7), 1280+n-7 (7<=n<128), or
 *     a major-6 tag 102 with [n, fields].
 *   We only need n in {0,1} here, so we always emit tag 121 / 122.
 */

export type PD =
  | { type: 'int'; value: bigint }
  | { type: 'bytes'; value: Uint8Array }
  | { type: 'constr'; tag: number; fields: PD[] }

export const PD = {
  int: (value: bigint | number): PD => ({ type: 'int', value: BigInt(value) }),
  bytes: (value: Uint8Array): PD => ({ type: 'bytes', value }),
  constr: (tag: number, fields: PD[]): PD => ({ type: 'constr', tag, fields }),
}

export function encodePlutusData(data: PD): Uint8Array {
  const buf = new Builder()
  writePD(buf, data)
  return buf.toBytes()
}

export function plutusDataHex(data: PD): string {
  return bytesToHex(encodePlutusData(data))
}

function writePD(buf: Builder, data: PD): void {
  if (data.type === 'int') {
    writeInt(buf, data.value)
    return
  }
  if (data.type === 'bytes') {
    writeBytes(buf, data.value)
    return
  }
  if (data.type === 'constr') {
    if (data.tag < 7) {
      writeTag(buf, 121 + data.tag)
    } else if (data.tag < 128) {
      writeTag(buf, 1280 + data.tag - 7)
    } else {
      writeTag(buf, 102)
      buf.pushByte(0x82) // array(2)
      writeInt(buf, BigInt(data.tag))
      writeArray(buf, data.fields)
      return
    }
    writeArray(buf, data.fields)
    return
  }
}

function writeArray(buf: Builder, fields: PD[]): void {
  if (fields.length === 0) {
    buf.pushByte(0x80)
    return
  }
  // Plutus uses indefinite-length arrays for non-empty constr fields.
  buf.pushByte(0x9f)
  for (const f of fields) writePD(buf, f)
  buf.pushByte(0xff)
}

function writeInt(buf: Builder, value: bigint): void {
  if (value >= 0n) {
    writeUint(buf, 0, value)
  } else {
    writeUint(buf, 1, -value - 1n)
  }
}

function writeUint(buf: Builder, major: number, value: bigint): void {
  const head = major << 5
  if (value < 24n) {
    buf.pushByte(head | Number(value))
    return
  }
  if (value < 256n) {
    buf.pushByte(head | 24)
    buf.pushByte(Number(value))
    return
  }
  if (value < 65536n) {
    buf.pushByte(head | 25)
    buf.pushBytes(toBytes(value, 2))
    return
  }
  if (value < 4294967296n) {
    buf.pushByte(head | 26)
    buf.pushBytes(toBytes(value, 4))
    return
  }
  if (value < 18446744073709551616n) {
    buf.pushByte(head | 27)
    buf.pushBytes(toBytes(value, 8))
    return
  }
  // Bignum tag 2 (positive) or 3 (negative). Plutus accepts these for >u64.
  buf.pushByte(0xc0 | (major === 0 ? 2 : 3))
  const bytes = bigintToBytes(value)
  writeBytes(buf, bytes)
}

function writeBytes(buf: Builder, value: Uint8Array): void {
  if (value.length <= 64) {
    writeUint(buf, 2, BigInt(value.length))
    buf.pushBytes(value)
    return
  }
  // Plutus chunked bytestring: indefinite-length byte string of <=64-byte chunks.
  buf.pushByte(0x5f)
  for (let i = 0; i < value.length; i += 64) {
    const chunk = value.slice(i, i + 64)
    writeUint(buf, 2, BigInt(chunk.length))
    buf.pushBytes(chunk)
  }
  buf.pushByte(0xff)
}

function writeTag(buf: Builder, tag: number): void {
  if (tag < 24) {
    buf.pushByte(0xc0 | tag)
    return
  }
  if (tag < 256) {
    buf.pushByte(0xd8)
    buf.pushByte(tag)
    return
  }
  if (tag < 65536) {
    buf.pushByte(0xd9)
    buf.pushBytes(toBytes(BigInt(tag), 2))
    return
  }
  buf.pushByte(0xda)
  buf.pushBytes(toBytes(BigInt(tag), 4))
}

function toBytes(value: bigint, len: number): Uint8Array {
  const out = new Uint8Array(len)
  let v = value
  for (let i = len - 1; i >= 0; i -= 1) {
    out[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return out
}

function bigintToBytes(value: bigint): Uint8Array {
  if (value === 0n) return new Uint8Array([0])
  const out: number[] = []
  let v = value
  while (v > 0n) {
    out.push(Number(v & 0xffn))
    v >>= 8n
  }
  return new Uint8Array(out.reverse())
}

class Builder {
  private chunks: number[] = []
  pushByte(b: number) { this.chunks.push(b & 0xff) }
  pushBytes(bs: Uint8Array) { for (const b of bs) this.chunks.push(b) }
  toBytes(): Uint8Array { return new Uint8Array(this.chunks) }
}

export function bytesToHex(b: Uint8Array): string {
  let out = ''
  for (const v of b) out += v.toString(16).padStart(2, '0')
  return out
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  if (clean.length % 2 !== 0) throw new Error('hex length must be even')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16)
  }
  return out
}
