# Judging criteria map

One paragraph per criterion. Each claim anchors to something a judge can see in the demo or the repo. Artifact anchors filled in as the code lands; this is the v1 draft for Friday CEO review.

## 1. Technical Implementation

The Charli3 ODV pull oracle is load-bearing, not decorative. The Aiken escrow validator at `contracts/validators/escrow.ak` requires the Charli3 oracle UTXO to be attached as a reference input in the spending transaction. The validator decodes the `PriceData` CBOR (keys `0=price`, `1=timestamp`, `2=expiry`) and rejects the redeemer path unless the live oracle price satisfies the depositor's trigger and the oracle datum has not expired. Remove the oracle reference input and every `Release` transaction fails on-chain, so the script enforces the oracle dependency, not a client-side check. The off-chain Python agent in `oracle-client/settle.py` requests the ODV feed with the Charli3 client SDK (MIT), composes the combined ODV update and settlement into one transaction, and submits via Ogmios. A judge watches a single transaction hash that carries the oracle proof and the payout together.

## 2. Innovation and Creativity

We combine three Cardano primitives that rarely sit in one artifact: a pull oracle as a reference input, an off-chain agent that composes transactions on a user's behalf, and an on-chain validator that gates a payment on verifiable external state. The result is price-conditional settlement, not price-conditional trading. That distinction matters. Swaps already exist in volume; atomic settlement against verifiable state is the missing rail for remittance, payroll, invoicing, and treasury automation. The MIT-licensed client library and validator are written to be forked, not admired. Any team building a conditional payout can reuse our datum shape, redeemer paths, and reference-input pattern without rewriting the oracle integration.

## 3. Impact on Cardano

Price-conditional settlement is a primitive, not a single product. The same validator and agent support automated remittance that pays out at spot, invoice settlement at today's FX, DAO treasury rebalancing that only fires when a band is broken, and automated liquidation for under-collateralized positions. Each of those is a separate business, and each ships on top of our rail without touching our code. A Cardano builder who watches the four-minute demo should walk away seeing not one project but a class of products they can now build without writing oracle integration themselves. That is how the project lifts TVL and active contracts on Cardano beyond our own submission.

## 4. Business and Growth Potential

The MIT license is the growth lever. Our ODV client example shows any Cardano team how to drive the Charli3 pull-oracle flow end to end without re-deriving it, which widens Charli3's own surface as well as ours. The escrow validator is a reference implementation other teams can adapt for FX remittance, automated invoicing, or basket rebalancing. A productized version has a clean revenue model: a small basis-point fee on settled volume, or a subscription tier for high-frequency conditional execution. Real-world settlement is the single largest payment flow not yet on Cardano, and a live Preprod demo with a straight path to mainnet is the credible opening move for the category.
