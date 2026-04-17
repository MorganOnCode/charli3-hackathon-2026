# web / Charli3 Hackathon settlement demo

React + Vite + TypeScript front end for the price-conditional settlement agent.

## Run

```
npm install
npm run dev
```

The app expects a Cardano CIP-30 wallet (Lace preferred) on Preprod.

## Panels

1. **Wallet**: provider, Preprod network pill, tADA balance, truncated change address. Balance refreshes on connect and after each tx confirmation rather than on a timer.
2. **Charli3 ODV**: live price panel, tenth-of-a-cent precision (`0.000`), timestamped, source labelled. Day 1 reads `/stub/price.json`. Saturday EOD it reads the live ODV feed via the Oracle Engineer's HTTP service.
3. **Create Settlement**: beneficiary (`addr_test1...` validated), amount in tADA, trigger price, above/below direction, expiry datetime. Submit disabled until valid and wallet connected.
4. **Escrow**: state machine `Draft -> Armed -> Settling -> Settled`. Lock tx, ODV request, and release tx each link to Cardanoscan Preprod.

## Tx toasts

Bottom-right always-visible toasts show truncated hashes and Cardanoscan Preprod links for every lock, ODV, and release tx. No hover needed, so the screen recording reads cleanly.

## Day 1 and 2 status

- Vite + React + TS scaffold complete.
- Tailwind v3 wired, dark minimal theme tuned for 1080p screen share at 125 percent zoom.
- CIP-30 wallet hook detecting Lace/Eternl/Nami in `window.cardano`.
- Escrow state machine clickable end-to-end with mocked tx hashes. Saturday the mocks are swapped for real CIP-30 tx builds via the Oracle Engineer service.

## License

MIT.
