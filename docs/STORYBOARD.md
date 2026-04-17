# STORYBOARD: Charli3 Hackathon Submission Video

**Owner:** DemoDirector
**Version:** v2 copy-lock (Friday 2026-04-17 pre-pass; real Preprod values substituted Saturday 2026-04-18 after dependency handoff)
**Target length:** 2 minutes 30 seconds
**Submission deadline:** Sunday 2026-04-19, 22:00 Bangkok (internal record-by 16:00)
**Distribution:** YouTube unlisted link in the submission form, mirror on Loom as a fallback
**Locked pitch phrase (from PITCH.md, used once in F1):** `price-conditional settlement on Cardano, powered by Charli3 ODV`

## Product in one line

A price-conditional settlement agent on Cardano Preprod. A user locks funds with a trigger rule. A Python agent plus Aiken validator releases to the beneficiary atomically when the Charli3 ODV pull oracle says the condition is satisfied.

## The three required moments

1. **DEPOSIT.** User locks funds with a trigger rule.
2. **PRICE CROSS.** Oracle ODV transaction fires, price crosses the trigger.
3. **RELEASE.** Funds pay the beneficiary in the same block as the oracle cross.

Every moment must show a screen, a voiceover line, and a visible proof (transaction hash on Cardanoscan Preprod, a balance change, or the oracle datum value).

## Frame-by-frame

### F1. Title card and hook (0:00 to 0:10, 10s)

- **Screen:** Black card. Project name "Trigger" in large type. Under it: "Price-conditional settlement on Cardano, powered by Charli3 ODV". Preprod badge in the corner.
- **Voiceover:** "What if a payment could wait for the right price, then settle itself, on chain, in a single block?"
- **Visible proof:** none yet, this is the hook.
- **Production notes:** Static frame. Keep music quiet. Cut cleanly to F2.

### F2. The problem (0:10 to 0:25, 15s)

- **Screen:** Split screen. Left side: a stale invoice PDF with "Pay at spot rate" typed on it. Right side: a candlestick chart with a horizontal dashed trigger line and two candles crossing it.
- **Voiceover:** "Real world settlement has a problem. Prices move. Humans do not. Today a treasury operator either accepts slippage, or they babysit a terminal, or they trust a centralized service to pull the trigger."
- **Visible proof:** none. This is the setup.

### F3. The thesis (0:25 to 0:40, 15s)

- **Screen:** Diagram. Three boxes left to right: "Escrow UTXO (Aiken)" pointing to "Charli3 ODV pull oracle" pointing to "Python settlement agent" pointing back to the escrow with a "Release" arrow. Label each arrow with a Cardano tx icon.
- **Voiceover:** "We put the rule on chain. The oracle is load bearing. An ODV request writes a fresh price datum, and our validator releases the funds only if that datum crosses the rule. No human in the loop, no custodial middleman."
- **Visible proof:** diagram is the proof of concept shape, named arrows.

### F4. Deposit screen (0:40 to 0:55, 15s)

- **Screen:** Browser at `localhost:5173` showing the Trigger web app. Wallet connected (Lace on Preprod), tADA balance visible. Deposit form filled in: beneficiary address `addr_test1...`, amount `50 tADA`, trigger `ADA/USD >= 0.55`, expiry `2026-04-20 00:00 UTC`. Mouse hovers the "Lock funds" button.
- **Voiceover:** "Here is the live app on Cardano Preprod. I am locking fifty test ADA to pay this beneficiary, but only if the ADA to USD price crosses fifty five cents before tomorrow midnight."
- **Visible proof:** the form, the real Preprod address prefix `addr_test1`, the Lace network pill reading "Preprod".

### F5. Deposit tx submission (0:55 to 1:05, 10s)

- **Screen:** Lace confirmation popup listing the 50 tADA output going to the escrow script address, with a datum hash preview. Click Confirm. Toast appears: "Escrow created. Tx: `9f3a...c1`".
- **Voiceover:** "The deposit lands in an Aiken escrow. The rule travels with the funds as the datum."
- **Visible proof:** signed Preprod tx, Lace popup, toast with truncated tx hash.

### F6. Escrow on chain (1:05 to 1:15, 10s)

- **Screen:** Cut to Cardanoscan Preprod. URL visible, showing the escrow tx. Zoom in on the datum field with the decoded rule (`trigger_price: 550000, direction: "above", beneficiary: addr_test1...`).
- **Voiceover:** "Cardanoscan confirms it. The rule is public, auditable, and immutable until the condition is met."
- **Visible proof:** full Preprod URL, datum bytes with decoded overlay we render in post.

### F7. Oracle request fires (1:15 to 1:30, 15s)

- **Screen:** Terminal split with agent logs on the left, live price ticker on the right sourced from the ODV feed. Log line: `[agent] rule not yet satisfied, current 0.542, trigger 0.55`. Then the price ticks to `0.551`. Log flips to `[agent] condition met, submitting ODV request tx`.
- **Voiceover:** "The agent is polling. The price is climbing. At fifty five and a tenth cents, it crosses. The agent submits a Charli3 ODV request to mint a fresh price datum."
- **Visible proof:** real price from `https://oracle.charli3.io` feed, agent log line timestamps in UTC.

### F8. ODV transaction on chain (1:30 to 1:45, 15s)

- **Screen:** Cardanoscan Preprod again. The ODV consume transaction. Highlight the oracle feed UTXO output with its fresh datum. Decoded overlay shows `price_usd: 551000, timestamp: 2026-04-19T15:02:11Z, node_signatures: 5 of 7`.
- **Voiceover:** "Charli3's node network signs the price on demand. Five of seven node signatures, timestamped, on chain. This is the oracle moment."
- **Visible proof:** ODV tx hash, decoded datum, signature count. Label "Charli3 ODV feed UTXO" with an arrow in post.

### F9. Release transaction builds (1:45 to 1:55, 10s)

- **Screen:** Agent log advancing: `[agent] oracle utxo confirmed, building release tx`, `[agent] reference input = ODV feed utxo`, `[agent] submitted release tx 7b2e...88`. Web app flips the escrow card state from "Armed" to "Settling".
- **Voiceover:** "The agent references the oracle UTXO as a read-only input, then spends the escrow in the same block."
- **Visible proof:** release tx hash in the agent log, UI state change.

### F10. Release on chain, beneficiary paid (1:55 to 2:10, 15s)

- **Screen:** Cardanoscan Preprod release tx. Show two inputs (escrow UTXO plus reference to ODV feed UTXO) and one output of 50 tADA to the beneficiary address. Cut to beneficiary's Lace wallet: balance before `100 tADA`, balance after `150 tADA`. Green arrow overlay.
- **Voiceover:** "Same block. The escrow closes. The beneficiary wallet jumps by fifty test ADA. No human signed this release."
- **Visible proof:** release tx inputs and outputs on Cardanoscan, balance change screenshot in Lace before and after.

### F11. What this enables (2:10 to 2:25, 15s)

- **Screen:** Three cards fade in. Card 1: "Remittance at spot" with a globe icon. Card 2: "Automated liquidation" with a chart icon. Card 3: "DAO rebalancing" with a vault icon. Each card names the same primitive: "Escrow + ODV trigger".
- **Voiceover:** "One primitive, three markets. Cross border remittance at spot. DeFi positions that close themselves at a threshold. Treasury rebalances you do not have to babysit."
- **Visible proof:** the primitive is the proof. The product just demoed covers all three.

### F12. Close and call to fork (2:25 to 2:30, 5s)

- **Screen:** Repo URL large and centered: `github.com/MorganOnCode/charli3-hackathon-2026`. "MIT" badge. "Built in four days" tag. Charli3 logo small in the corner.
- **Voiceover:** "Open source, MIT, fork it on GitHub. Thank you Charli3."
- **Visible proof:** the URL on screen.

## Total runtime math

- F1 to F3 setup: 40 seconds
- F4 to F6 deposit: 35 seconds
- F7 to F9 price cross: 40 seconds
- F10 release: 15 seconds
- F11 to F12 close: 20 seconds
- Total: 2 minutes 30 seconds, inside the 2 to 3 minute window

## Voiceover budget

Current v2 word count is 282 across F1 to F12, which fits inside the 370-word ceiling with roughly 35 seconds of natural breathing room distributed between sections at 150 words per minute. Do not pad to use the budget. If any frame runs over on rehearsal, cut F2 first by 5 seconds, then F11. The 370-word ceiling holds under the operating rules even if F4 and F10 expand when real Preprod addresses and balances are read aloud.

## Placeholders awaiting Saturday handoff

These tokens are intentionally faked in v2 and will be substituted once the code stack feeds real data. Each swap is a single-line edit in this file.

| Token | Frame | Source | Due |
|---|---|---|---|
| `addr_test1...` beneficiary address | F4, F6 | FrontendDev (CHA-12) wallet panel + OracleEngineer settlement script | Saturday 2026-04-18 18:00 Bangkok |
| Deposit tx hash `9f3a...c1` | F5, F6 | SmartContractDev escrow release tx on Preprod | Saturday 2026-04-18 18:00 Bangkok |
| ODV tx hash and datum `price_usd: 551000` | F7, F8 | OracleEngineer scripted ODV push | Saturday 2026-04-18 19:00 Bangkok |
| Release tx hash `7b2e...88` | F9, F10 | SmartContractDev + OracleEngineer joint run | Saturday 2026-04-18 18:00 Bangkok |
| Beneficiary balance 100 to 150 tADA | F10 | FrontendDev second Lace wallet screenshot | Saturday 2026-04-18 18:00 Bangkok |

Lock amount (50 tADA) and balance delta (100 to 150 tADA) are confirmed against LIVE_DEMO_SCRIPT.md. If FrontendDev or SmartContractDev land different numbers, file a blocker on CHA-15 so the script and storyboard update together.

## What the UI must show (FrontendDev dependencies)

These are the UI states Panel 1 and Panel 2 must render for the storyboard to work. Filed separately as a comment on CHA-12 so FrontendDev has one reference.

1. **Wallet connection panel (Panel 1):** Preprod network pill, Lace address truncated with a copy button, tADA balance refreshed on tx confirm.
2. **Live price panel (Panel 2):** ADA/USD from the real ODV feed once Saturday, Day 1 hardcoded is acceptable. Show timestamp. Show source label reading "Charli3 ODV". One-decimal-of-a-cent precision.
3. **Deposit form:** beneficiary address field with Preprod validation, amount in tADA, trigger price with direction selector (above or below), expiry date picker. Submit button disabled until wallet connected and form valid.
4. **Escrow card states:** `Draft`, `Armed` (after deposit tx confirms), `Settling` (after agent submits release), `Settled` (after release confirms), with the release tx hash clickable to Cardanoscan. This state machine is the most visible UI element in the demo.
5. **Toast or notification for tx submission:** short truncated hash, link to Cardanoscan Preprod. Do not rely on hover tooltips for the tx hash.

If any of these cannot ship by Saturday 2026-04-18 18:00 Bangkok, we need a pre-rendered fallback frame for that moment.

## Tooling

**Primary capture: OBS Studio (local), edited in DaVinci Resolve 19 (free).**

Why OBS over Loom for the submission video:

- OBS captures at 1080p 60fps losslessly. Loom caps at 1080p 30fps on the free tier and re-encodes on upload, which blurs terminal text and datum hex.
- OBS supports multiple scenes (web app, Cardanoscan, Lace, terminal, diagram) with hotkey switching. A 12-frame storyboard needs scene switching. Loom cannot.
- DaVinci Resolve gives us frame-accurate cuts, lower thirds for labeling datums and tx hashes, and audio leveling. Loom's built-in editor cannot add the overlays this storyboard depends on.
- Local files mean we can re-record a single moment without starting over.

**Secondary: Loom for dry-run reviews.** Teammate review of rough cuts stays in Loom because the shared link workflow is fast and we do not need fidelity for feedback rounds.

**Audio:** USB condenser mic, pop filter, Audacity noise reduction pass in post. Target loudness -16 LUFS for YouTube and -14 LUFS for the hackathon's YouTube mirror.

**Screen layout at capture:** 1920x1080, 125 percent browser zoom so text is legible at compressed bitrates. Hide bookmarks bar. One extension visible: Lace.

**Captions:** SRT file generated by Resolve's speech-to-text, hand-corrected for Cardano terminology (Preprod, datum, UTXO, ODV). Attach SRT when uploading to YouTube.

**Thumbnail:** static F11 card with "Trigger" title and Charli3 logo.

## Backup plan

If Preprod is slow on Sunday, we pre-record a clean end-to-end run Saturday 2026-04-18 at 20:00 Bangkok and use it as the video submission. The live demo on Sunday can reference the same screens, with a narration-over-pre-recorded fallback if live chain interactions stall past 20 seconds. Recording logistics, raw-file location, and hosted URL are tracked in [`docs/BACKUP_VIDEO.md`](./BACKUP_VIDEO.md).

## Live demo script v1

Separate file: `docs/LIVE_DEMO_SCRIPT.md`. Cross-reference from here.
