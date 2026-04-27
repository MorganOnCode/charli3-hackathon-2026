# LIVE DEMO SCRIPT (v3 Dual-Track)

**Owner:** DemoDirector
**Version:** v3.0 (Friday 2026-04-17 evening Bangkok). Replaces v2.3 end to end after Human Founder picked Option B on [CHA-23](/CHA/issues/CHA-23). Library `charli3-settlement` is the product. ConditionalPay is the reference dApp that proves it. Library public API shown below is the proposed surface; CTO confirms on [CHA-24](/CHA/issues/CHA-24). Positioning and judging narrative are aligned to ProductStrategist deliverables on [CHA-25](/CHA/issues/CHA-25).
**Slot:** Sunday 2026-04-19, 23:00 Bangkok (12:00 EST)
**Hard runtime:** 4 minutes. Stop at 4:00 even mid-sentence.
**Q&A cushion:** 2 minutes of open Q&A assumed after the 4-minute wall.
**Presenter:** CEO delivers. DemoDirector drives the screen and the timer.

## Setup, before the slot starts

- Browser windows and scenes pre-arranged, hotkey-switchable in OBS:
  1. Editor split pane (VS Code, dark theme, 22pt) with `charli3-settlement/README.md`, Python quickstart, and Aiken quickstart side by side.
  2. Second editor pane with `packages/charli3-settlement/python/charli3_settlement_examples/price_alert.py` ready to run.
  3. ConditionalPay web app at `localhost:5173`, wallet connected to Preprod.
  4. Cardanoscan Preprod tab on the escrow address, refreshable.
  5. Agent terminal pane full-screen dark, 18pt font, showing the library log prefix `[charli3-settlement]`.
  6. Diagram slide reserved for fallback only (v3 opens in the editor, not on a diagram).
- Preprod wallet funded with 500 tADA. Counterparty wallet at 100 tADA baseline.
- Rehearsed oracle-feed warm-up: OracleEngineer has scripted an ODV push that crosses the trigger within 15 seconds of the rule being armed. Presenter starts the demo with the rule already close to the trigger so we do not wait on natural price movement.
- Countdown timer visible on the presenter laptop only. Stopwatch started the instant the share begins.
- Backup video cued to F6 (ConditionalPay deposit) in a background tab. If Preprod stalls past 20 seconds on any tx, cut to the backup and narrate live.

## Runtime plan

| Time | Section | Owner on screen |
|---|---|---|
| 0:00 to 0:20 | Builder pain | CEO, camera, no share yet |
| 0:20 to 0:50 | Library pitch and import moment | Screen share, editor split |
| 0:50 to 1:30 | Second dApp scaffold (library reusability) | Screen share, terminal + editor |
| 1:30 to 2:45 | ConditionalPay reference dApp on Preprod | Screen share, web app + Cardanoscan + Lace |
| 2:45 to 3:15 | Judging-criteria mapping (dual-track) | Four-card slide |
| 3:15 to 4:00 | Close and call to fork | Repo slide |
| 4:00 | STOP | Hard cutoff |

## Script

### 0:00 to 0:20, builder pain (CEO, camera only)

"Good morning judges. Here is where every Cardano team that wants an oracle-gated settlement agent gets stuck. You open your editor. You want a validator that reads Charli3's PriceData CBOR from a reference input. You want a Python agent that submits an ODV request and a release transaction in the same block. You want wallet glue. That is three hundred lines of plumbing every single team writes, and most teams get the reference-input semantics wrong on the first attempt. We fixed that. Let me show you."

**Timer check:** at 0:20, must be switching to screen share on the editor.

### 0:20 to 0:50, library pitch and import moment (screen share, editor split)

**0:20, README hero.** "We extracted the plumbing into a library. It is called `charli3-settlement`. MIT license. Today it ships on Preprod."

**0:30, the import.** Switch to the editor split pane. Point at the Python pane first.

"One import block. `from charli3_settlement import submit_odv_tx, build_with_oracle_reference`. You submit ODV once, then hand your dApp callback a ready-built oracle reference context. That is the whole off-chain surface."

Point at the Aiken pane.

"On chain, one import. `use charli3_settlement/oracle`. Read the oracle UTxO by NFT, check freshness, compare price, release. No custom CBOR parser. No hand-rolled reference-input semantics."

**Timer check:** leave this section by 0:50. If we hit 0:55, cut one sentence from the second-app beat.

### 0:50 to 1:30, second dApp scaffold (screen share, terminal + editor)

Switch the editor to `packages/charli3-settlement/python/charli3_settlement_examples/price_alert.py` and the terminal to the runnable example.

"Here is the proof this is not one demo wrapped in nicer words. Different app, same library. This is a price-alert bot instead of a settlement rail. It imports the same package, requests the same live price, and checks a different business rule."

Run the example:

```bash
python -m charli3_settlement_examples.price_alert --threshold 250000 --direction above
```

As the terminal prints the live threshold result, say:

"Another team can fork this and swap only the consumer logic. The Charli3 integration stays the same. That is why this qualifies as Oracle Tooling, not just one dApp."

Then show the tiny `consumer_fn` callback inside the example and say:

"Change this callback and you have a new product."

**Timer check:** leave by 1:30. If the example takes too long, cut the callback line and move immediately to ConditionalPay.

### 1:30 to 2:45, ConditionalPay reference dApp on Preprod (screen share, web app + Cardanoscan + Lace)

Move to the web app.

"Now the same library inside the reference dApp. This is ConditionalPay, our Real World Settlements submission. The operator commits funds into an Aiken escrow with one rule: pay only when Charli3 proves the condition."

Fill the form and sign in Lace. When the lock transaction confirms:

"The agent is armed. The rule lives on chain in the datum."

Jump to Cardanoscan on the escrow UTxO:

"Public and auditable. Trigger price. Direction. Beneficiary. Expiry. The validator will only release against those fields."

Switch to the agent terminal and live price panel.

"The library polls the live ADA/USD feed. When the rule proves, it submits ODV, then spends the escrow with that oracle UTxO as a reference input in the same block."

Run the scripted push. As the ODV transaction confirms:

"Here is the ODV transaction. And here is the library attaching the resulting oracle UTxO as a reference input."

As the release transaction confirms and the card flips to Settled:

"Now the release transaction. Same rail, same library, different consumer callback."

Show the beneficiary balance jump from 100 tADA to 150 tADA and close the section with:

"No human signed this payout. The library settled only because the oracle proved it could."

**Timer check:** leave by 2:45. If any tx stalls past 20 seconds, cut to the backup video and keep narrating without apology.

### 2:45 to 3:15, judging-criteria mapping (four-card slide)

"This is why the project plays in two categories. Technical Implementation: the Aiken validator gates on a live Charli3 reference input, and the Python agent composes ODV plus release in one flow. Innovation: we turned that plumbing into one importable library instead of another private integration. Impact: every Cardano builder who wants an agent to pay on verifiable state can fork this instead of re-deriving it. Business: ConditionalPay proves the first customer-facing use case on top of the same package."

If the clock is tight, cut the Impact sentence first.

### 3:15 to 4:00, close and call to fork (repo slide)

"`charli3-settlement` is MIT. ConditionalPay is the proof. Fork the library, swap the callback, and ship your own oracle-gated agent on Preprod the same day. Thank you Charli3."

Hold on the repo URL and install line until 4:00, then stop.

## Hard visual proof checklist

The demo is not valid unless all of these are visible on camera:

- A real import of `charli3_settlement` in code.
- A second runnable app using the same package.
- A real Preprod escrow commit tx hash.
- A real ODV tx hash.
- A real release tx hash.
- A beneficiary balance change.
- The library name and MIT license.

If any item is missing during the Sunday run, use the backup video.

## Cut rules if time slips

1. First cut: shorten the builder-pain intro by one sentence.
2. Second cut: remove "Change this callback and you have a new product."
3. Third cut: compress the judging-criteria block to two sentences.
4. Never cut the import frame, the ODV tx, or the beneficiary balance change.

## Dependencies to verify Saturday

- `packages/charli3-settlement/python/README.md` and examples finalized for the exact API shown above.
- `charli3_settlement_examples.price_alert` runs on the presenter laptop.
- ConditionalPay UI exposes the four state-machine labels cleanly.
- OracleEngineer scripted push lands within 15 seconds on a warm run.
- Backup video tab pre-positioned.

## Related files

- [`docs/STORYBOARD.md`](./STORYBOARD.md)
- [`docs/SHOT_LIST.md`](./SHOT_LIST.md)
- [`docs/BACKUP_VIDEO.md`](./BACKUP_VIDEO.md)
