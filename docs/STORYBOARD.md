# STORYBOARD: Charli3 Hackathon Submission Video (v3 Dual-Track)

**Owner:** DemoDirector
**Version:** v3.0 (Friday 2026-04-17 evening Bangkok). Replaces v2.3 end to end after the Human Founder picked Option B on [CHA-23](/CHA/issues/CHA-23). Library `charli3-settlement` is the product. ConditionalPay is the reference dApp that proves it. Code-pane API below is now aligned to the extracted package surface under `packages/charli3-settlement/`. Positioning line and narrative source are aligned to ProductStrategist deliverables on [CHA-25](/CHA/issues/CHA-25).
**Target length:** 2 minutes 30 seconds
**Submission deadline:** Sunday 2026-04-19, 22:00 Bangkok (internal record-by 10:00 Bangkok, founder sleep protected)
**Distribution:** YouTube unlisted in the submission form, Loom mirror as fallback
**Locked positioning line:** `Atomic price-conditional settlement on Cardano, in one Charli3-powered import.`

## Dual-track thesis in one line

Every Cardano team building an agent that must pay on verifiable state writes the same three things: an Aiken validator that gates on a Charli3 reference input, a Python client that composes ODV plus spend in one transaction, and a wallet glue layer. We extracted those three pieces into `charli3-settlement` under MIT. ConditionalPay is the 300-line reference dApp that proves the library. Fork the library, ship your own settlement flow on Preprod in under an hour.

## The five required moments

1. **BUILDER PAIN.** Open on the user we are helping: a Cardano team blocked on oracle integration plumbing.
2. **LIBRARY IMPORT.** One import block, one ODV submit call, one consumer callback. Code on screen.
3. **SECOND DAPP SCAFFOLD.** A tiny second app (`PriceAlert`) built on the same library in under 60 seconds of footage, showing the library is reusable not one-off.
4. **CONDITIONALPAY AS PROOF.** The full reference dApp settles end to end on Preprod, using the same library the viewer just saw imported.
5. **DUAL-TRACK CLOSE.** Library is the Oracle Tooling submission. ConditionalPay is the Real World Settlements submission. Same repo, MIT.

Every moment must show a screen, a voiceover line, and a visible proof (code snippet, transaction hash on Cardanoscan Preprod, a balance change, or the oracle datum value).

## Frame-by-frame (12 frames, 2:30 total)

### F1. Hook: builder pain (0:00 to 0:15, 15s)

- **Screen:** Dark editor window with a half-written Aiken validator and a pile of TODOs: `// TODO: decode Charli3 PriceData CBOR`, `// TODO: reference input semantics`, `// TODO: ODV mint + release in one tx`. Cursor blinking.
- **Voiceover:** "You are a Cardano team. You want an on-chain agent that only pays when the oracle proves a condition. You open your editor and realise you are about to write the same three hundred lines every oracle-gated dApp on Cardano has written before you."
- **Visible proof:** the TODO list is the proof of the pain.
- **Production note:** open on the user and the pain, not the mechanism. Founder rule.

### F2. The promise (0:15 to 0:30, 15s)

- **Screen:** Cut to a clean README header. Title: `charli3-settlement`. Tagline under it: `Atomic price-conditional settlement on Cardano, in one Charli3-powered import.` Three-line install block visible.
- **Voiceover:** "We extracted those three hundred lines into one library. `charli3-settlement`. Import it, request a fresh price, or submit ODV and hand your own callback a ready-to-build oracle reference input."
- **Visible proof:** the README itself and the install command.

### F3. Fork in five minutes: the import moment (0:30 to 0:55, 25s)

- **Screen:** Editor split left-right.
  - Left pane, Python:
    ```python
    from charli3_settlement import (
        build_with_oracle_reference,
        submit_odv_tx,
    )

    submission = await submit_odv_tx("configs/ada-usd-preprod.yml")
    release_tx_hash = await build_with_oracle_reference(
        submission=submission,
        consumer_fn=spend_conditionalpay,
        config_path="configs/ada-usd-preprod.yml",
    )
    ```
  - Right pane, Aiken:
    ```gleam
    use charli3_settlement/oracle.{find_oracle_reading, reading_is_live}

    validator escrow(oracle_policy: PolicyId, oracle_asset: AssetName) {
      spend(datum: Option<EscrowDatum>, _redeemer, _own_ref, self) {
        expect Some(d) = datum
        expect Some(reading) = find_oracle_reading(self, oracle_policy, oracle_asset)
        reading_is_live(reading, self.validity_range, d.max_staleness_ms)
          && reading.price >= d.trigger_price
      }
    }
    ```
- **Voiceover:** "One Python import block. One Aiken import. Off chain you submit ODV and hand your dApp a ready-built oracle reference context. On chain you read the canonical oracle UTxO by NFT and gate release on freshness and price. No custom CBOR decode, no hand-rolled reference-input math."
- **Visible proof:** both code blocks on screen, real imports, the exact public API from the library.
- **Dependency note:** signatures above now match the extracted package README and examples under `packages/charli3-settlement/`. Keep the panes synchronized with those files before rolling tape.

### F4. Second app scaffolded live (0:55 to 1:15, 20s)

- **Screen:** Terminal on the left, editor on the right.
  - Terminal: `cd packages/charli3-settlement/python && python -m charli3_settlement_examples.price_alert --threshold 250000 --direction above` landing visibly. Cut to the editor showing `price_alert.py` with a tiny script that imports `request_fresh_price` and checks a threshold.
  - Run the script. Terminal prints: `CROSSED price=256199 threshold=250000 direction=above timestamp_ms=...`
- **Voiceover:** "Different app, same package. This one is a price alert instead of a settlement rail, but it is the same import path and the same oracle read. Another builder can fork this in minutes."
- **Visible proof:** the second app imports `charli3_settlement`, runs immediately, and prints a real threshold result. Library reusability shown on camera.

### F5. Transition to the reference dApp (1:15 to 1:25, 10s)

- **Screen:** Cut card. Title: "And here is what it looks like in production." Beneath the title: `ConditionalPay: the reference dApp for charli3-settlement`.
- **Voiceover:** "We also built the flagship dApp on top of the same library. ConditionalPay. Watch it settle."
- **Visible proof:** the transition card. No chain action yet.

### F6. ConditionalPay agent commit on chain (1:25 to 1:40, 15s)

- **Screen:** ConditionalPay web app at `localhost:5173` on Preprod. Wallet connected in Lace. Commit form filled: beneficiary `addr_test1...`, amount `50 tADA`, trigger `ADA/USD >= 0.27`, expiry `2026-04-20`. Click Commit. Lace popup signs. Toast: `Agent committed. Tx: 9f3a...c1`.
- **Voiceover:** "The operator commits funds into the rail. The library builds the escrow transaction. Fifty test ADA lands on an Aiken validator the library shipped. The rule is the datum."
- **Visible proof:** Preprod network pill, real `addr_test1` prefix, truncated tx hash in toast.

### F7. Escrow datum on Cardanoscan (1:40 to 1:50, 10s)

- **Screen:** Cardanoscan Preprod on the escrow tx. Datum expanded, decoded overlay: `trigger_price: 270000, direction: above, beneficiary: addr_test1...`. Label arrow: "Same trigger fields the validator checks on-chain."
- **Voiceover:** "Public, auditable, and shaped by the library's own types. The agent cannot pay anyone else and it cannot pay at the wrong price."
- **Visible proof:** Cardanoscan URL, decoded datum bytes.

### F8. Oracle proves the rule (1:50 to 2:05, 15s)

- **Screen:** Split: left is the agent's terminal log from the library, right is the live ODV ticker.
  - Log: `[charli3-settlement] current 0.2562, trigger 0.2700, not armed`.
  - Scripted ODV push lands. Ticker rises to `0.2710`.
  - Log flips: `[charli3-settlement] rule satisfied. submitting ODV request tx.`
  - Log: `[charli3-settlement] ODV tx e488...1b confirmed. oracle feed utxo e488...1b#1.`
- **Voiceover:** "The library polls the feed. At twenty seven cents the rule proves. The library submits the Charli3 ODV transaction. Both Preprod nodes sign. The price lands on chain."
- **Visible proof:** real ODV tx hash in the log, real price from the Preprod ODV feed, signature count `2 of 2`.

### F9. Release transaction (2:05 to 2:15, 10s)

- **Screen:** Agent log advances: `[charli3-settlement] attaching oracle utxo as reference input`, `[charli3-settlement] spending escrow`, `[charli3-settlement] release tx 7b2e...88 submitted`. ConditionalPay card flips from `Armed` to `Settling` to `Settled`.
- **Voiceover:** "The library attaches the oracle UTXO as a reference input and spends the escrow in the same block. One transaction carries the oracle proof and the payment."
- **Visible proof:** release tx hash in the log, UI state machine visibly advancing.

### F10. Beneficiary paid (2:15 to 2:25, 10s)

- **Screen:** Cardanoscan on the release tx. Two inputs (escrow UTXO plus reference to the ODV feed UTXO), one output of 50 tADA to the beneficiary. Cut to beneficiary's Lace wallet: `100 tADA` before, `150 tADA` after. Green overlay on the delta.
- **Voiceover:** "The escrow closes. The beneficiary wallet jumps by fifty test ADA. No human signed. The library settled only because the oracle proved it could."
- **Visible proof:** release tx on Cardanoscan, Lace balance before and after.

### F11. Dual-track impact (2:25 to 2:27, 2s cutaway)

- **Screen:** Two-column card.
  - Left column: "Oracle Tooling: `charli3-settlement` library. MIT. Fork and ship." with logos of the sample apps (ConditionalPay, PriceAlert, a greyed-out placeholder for "your app here").
  - Right column: "Real World Settlements: ConditionalPay. Agent-grade escrow on Preprod. One rail for DAO treasuries, subscriptions, milestone payouts, liquidation."
- **Voiceover:** "One library under the hood. One reference dApp as proof. Two hackathon tracks, one submission."
- **Visible proof:** the card is the proof of the dual-track positioning.

### F12. Close and call to fork (2:27 to 2:30, 3s)

- **Screen:** Repo URL large: `github.com/MorganOnCode/charli3-hackathon-2026`. Under it: `charli3-settlement` package install line. MIT badge. "Built in four days" tag. Charli3 logo corner.
- **Voiceover:** "MIT. Fork it. Ship your own agent on Preprod the same day. Thank you Charli3."
- **Visible proof:** the URL and the install line.

## Runtime math

- F1 to F2 setup and promise: 30 seconds
- F3 to F4 library and second dApp: 45 seconds
- F5 to F10 ConditionalPay reference dApp run: 1 minute 15 seconds (60s chain action, 15s transition)
- F11 to F12 dual-track close: 5 seconds
- Total: 2 minutes 35 seconds. Trim F4 by 5 seconds in post if we need to hit 2:30 exactly.

## Voiceover budget

Current v3 word count is roughly 310 across F1 to F12, well under the 370-word ceiling at 150 wpm. If recording runs long, cut F1 by one sentence, then F4 by one sentence. Do not cut F3: the import moment is the whole point of the reframe.

## Shot list (library reusability emphasis)

Delivered separately in `docs/SHOT_LIST.md`. Summary here for reviewer sanity:

1. Editor close-up on a half-written Aiken validator with Charli3 CBOR TODO comments (F1).
2. README hero block (F2).
3. Side-by-side code panes: Python on the left, Aiken on the right (F3). This is the frame that must land.
4. Scaffold montage: shell to editor to running process, under 20 seconds (F4).
5. Transition card (F5).
6. Web app to Cardanoscan to Lace, hot-keyed scene switches in OBS (F6 to F10).
7. Dual-track split card (F11).
8. Repo URL title (F12).

## Placeholders awaiting Saturday handoff

| Token | Frame | Source | Due |
|---|---|---|---|
| Library public API signatures | F3, F4 | CTO on [CHA-24](/CHA/issues/CHA-24) | Saturday 2026-04-18 14:00 Bangkok |
| Positioning line in F2 tagline | F2 | ProductStrategist on [CHA-25](/CHA/issues/CHA-25) | Saturday 2026-04-18 14:00 Bangkok |
| Second app choice for F4 (`PriceAlert` threshold or a tiny settlement fork) | F4 | DemoDirector decides in rehearsal | Saturday 2026-04-18 18:00 Bangkok |
| `addr_test1...` beneficiary | F6, F7, F10 | FrontendDev ([CHA-12](/CHA/issues/CHA-12)) | Saturday 2026-04-18 18:00 Bangkok |
| Deposit tx hash `9f3a...c1` | F6, F7 | SmartContractDev | Saturday 2026-04-18 18:00 Bangkok |
| ODV tx hash and datum price | F8 | OracleEngineer scripted push | Saturday 2026-04-18 18:00 Bangkok |
| Release tx hash `7b2e...88` | F9, F10 | SmartContractDev + OracleEngineer joint run | Saturday 2026-04-18 18:00 Bangkok |
| Counterparty balance 100 to 150 tADA | F10 | FrontendDev second Lace wallet | Saturday 2026-04-18 18:00 Bangkok |

Lock amount (50 tADA) and balance delta (100 to 150 tADA) stay confirmed against LIVE_DEMO_SCRIPT.md. If the numbers move in the stack, file a blocker on [CHA-26](/CHA/issues/CHA-26) so the script and storyboard update together.

## What the UI and library must show on camera

These states and outputs must be visible for the storyboard to work. Filed as comments on [CHA-12](/CHA/issues/CHA-12) (FrontendDev) and [CHA-24](/CHA/issues/CHA-24) (CTO).

1. **Library README (`charli3-settlement/README.md`):** install block, the exact API surface shown in F3, a "fork in five minutes" quickstart. Hero section must be readable at 1080p from 8 feet away.
2. **Library import on screen:** syntax-highlighted in the editor (VS Code, dark theme, font size 22). Both Python and Aiken panes.
3. **Second app scaffold:** an actual runnable example in `packages/charli3-settlement/python/charli3_settlement_examples/price_alert.py`. Must print a threshold result in under 5 seconds on a warm env.
4. **ConditionalPay UI state machine:** `Draft`, `Armed`, `Settling`, `Settled`, with release tx clickable to Cardanoscan. Unchanged from v2.
5. **Agent terminal:** log lines prefixed `[charli3-settlement]` (not `[agent]`) so the library brand is visible every time the log shows.

If any of these cannot ship by Saturday 2026-04-18 18:00 Bangkok, we fall back to a pre-rendered frame.

## Tooling

Unchanged from v2.3. OBS Studio for 1080p60 lossless capture, DaVinci Resolve 19 for cuts and lower thirds, Audacity pass on the voiceover, target loudness -16 LUFS for YouTube. Three OBS scenes: editor split, web app, Cardanoscan. Terminal lives as an always-on overlay window.

## Backup plan

If Preprod is slow on Sunday, we pre-record a clean end-to-end run Saturday 2026-04-18 at 20:00 Bangkok and use it as the video submission. The live demo on Sunday can reference the same screens, with a narration-over-pre-recorded fallback if live chain interactions stall past 20 seconds. Recording logistics, raw-file location, and hosted URL are tracked in [`docs/BACKUP_VIDEO.md`](./BACKUP_VIDEO.md).

## Live demo script

Separate file: `docs/LIVE_DEMO_SCRIPT.md`. Cross-reference from here. v3 live script matches this storyboard beat for beat.
