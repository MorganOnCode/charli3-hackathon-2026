# web — Charli3 Hackathon settlement demo

React + Vite + TypeScript front end for the price-conditional settlement agent.

## Run

```
npm install
npm run dev
```

The app expects a Cardano CIP-30 wallet (Lace preferred) on Preprod.

## Day 1 status

- Vite + React + TS scaffold complete.
- Tailwind v3 wired, dark minimal theme.
- CIP-30 wallet hook detecting Lace/Eternl/Nami in `window.cardano`.
- Panel 1 shows provider, network (Preprod indicator), tADA balance, change address.
- Panel 2 polls `/stub/price.json` every 5s. Saturday EOD this swaps to the Oracle Engineer's HTTP service.
- Deposit form is UI only. Submit shows JSON preview, no transaction signed yet.

## License

MIT.
