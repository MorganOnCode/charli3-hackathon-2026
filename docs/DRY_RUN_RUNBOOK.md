# DRY RUN RUNBOOK: Saturday Frontend Rehearsal

**Owner:** DemoDirector
**Purpose:** one operator script for the Saturday 2026-04-18 dry run with the working frontend, OracleEngineer handoff, and the live Preprod stack. This runbook exists to catch demo-breakers before the 20:00 Bangkok backup recording.
**Target slot:** Saturday 2026-04-18, 17:00 Bangkok
**Target length:** 25 minutes wall clock for one full pass, then 20 minutes to patch blockers
**Outcome:** decide `go live`, `record with backup cut points`, or `blocked`

## What success looks like

The rehearsal is a success only if all five judge-visible proofs happen in one pass:

1. Real operator commits a real settlement on Preprod.
2. Live Charli3 price is visible and labeled.
3. ODV tx lands first, settlement release references it second.
4. Beneficiary balance increases on Preprod.
5. Closing card still fits under 4:00 with no rushed narration.

## Roles in the room

- **DemoDirector:** drives browser tabs, OBS scenes, timer, and this runbook.
- **CEO:** delivers the spoken script.
- **FrontendDev:** owns UI weirdness, wallet-connection issues, copy readability, and state-machine correctness.
- **OracleEngineer:** owns the `demo_push.py` invocation, feed-cross timing, and ODV tx confirmation.
- **SmartContractDev:** owns release-tx correctness and any validator-side mismatch.

## Pre-flight, 10 minutes before rehearsal

Run these before the CEO starts speaking:

1. Open the tabs in live-demo order:
   - `charli3-settlement` README or quickstart pane
   - `examples/subscription-autopay/main.py`
   - ConditionalPay web app
   - Cardanoscan Preprod on the escrow address
   - agent terminal
   - backup video tab, paused at the ConditionalPay commit beat
2. Confirm the frontend shows the escrow state machine labels `Draft`, `Armed`, `Settling`, `Settled`.
3. Confirm the ODV action label is readable:
   - idle state: `Request ODV tick`
   - pending state: `Submitting ODV...`
4. Confirm the live price panel is sourcing the real feed, not a stub.
5. Run the OracleEngineer pre-flight warm-up:

```bash
cd oracle-client
.venv/bin/python3 scripts/demo_push.py \
  --trigger-price <trial_value> \
  --direction above \
  --dry-run \
  --json
```

6. If the dry run fails, stop and mark the session blocked before the CEO starts.

## One-pass operator script

### Block 1. Library proof, 0:00 to 1:30

- Start timer.
- Open on the README and code panes from [`docs/LIVE_DEMO_SCRIPT.md`](./LIVE_DEMO_SCRIPT.md).
- Verify the import line is legible at normal recording zoom.
- Run the second dApp scaffold.

Pass condition:

- README title, install line, and import panes are readable without zooming during playback.
- `subscription-autopay` reaches its first armed log line inside 20 seconds.

Breakers to log:

- editor font too small to read at 1080p
- terminal output wraps badly
- second dApp install/start exceeds 20 seconds

### Block 2. ConditionalPay commit, 1:30 to 2:00

- In the web app, fill beneficiary, amount, trigger, and expiry.
- Sign the transaction in Lace.
- Watch the escrow card flip to `Armed`.
- Confirm the lock tx toast appears and links out cleanly.

Pass condition:

- operator can complete the commit flow without explaining the UI
- `Armed` state is obvious on a 30-second glance
- lock tx hash is visible either in toast or escrow card

Breakers to log:

- confusing form labels
- wallet pop-up steals focus or obscures the next beat
- no visible tx hash after commit
- card does not clearly differentiate `Draft` vs `Armed`

### Block 3. Oracle proof, 2:00 to 2:30

- Switch to the agent terminal and live price panel.
- Call the live OracleEngineer command on cue.
- Watch for `Submitting ODV...` in the UI or matching terminal confirmation.
- Confirm the ODV tx hash lands before the release step starts.

Pass condition:

- live price is visibly labeled as Charli3 / ODV
- ODV tx confirmation is visible within the allowed narration window
- no one in the room needs to infer whether the request is still running
- the oracle proof reads as deterministic: one oracle UTxO selected by the feed NFT, then used as the reference input

Breakers to log:

- no loading indicator while ODV is pending
- ODV takes longer than 15 seconds after warm-up
- price panel and tx terminal disagree on the current feed value
- ODV tx hash is not visually distinct from the release tx hash
- the oracle moment is visually noisy, for example multiple unrelated reference inputs or byproduct outputs distract from the feed UTxO

### Block 4. Release and payout, 2:30 to 3:00

- Trigger the release tx after the ODV UTXO is visible.
- Show Cardanoscan or the tx activity list with both tx hashes.
- Show the beneficiary wallet delta from 100 tADA to 150 tADA.

Pass condition:

- the two-transaction pattern is obvious without narration rescue
- release tx hash is distinct and visible
- beneficiary balance change can be seen in one cut

Breakers to log:

- release starts before ODV proof is visible
- same-screen evidence is too weak, forcing explanation
- beneficiary wallet refresh is slow or unreliable

### Block 5. Close and cutover drill, 3:00 to 4:00

- Deliver the judging-criteria block.
- Leave the close card on screen.
- Re-run the last 20 seconds once with a forced fallback:
  - stop the live flow
  - cut to the backup video tab
  - narrate over it without apologizing

Pass condition:

- full run fits in 4:00
- backup cutover takes under 5 seconds
- closing card still has enough dwell time to read the repo URL

Breakers to log:

- script overruns 4:00
- presenter loses place during cutover
- backup tab is not pre-positioned correctly

## Demo-breaker scoring

Mark every issue with one severity:

- **Hard blocker:** cannot record the backup video or cannot prove one of the five judge-visible moments.
- **Soft blocker:** recordable, but confusing enough that the CEO must explain what the judge should already see.
- **Polish:** ugly, but not risky.

## Known likely blockers from the current build

These are already visible from the code and must be checked in the room:

1. **ODV pending ambiguity:** the UI does show `Submitting ODV...`, but only while the request is in flight. If the state change is subtle at recording zoom, it becomes a soft blocker.
2. **Lock-action wording drift:** the current frontend code still talks about `Lock tx submitted` and `No active settlement... lock tADA to arm the escrow`. If the final UI keeps that wording, it conflicts with the locked demo language (`agent commit`, `agent is armed`).
3. **State-machine visibility risk:** the escrow card has the right four states, but the operator must confirm `Draft -> Armed -> Settling -> Settled` reads instantly on the projector.
4. **Wallet-refresh lag:** the beneficiary proof depends on a visible balance jump. If Lace or the app lags, the backup recording needs a Cardanoscan-first fallback.

## Decision table after the rehearsal

- **Go live:** no hard blockers, 0 to 2 soft blockers, full run under 4:00.
- **Record with backup cut points:** no hard blockers, but at least one soft blocker around ODV timing or wallet refresh. Record anyway and pre-plan the exact fallback beat.
- **Blocked:** any hard blocker in commit, ODV, release, or payout proof. Stop and patch before recording.

## What to post back on CHA-15

Use this format in the issue comment after the Saturday dry run:

- Result: `go live`, `record with backup cut points`, or `blocked`
- Runtime: exact `mm:ss`
- Hard blockers:
- Soft blockers:
- Decision for the 20:00 Bangkok recording slot:
- Owner for each blocker:

## Related docs

- [`docs/STORYBOARD.md`](./STORYBOARD.md)
- [`docs/LIVE_DEMO_SCRIPT.md`](./LIVE_DEMO_SCRIPT.md)
- [`docs/SHOT_LIST.md`](./SHOT_LIST.md)
- [`docs/BACKUP_VIDEO.md`](./BACKUP_VIDEO.md)
