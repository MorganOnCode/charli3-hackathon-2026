**One sentence.** Lock ADA with a price rule; it pays out the moment Charli3's oracle proves the rule is true, in a single Cardano transaction.

Price-conditional settlement on Cardano, powered by Charli3's ODV pull oracle. A depositor locks ADA in an on-chain escrow with one rule: release to the beneficiary when ADA/USD crosses a trigger. An off-chain Python agent watches the oracle, builds the ODV transaction, and submits a settlement transaction in the same block. The Aiken validator only accepts the payout when Charli3's oracle UTXO, attached as a reference input, proves the trigger is true. Remove the oracle and the release never fires.

The demo is three moments: deposit, price cross, release. Judges see one transaction hash carrying the oracle proof and the payment together.

**Four judging axes.** Technical: the validator decodes Charli3's PriceData CBOR from the reference input and gates every payout on it. Innovation: an agent that settles, not just trades, is a primitive Cardano did not have yesterday. Impact: remittance, invoice-at-spot, liquidation, and DAO rebalancing all sit on this rail. Business: any team shipping a conditional payout can fork our MIT-licensed validator and client library and ship on Preprod the same day.
