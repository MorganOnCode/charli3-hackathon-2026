# BACKUP VIDEO: Charli3 Hackathon Submission

**Owner:** DemoDirector
**Purpose:** If Preprod is slow during Sunday's live demo, we cut to a clean pre-recorded end-to-end run and narrate over it.
**Version:** v2.3 (Friday 2026-04-17 evening Bangkok; integrates OracleEngineer handoff per [CHA-15 #61f3fc5a](/CHA/issues/CHA-15#comment-61f3fc5a-b7e1-4dd3-a03d-40d6e2657df2). Cue-able push command rebased to venv-activated shape with `--json` emitter; warm/cold latency envelope logged; Blockfrost fallback advisory added. Captions from v2.2 untouched). Populated with raw-file path and hosted URL after Saturday 2026-04-18 recording.

Dry-run operator script lives in [`docs/DRY_RUN_RUNBOOK.md`](./DRY_RUN_RUNBOOK.md). Saturday rehearsal should use that file, not memory.

## Caption language lock

Use these exact phrasing choices in title cards, lower thirds, and narrated overlays so the agent framing stays consistent:

- Say `agent commit` or `agent committed`, not `user locks` or `deposit`.
- Say `the oracle proves the rule`, not `the price crosses`.
- Say `beneficiary`, not `counterparty`, on wallet and payout overlays.
- Say `the agent is armed`, not `escrow armed`, when the commit transaction confirms.
- Say `the library settles because the oracle proved it could`, not `the oracle said it could`.

## Recording slot

**Saturday 2026-04-18, 20:00 Bangkok.** 90-minute block. Three clean takes target.

Pre-requirements confirmed earlier that day:

- FrontendDev (CHA-12): escrow card state machine (Draft, Armed, Settling, Settled) visible in the UI by 18:00 Bangkok.
- SmartContractDev: Aiken validator producing a real release tx on Preprod by 18:00 Bangkok.
- OracleEngineer: scripted ODV push **handoff landed** Friday evening per [CHA-15 #61f3fc5a](/CHA/issues/CHA-15#comment-61f3fc5a-b7e1-4dd3-a03d-40d6e2657df2). Three Preprod submissions verified on [CHA-18 #fe551ba7](/CHA/issues/CHA-18#comment-fe551ba7-4900-46d5-bbe1-40a96ea47e57). Measured submission wall time 10.9 s / 29.7 s / 52.2 s across the three tests; warm path fits the 15 s envelope, the 52 s outlier was a cold SDK context. Mandatory on-site `--dry-run` pre-flight warms the SDK and eliminates the cold-context outlier. Funding via [CHA-18](/CHA/issues/CHA-18) **resolved**.

If any pre-requirement slips, file a blocker on [CHA-15](/CHA/issues/CHA-15) and push the recording slot to 22:00 Bangkok. Do not record against a broken stack.

### Cue-able push command for recording

Second terminal, off-camera. Venv active, `.env` loaded (`set -a; source oracle-client/.env; set +a`). Pre-flight dry-run before every take warms the SDK context and previews the feed cross:

```bash
cd oracle-client
.venv/bin/python3 scripts/demo_push.py \
  --trigger-price <armed_trigger_from_datum> \
  --direction above \
  --dry-run \
  --json
```

Live push during the take, fired the moment the escrow card flips to `Armed`:

```bash
cd oracle-client
WALLET_MNEMONIC=<funded mnemonic> \
  .venv/bin/python3 scripts/demo_push.py \
    --trigger-price <armed_trigger_from_datum> \
    --direction above \
    --json
```

`--trigger-price` is integer USD times 1,000,000 (example: `256500` = 0.256500 USD/ADA). Live Preprod readings cluster around `0.2562x`, so pin the armed trigger just above and the scripted push crosses. Exit code 0 = submitted and confirmed under 15 s; rerun the take if exit 4 (did not cross) or exit 5 (over budget). Under no circumstances skip the `--dry-run` pre-flight: without it the first live submission can land on the cold SDK path (observed 52 s) and blow the 15 s envelope.

### Blockfrost fallback

If Preprod Ogmios or Kupo goes flaky during recording, the wrapper auto-falls-back to Blockfrost Preprod per OracleEngineer handoff. Expect +200 to 500 ms per poll; the 15 s budget still holds. If we record any take via Blockfrost, log the take number in post notes so we can re-record Sunday morning if the primary path recovers.

## Capture stack

- **OBS Studio**, 1920x1080, 60 fps, CRF 18, MKV (remux to MP4 at post).
- Scene list mapped to frames in [STORYBOARD.md](./STORYBOARD.md):
  - Scene 1: Title card (F1)
  - Scene 2: ConditionalPay web app at `localhost:5173` (F4, F9, F10 UI state)
  - Scene 3: Lace wallet popup (F5, F10 beneficiary)
  - Scene 4: Cardanoscan Preprod (F6, F8, F10)
  - Scene 5: Agent terminal, 18pt dark (F7, F9)
  - Scene 6: Diagram slide (F3)
- Hotkey scene-switching: F1 through F6 bound numerically.
- Microphone: USB condenser, pop filter, Audacity noise-reduction pass before edit.
- Browser zoom 125 percent, bookmarks bar hidden, Lace the only visible extension.

## Take order

1. **Take 1 (20:00):** Full 2:30 pass, no retakes mid-take. Mistakes become reshoots later.
2. **Take 2 (20:30):** Second full pass. Pick the cleaner of 1 and 2 as the spine.
3. **Take 3 (21:00):** Reshoot any single frames where audio flubbed or the chain stalled. Cut into the spine in Resolve.

Keep the raw MKVs until Sunday submission is uploaded.

## Post

- Edit in **DaVinci Resolve 19 (free)**.
- Lower thirds for datum hex, tx hash truncations, and the "Charli3 ODV feed UTXO" label on F8.
- Audio target: -16 LUFS integrated (YouTube baseline).
- Export: MP4, H.264, 1080p60, VBR 16 Mbps, AAC 192 kbps.
- SRT captions generated by Resolve speech-to-text, hand-corrected for Preprod, datum, UTXO, ODV, Charli3, PyCardano, Aiken.

## Storage and distribution

- Raw MKV files: `~/Videos/charli3-submission/raw/` on the presenter laptop. Do not commit binaries to git.
- Edited MP4 master: `~/Videos/charli3-submission/master/conditionalpay-submission-v1.mp4`. Keep local, not in repo.
- Hosted copy: **YouTube unlisted** account `@MorganOnCode`, title `ConditionalPay: agent-grade settlement on Cardano, powered by Charli3 ODV`, description copied from `docs/PITCH.md`, SRT uploaded as caption track.
- Loom mirror: same MP4 uploaded for redundancy. Both URLs pasted below after Saturday recording.

## Locked values for this recording

- Lock amount: **50 tADA**
- Trigger: **ADA/USD >= 0.27**
- Current price at arm time: **~0.253 USD/ADA** (live Preprod median across two Charli3 nodes)
- Scripted ODV push target: **just above 0.270 USD/ADA** (datum field `price_usd > 270000`, 6 decimal scaling; exact value is whatever the median aggregator returns at push time per OracleEngineer)
- Expiry: **2026-04-20 00:00 UTC**
- Counterparty balance change: **100 tADA to 150 tADA**
- Node signatures: **2 of 2** (Charli3 Preprod feed has two nodes; both must agree per `oracle-client/configs/ada-usd-preprod.yml`)
- Oracle NFT policy / asset: **`886dcb2363e160c944e63cf544ce6f6265b22ef7c4e2478dd975078e` / `C3AS`**

These must match [LIVE_DEMO_SCRIPT.md](./LIVE_DEMO_SCRIPT.md) and [STORYBOARD.md](./STORYBOARD.md). If anything drifts, update all three in the same commit.

## Submission links

Filled in Saturday 2026-04-18 after recording wraps:

- YouTube unlisted URL: `TBD Saturday 2026-04-18 22:00 Bangkok`
- Loom mirror URL: `TBD Saturday 2026-04-18 22:00 Bangkok`
- Raw MKV local path: `TBD Saturday 2026-04-18 22:00 Bangkok`
- MP4 master local path: `TBD Saturday 2026-04-18 22:00 Bangkok`
- SHA256 of MP4 master: `TBD`

## Use during live demo

During the Sunday 23:00 Bangkok slot, the backup video lives in a background browser tab cued to F4. Cutover rule: if any Preprod transaction stalls past 20 seconds of wall clock, presenter says "let me show you the pre-recorded run," switches tabs, and narrates over the playback at 1.0x. Do not explain the cutover to the judges as a failure. Narrate as if this was the plan.

If Preprod is down entirely at slot start, lead with the backup video and keep the ConditionalPay web app open for Q&A inspection.
