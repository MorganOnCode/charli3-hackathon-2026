/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * Preprod bech32 validation. We do not unpack the payload here, we only
 * verify the prefix and charset. The on-chain validator will reject anything
 * malformed when the lock tx is built on Saturday.
 */

const BECH32_CHARSET = /^[02-9ac-hj-np-z]+$/

export function isPreprodAddress(value: string): boolean {
  const addr = value.trim()
  if (!addr.startsWith('addr_test1')) return false
  if (addr.length < 58) return false
  return BECH32_CHARSET.test(addr.slice('addr_test1'.length))
}

export function truncateAddress(addr: string | null | undefined, head = 12, tail = 10): string {
  if (!addr) return 'no data'
  if (addr.length <= head + tail + 1) return addr
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`
}

export function truncateHash(hash: string, head = 8, tail = 6): string {
  if (!hash) return 'no data'
  if (hash.length <= head + tail + 1) return hash
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`
}
