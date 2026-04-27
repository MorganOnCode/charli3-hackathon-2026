/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * Smoke test for src/lib/escrowDatum.ts. Encodes a sample EscrowDatum and
 * prints the CBOR hex + decoded fields so a human can eyeball it against the
 * Aiken schema. Run: npx tsx scripts/datum-smoke.ts
 */
import { buildEscrowDatum, ORACLE_PREPROD } from '../src/lib/escrowDatum'

// Use the documented Preprod escrow script and oracle host addresses as
// stand-ins; both have valid bech32 checksums and the decoder slice logic
// returns the first 28 payload bytes regardless of address kind.
const out = buildEscrowDatum({
  beneficiary: ORACLE_PREPROD.scriptAddress,
  sender: ORACLE_PREPROD.oracleAddress,
  triggerPrice: '0.80',
  direction: 'above',
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
})

console.log('byteLength', out.byteLength)
console.log('cborHex   ', out.cborHex)
console.log('fields    ', out.fields)

if (!out.cborHex.startsWith('d879')) {
  throw new Error(`expected Constr 0 prefix d879, got ${out.cborHex.slice(0, 4)}`)
}
const expectedKeys = [
  'beneficiaryKeyHash',
  'senderKeyHash',
  'triggerPriceScaled',
  'direction',
  'expiryPosixMs',
  'maxStalenessMs',
]
const actualKeys = Object.keys(out.fields)
if (actualKeys.length !== expectedKeys.length || !expectedKeys.every((k) => actualKeys.includes(k))) {
  throw new Error(`field shape mismatch: expected ${expectedKeys.join(',')} got ${actualKeys.join(',')}`)
}
if (out.fields.direction !== 'Above') {
  throw new Error('direction encoding wrong')
}
if (out.fields.triggerPriceScaled !== '800000') {
  throw new Error(`triggerPriceScaled mismatch: ${out.fields.triggerPriceScaled}`)
}
if (BigInt(out.fields.maxStalenessMs) < ORACLE_PREPROD.minStalenessMs) {
  throw new Error(`maxStalenessMs below Preprod floor: ${out.fields.maxStalenessMs}`)
}

// Verify the staleness floor is enforced: staleness = 299_999 must throw.
try {
  buildEscrowDatum({
    beneficiary: ORACLE_PREPROD.scriptAddress,
    sender: ORACLE_PREPROD.oracleAddress,
    triggerPrice: '0.80',
    direction: 'above',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    maxStalenessMs: 299_999n,
  })
  throw new Error('expected buildEscrowDatum to reject stalenessMs below 300_000')
} catch (err) {
  if (!(err instanceof Error) || !/below the Charli3 Preprod floor/.test(err.message)) {
    throw err
  }
}

console.log('OK')
