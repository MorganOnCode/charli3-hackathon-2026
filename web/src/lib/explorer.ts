/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * Cardanoscan Preprod explorer links. Centralised so the toast, escrow card,
 * and activity feed all point at the same canonical URL.
 */

const BASE = 'https://preprod.cardanoscan.io'

export function txUrl(hash: string): string {
  return `${BASE}/transaction/${hash}`
}

export function addressUrl(addr: string): string {
  return `${BASE}/address/${addr}`
}

/** Mock tx hash for the Day 1 end-to-end clickthrough. 64 lowercase hex chars. */
export function mockTxHash(seed?: string): string {
  const source = `${seed ?? 'mock'}-${Date.now()}-${Math.random()}`
  let hash = ''
  for (let i = 0; i < 64; i += 1) {
    const r = Math.floor((Math.random() + source.charCodeAt(i % source.length) / 255) * 16) % 16
    hash += r.toString(16)
  }
  return hash
}
