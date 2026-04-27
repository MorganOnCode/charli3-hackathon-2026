# SHOT LIST: Charli3 Hackathon Submission Video (v3 Dual-Track)

**Owner:** DemoDirector
**Version:** v3.0 (Friday 2026-04-17 evening Bangkok)
**Companion docs:** `docs/STORYBOARD.md`, `docs/LIVE_DEMO_SCRIPT.md`, `docs/BACKUP_VIDEO.md`

## Shot 1. Builder pain (F1, 0:00 to 0:15)

- **Scene:** editor only, 22pt font, dark theme, zoom 125 percent.
- **File on screen:** scratch Aiken validator with TODO comments for Charli3 CBOR decode, reference-input semantics, ODV plus release composition.
- **Visual treatment:** slow digital push in, no cursor movement.
- **Audio:** voiceover F1 from LIVE_DEMO_SCRIPT.

## Shot 2. README hero (F2, 0:15 to 0:30)

- **Scene:** GitHub-rendered README or local markdown preview.
- **Required visible text:**
  - title `charli3-settlement`
  - tagline `Atomic price-conditional settlement on Cardano, in one Charli3-powered import.`
  - install line `pip install charli3-settlement`
  - MIT badge
- **Audio:** voiceover F2.

## Shot 3. Import split (F3, 0:30 to 0:55)

- **Scene:** editor split left-right, syntax-highlighted, 22pt.
- **Left file:** Python quickstart under `packages/charli3-settlement/python/README.md` or `charli3_settlement_examples/conditionalpay_quickstart.py`.
- **Right file:** Aiken quickstart under `packages/charli3-settlement/aiken/README.md` or the extracted `oracle.ak` helper.
- **Must stay on screen:** the exact import block from STORYBOARD F3 for at least 8 seconds with no cursor movement.
- **Audio:** voiceover F3.
- **Frame lock:** do not trim below 8 seconds in the final export.

## Shot 4. Second dApp scaffold (F4, 0:55 to 1:15)

- **Scene:** split terminal plus editor.
- **Terminal command:**
  ```bash
  cd packages/charli3-settlement/python
  python -m charli3_settlement_examples.price_alert --threshold 250000 --direction above
  ```
- **Expected output:** `CROSSED price=... threshold=250000 direction=above timestamp_ms=...`
- **Editor file:** `charli3_settlement_examples/price_alert.py`, showing the package import and tiny callback.
- **Audio:** voiceover F4.

## Shot 5. Transition card (F5, 1:15 to 1:25)

- **Scene:** title card on black.
- **Text:** `ConditionalPay: the reference dApp for charli3-settlement`.
- **Audio:** voiceover F5.

## Shot 6. ConditionalPay commit (F6, 1:25 to 1:40)

- **Scene:** web app full screen at `localhost:5173`, Lace wallet visible on commit.
- **Fields pre-filled:** beneficiary `addr_test1...`, amount `50 tADA`, trigger `ADA/USD >= 0.27`, expiry `2026-04-20`.
- **Required visible UI:**
  - Preprod network pill
  - button and form labels readable at 1080p
  - commit toast with a real tx hash
- **Audio:** voiceover F6.

## Shot 7. Escrow datum on Cardanoscan (F7, 1:40 to 1:50)

- **Scene:** Cardanoscan Preprod on the escrow tx / UTxO.
- **Required visible proof:** decoded datum or overlay showing trigger price, direction, beneficiary, expiry.
- **Overlay:** arrow label `same fields the validator checks on-chain`.
- **Audio:** voiceover F7.

## Shot 8. Oracle proves the rule (F8, 1:50 to 2:05)

- **Scene:** split view, terminal log on the left, live price panel on the right.
- **Log sequence visible:**
  ```
  [charli3-settlement] current 0.2562, trigger 0.2700, not armed
  [charli3-settlement] rule satisfied. submitting ODV request tx.
  [charli3-settlement] ODV tx e488...1b confirmed. oracle feed utxo e488...1b#1.
  ```
- **Price panel:** shows a live value crossing the threshold.
- **Lower-third:** `Charli3 ODV feed UTxO selected by NFT`.
- **Audio:** voiceover F8.
- **Timing contract:** scripted push must land within 15 seconds of the "not armed" log line so the frame does not stall. See LIVE_DEMO_SCRIPT.md pre-flight note.
- **Reference-input discipline:** keep the visible proof centered on one oracle UTxO chosen by its feed NFT. Do not clutter the frame with unrelated reference inputs or reward-account byproducts.

## Shot 9. Release transaction (F9, 2:05 to 2:15)

- **Scene:** split view. Left: continuing agent log. Right: ConditionalPay card state machine.
- **Log sequence visible:**
  ```
  [charli3-settlement] attaching oracle utxo as reference input
  [charli3-settlement] spending escrow utxo
  [charli3-settlement] release tx 7b2e...88 submitted
  ```
- **UI state:** card flips `Armed` (red) to `Settling` (amber) to `Settled` (green) over 4 seconds.
- **Audio:** voiceover F9.

## Shot 10. Counterparty paid (F10, 2:15 to 2:25)

- **Scene sequence:**
  1. Cardanoscan Preprod on the release tx. Highlight two inputs (escrow UTxO, reference to ODV feed UTxO) and one output (50 tADA to counterparty).
  2. Cut to counterparty's Lace wallet window. Show balance `100 tADA` before. Refresh. Show `150 tADA` after. Green arrow overlay on the delta.
- **Overlays:**
  - Balance delta lower-third: `+50 tADA` at 2:22.
- **Audio:** voiceover F10.

## Shot 11. Dual-track split card (F11, 2:25 to 2:27)

- **Scene:** two-column card, black background.
  - Left column title: "Oracle Tooling". Under it: "`charli3-settlement` library. MIT. Fork and ship." Three small logos: ConditionalPay, PriceAlert, greyed placeholder "your app here".
  - Right column title: "Real World Settlements". Under it: "ConditionalPay. Agent-grade escrow on Preprod. DAO treasuries, subscriptions, milestone payouts, liquidation."
- **Motion:** both columns slide in from opposite sides over 1 second, then hold.
- **Audio:** voiceover F11.

## Shot 12. Close and call to fork (F12, 2:27 to 2:30)

- **Scene:** repo URL card.
- **Text:**
  - Title 80 pt: `github.com/MorganOnCode/charli3-hackathon-2026`.
  - Subtitle 36 pt: `pip install charli3-settlement`.
  - Badges: MIT, Built in four days, Charli3 logo small in the corner.
- **Motion:** static, slight pulse on the install line at 2:29.
- **Audio:** voiceover F12.

## Assets checklist

- [ ] `charli3-settlement` README rendered on GitHub, hero block legible at 1080p.
- [ ] `examples/quickstart/agent.py` and `examples/quickstart/validator.ak` exist in the repo with the exact contents shown in Shot 3.
- [ ] `packages/charli3-settlement/python/charli3_settlement_examples/price_alert.py` runs on the presenter laptop and prints a threshold result in under 5 seconds on a warm env.
- [ ] ConditionalPay UI deployed locally with wallet connected, escrow card state machine visible (FrontendDev [CHA-12](/CHA/issues/CHA-12)).
- [ ] Scripted ODV push validated with the pre-flight pattern (OracleEngineer [CHA-15 #61f3fc5a](/CHA/issues/CHA-15#comment-61f3fc5a-b7e1-4dd3-a03d-40d6e2657df2)).
- [ ] Counterparty wallet funded to 100 tADA baseline; beneficiary address confirmed.
- [ ] OBS scenes built for all 12 shots, hotkey-switchable.
- [ ] DaVinci Resolve project template with lower-third placeholders and balance-delta overlay prebuilt.
- [ ] Voiceover recorded, levelled to -16 LUFS.
- [ ] Captions SRT drafted and hand-corrected for Preprod, datum, UTXO, ODV.

## Capture order (not presentation order)

Shoot in this order to minimize setup switches and maximize keeping the library quickstart consistent across shots:

1. Shots 1 and 2 (editor TODOs, README hero) -- both static, editor-only.
2. Shot 3 (library import split pane) -- same editor scene, re-layout panes.
3. Shot 4 (second dApp scaffold) -- continues in the same editor + terminal layout.
4. Shots 6 to 10 (ConditionalPay run) -- full chain run, record continuously and cut to required moments.
5. Shots 5, 11, 12 (transition card, dual-track split, repo slide) -- title cards, last to capture.

Plan two full takes of Shots 6 to 10 because the Preprod chain action is the least repeatable block. The first take doubles as the backup video if the second take has a production issue.

## Frame lock

- Shot 3 is frame-locked. Do not cut Shot 3 under any circumstance.
- Shot 4 can lose the `poetry install` step if it runs over. Keep the editor flip and the running log.
- Shot 6 through Shot 10 sequence can lose Shot 10's Lace flip if Preprod is slow. Settlement tx on Cardanoscan is enough proof on its own.
- Shot 11 can collapse to a single column if the right-column text is unreadable at the final bitrate.
- Shot 12 cannot be cut.
