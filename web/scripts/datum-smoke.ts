/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * Smoke test for src/lib/escrowDatum.ts. Encodes a sample EscrowDatum and
 * prints the CBOR hex + decoded fields so a human can eyeball it against the
 * Aiken schema. Run: npx tsx scripts/datum-smoke.ts
 */
import { buildEscrowDatum, ORACLE_PREPROD } from '../src/lib/escrowDatum'

// Use the documented Preprod escrow script and oracle addresses as stand-ins
// for the smoke test; both have valid bech32 checksums and the decoder slice
// logic returns the first 28 payload bytes regardless of address kind.
const out = buildEscrowDatum({
  beneficiary: 'addr_test1wpa7rvc3sse9x2shvx6defy3htm69j8v9q6469xn7yr5mrgzaqyn9',
  sender: 'addr_test1wq3pacs7jcrlwehpuy3ryj8kwvsqzjp9z6dpmx8txnr0vkq6vqeuu',
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
if (out.fields.oraclePolicyId !== ORACLE_PREPROD.oraclePolicyId) {
  throw new Error('oracle policy_id mismatch')
}
if (out.fields.direction !== 'Above') {
  throw new Error('direction encoding wrong')
}
console.log('OK')
