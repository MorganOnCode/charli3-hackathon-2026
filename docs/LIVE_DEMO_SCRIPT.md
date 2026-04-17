# LIVE DEMO SCRIPT v2

**Owner:** DemoDirector
**Version:** v2.1 (Friday 2026-04-17 evening pass; price domain rebased to live Preprod ADA/USD ~0.253 per OracleEngineer NOTES.md, signature count corrected to 2 of 2; criteria one-liners locked per CEO review on [CHA-14](/CHA/issues/CHA-14))
**Slot:** Sunday 2026-04-19, 23:00 Bangkok (12:00 EST)
**Hard runtime:** 4 minutes. Stop at 4:00 even mid-sentence.
**Q&A cushion:** 2 minutes of open Q&A assumed after the 4-minute wall.
**Presenter:** CEO delivers, DemoDirector drives the screen and the timer.

## Setup, before the slot starts

- Browser windows pre-arranged, hotkey-switchable:
  1. Trigger web app at `localhost:5173`, wallet connected to Preprod.
  2. Cardanoscan Preprod tab on the escrow address, refreshable.
  3. Agent terminal pane full-screen dark, 18pt font.
  4. Diagram slide for the 30-second tech intro.
- Preprod wallet funded with 500 tADA. Beneficiary wallet at 100 tADA baseline.
- Rehearsed oracle-feed warm-up: OracleEngineer has scripted an ODV push that crosses the trigger within 15 seconds of the rule being armed. Presenter starts the demo with the rule already close to the trigger so we do not wait on natural price movement.
- Countdown timer visible on the presenter laptop only, not on the shared screen. Stopwatch started the instant the share begins.
- Backup video (the recorded submission) is cued to F4 in a background tab. If Preprod stalls past 20 seconds on any tx, cut to the backup and narrate live.

## Runtime plan

| Time | Section | Owner on screen |
|---|---|---|
| 0:00 to 0:30 | Hook and problem | CEO, camera, no share yet |
| 0:30 to 1:00 | Tech in one breath | CEO on diagram slide |
| 1:00 to 2:30 | Live walkthrough | Screen share, CEO narrates, DemoDirector drives |
| 2:30 to 3:15 | Judging-criteria mapping | CEO on a four-card slide |
| 3:15 to 4:00 | Close and call to fork | CEO on repo slide |
| 4:00 | STOP | Hard cutoff |

## Script

### 0:00 to 0:30, hook and problem (CEO, camera only)

"Good morning judges. Real world payments on Cardano have a waiting problem. A treasury pays an invoice at spot. A DAO rebalances at a threshold. A remittance corridor settles at a fair rate. Today, a human sits at a terminal and clicks at the right moment, or a centralized service clicks for them. We think Cardano with Charli3 makes that human unnecessary. The settlement itself should be conditional, verifiable, and atomic. Let me show you what we built in four days."

**Timer check:** at 0:30, must be past this block. If over, trim "A remittance corridor settles at a fair rate."

### 0:30 to 1:00, tech in one breath (diagram slide)

"The architecture is three pieces. An Aiken validator that holds funds in escrow with a trigger rule as datum. A Python agent that watches price and fires the Charli3 ODV pull oracle when the rule is satisfied. And a React front end with CIP-30 wallet support where a user arms the rule in fifteen seconds. The oracle is load bearing. Remove it and the validator has no trusted price. Let me show you."

**Timer check:** at 1:00, must be on screen share with the Trigger app visible.

### 1:00 to 2:30, live walkthrough (screen share)

**1:00, deposit form.** "Fifty test ADA, beneficiary address here, trigger ADA to USD at twenty seven cents, expiry tomorrow midnight. Sign in Lace." Click sign. Lace popup. Confirm.

**1:20, escrow confirmed.** "Tx lands on Preprod. The escrow is armed. Here is the datum on Cardanoscan. The rule is public." Switch to Cardanoscan tab for 5 seconds. Highlight datum.

**1:35, agent terminal.** "The agent is polling the ODV feed. Current price, zero point two five three, trigger zero point two seven. Watch the log." Pause for the scripted ODV push.

**1:45, oracle cross.** "Price just crossed. The agent submits the ODV request." Terminal advances. "Fresh price datum on chain, signed by both Charli3 Preprod nodes."

**2:00, release tx.** "Agent references the oracle UTXO as a read-only input and spends the escrow. Same block." Flip to Cardanoscan. "Two inputs, one output. Fifty tADA to the beneficiary."

**2:15, beneficiary wallet.** "Beneficiary balance, before one hundred, after one hundred fifty." Flip to second Lace window. Show jump.

**2:30, end walkthrough.** "No human signed that release. The oracle did."

**Timer discipline:** if at 2:00 we are not yet showing the release, CUT the beneficiary wallet flip and skip to judging criteria. The release tx on Cardanoscan is enough proof.

### 2:30 to 3:15, judging-criteria mapping (four-card slide, one line each)

The four one-liners below are locked per CEO review on [CHA-14](/CHA/issues/CHA-14). Total runtime at 150 wpm is approximately 42 seconds, inside the 45-second block. Do not paraphrase on stage.

**Technical.** "The Aiken validator at `contracts/validators/escrow.ak` decodes Charli3's PriceData CBOR from the reference input and gates every payout on it. Remove the oracle reference input and every release transaction fails on chain. The script enforces the dependency, not the client."

**Innovation.** "Price-conditional settlement, not price-conditional trading. Swaps exist in volume. Atomic settlement against verifiable state is the missing rail, and it is only possible because Charli3's oracle is pull based and on demand."

**Impact.** "One primitive, four markets. Remittance at spot, invoice settlement at today's FX, DAO treasury rebalancing, automated liquidation. Every one of those ships on top of our rail without writing oracle integration."

**Business.** "MIT license on the validator and the Python client. Any team can fork and ship a conditional payout on Preprod the same day. Revenue lands as basis points on settled notional or a subscription tier for high-frequency triggers."

**Timer check:** at 3:15, must be on close slide.

### 3:15 to 4:00, close and call to fork

"Four days. MIT license. One repo. `github.com/MorganOnCode/charli3-hackathon-2026`. Fork it, ship your own conditional settlement. Charli3 made this possible because the oracle is pull based and on demand, which means the rule can live on chain and the settlement can be atomic. Thank you."

Leave repo slide on screen. Do not take the slide off before the 4:00 cutoff.

## Rehearsal plan

- **Rehearsal 1:** Sunday 2026-04-19, 15:00 Bangkok. Full dry run. Time every block. Identify which tx is the slowest on Preprod and build patience for it into the narration. Target total time 3:50, leaving 10 seconds of slack.
- **Rehearsal 2:** Sunday 16:30 Bangkok. Second dry run. Tighten any block that ran over. Rehearse the backup-video cutover at the 20-second stall point.
- **Rehearsal 3:** Sunday 20:00 Bangkok. Final dry run. Full team watches. Only cosmetic fixes accepted after this run.

## Rehearsal kit

- Presenter laptop with the live stack.
- Second laptop running the backup video cued to F4.
- Countdown timer app (big clock) on presenter screen only.
- Stopwatch phone clipped to the presenter's line of sight.
- Shared doc with the four-card slide text, so if the presenter blanks the CEO can read from it.

## Failure modes and what we do

| Failure | Response |
|---|---|
| Preprod tx pending past 20 seconds | Cut to backup video at F4, narrate live |
| Lace wallet will not connect | Switch to pre-signed tx flow prepared by FrontendDev; show Cardanoscan only |
| Oracle feed down | OracleEngineer runs the scripted local ODV push; same datum, same node signatures, still valid on Preprod |
| Presenter forgets a line | CEO reads from the shared doc. No apologies on air. |
| Projector cable fails | Spare HDMI and USB-C adapter in the demo kit |

## Do-not-do list

- No em dashes in any slide copy.
- No "um, so" filler at the start of sections. Start each block with a verb or a number.
- No apologizing for anything during the run. If something breaks, narrate over it.
- No going over 4:00. Hard stop.
