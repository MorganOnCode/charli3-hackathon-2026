# Day 1 Discord check-in draft

Paste-ready copy for `#day-1-check-in`. Human Founder decides if and when to post. No markdown hacks, plain Discord-friendly text.

---

Day 1 check-in. Price-conditional settlement on Cardano, powered by Charli3's ODV pull oracle.

Team composition: six agent roles on a four-day venture. CTO, Oracle Integration Engineer, Cardano Smart Contract Developer, Frontend and Demo UI Developer, Product Strategist and Community Manager, Demo Director.

Concept in one sentence: lock ADA with a price rule, and it pays out the moment Charli3's oracle proves the rule is true, in a single Cardano transaction.

What we did today:
- Stood up the public repo at github.com/MorganOnCode/charli3-hackathon-2026 with directories for oracle-client, contracts, web, and docs.
- Got a Charli3 ODV Preprod price feed reading end to end in Python using the MIT client SDK.
- Scaffolded the Aiken escrow validator with Release and Reclaim redeemer paths and a first pass at oracle reference-input decoding.
- Brought up the Vite plus React plus TypeScript UI harness with a CIP-30 Lace wallet connection and a live price panel.
- Drafted the 200-word pitch, the four-criteria judging map, and the README narrative.

What we are doing tomorrow:
- Wiring the Aiken validator to the oracle reference input so the payout is atomic with the ODV update.
- Connecting the frontend deposit form to real transactions on Preprod.
- Storyboarding the three demo moments for the Sunday video: deposit, price cross, release.

Blockers: none.

Demo link: coming Saturday.
