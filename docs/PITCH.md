**One sentence.** ConditionalPay lets an autonomous agent escrow ADA against a price rule and pay a counterparty the instant Charli3's oracle proves the rule, in one Cardano transaction with no human in the loop.

Picture a DAO treasury rebalancer: a bot a DAO trusts to move funds when the market meets a pre-approved condition, but that the DAO will not trust with unconditional payout authority. A human cannot sit in the loop for every fire. ConditionalPay binds the agent's permission to verifiable external state. The agent does not get to decide *if*, only to execute *when*.

Under the hood, a depositor locks ADA in an on-chain Aiken escrow with one rule: release to the beneficiary when ADA/USD crosses a trigger. An off-chain Python agent watches Charli3's ODV pull oracle, builds the ODV transaction, and submits a settlement transaction in the same block. The Aiken validator accepts the payout only when Charli3's oracle UTXO, attached as a reference input, proves the trigger is true. Remove the oracle and the release never fires.

The demo is three moments: deposit, price cross, release. Judges see one transaction hash carrying the oracle proof and the payment together.

**Four judging axes.** Technical: the validator decodes Charli3's PriceData CBOR from the reference input and gates every payout on it. Innovation: an autonomous agent that settles, not just trades, is a primitive Cardano did not have yesterday. Impact: DAO treasury rebalancing, subscription auto-pay, milestone payout bots, and automated liquidation all sit on this rail. Business: any team shipping an agent that must pay on verifiable state can fork our MIT-licensed validator and ODV client example and be running on Preprod the same day.
