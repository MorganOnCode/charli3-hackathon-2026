# charli3-settlement (Python)

Build price-conditional settlement on Cardano with Charli3's pull oracle
in under twenty lines. MIT-licensed. Works on Preprod today.

## Install

```bash
pip install -e packages/charli3-settlement/python
```

Depends only on `pycardano` and the MIT-licensed
`odv-multisig-charli3-client-sdk` (the Charli3 pull oracle *client*).
No AGPL dependencies.

## Read a fresh price

No on-chain write. Good for health checks and price panels.

```python
import asyncio
from charli3_settlement import request_fresh_price

fresh = asyncio.run(request_fresh_price("configs/ada-usd-preprod.yml"))
print(fresh.price, fresh.timestamp_ms, fresh.is_fresh)
```

## Submit an ODV aggregation tx

Requires a funded Preprod wallet via `WALLET_MNEMONIC`.

```python
import asyncio
from charli3_settlement import submit_odv_tx

submission = asyncio.run(submit_odv_tx("configs/ada-usd-preprod.yml"))
print(submission.tx_hash, submission.oracle_utxo_ref)
```

## Consume the fresh UTxO in your dApp tx

`build_with_oracle_reference` resolves the fresh oracle UTxO, computes
slot bounds that hug the price validity, and hands a context to your
callback. The callback builds and submits the dApp tx.

```python
import asyncio
from charli3_settlement import build_with_oracle_reference, submit_odv_tx

async def main():
    submission = await submit_odv_tx("configs/ada-usd-preprod.yml")

    async def spend_my_validator(ctx):
        # Use ctx.tx_manager and ctx.tx_builder from the SDK; attach
        # {ctx.oracle_utxo} as a reference input on your build call.
        tx = await ctx.tx_manager.build_script_tx(
            script_inputs=[(my_utxo, my_redeemer, my_script)],
            script_outputs=[my_output],
            reference_inputs={ctx.oracle_utxo},
            required_signers=[my_vkh],
            change_address=my_addr,
            signing_key=my_signing_key,
            validity_start=ctx.validity_start_slot,
            validity_end=ctx.validity_end_slot,
        )
        status, _ = await ctx.tx_manager.sign_and_submit(
            tx, signing_keys=[my_signing_key], wait_confirmation=True
        )
        assert status in ("submitted", "confirmed")
        return str(tx.id)

    release_tx_hash = await build_with_oracle_reference(
        submission=submission,
        consumer_fn=spend_my_validator,
        config_path="configs/ada-usd-preprod.yml",
    )
    print(release_tx_hash)

asyncio.run(main())
```

## What's in the datum

The oracle UTxO carries a `GenericData { price_data: PriceData { price_map } }`
CBOR inline-datum. `price_map` keys:

| Key | Meaning          |
| --- | ---------------- |
| 0   | price (USD * 1e6) |
| 1   | timestamp_ms      |
| 2   | expiry_ms         |

Use `decode_oracle_datum_cbor(cbor_hex)` to decode from a raw on-chain fetch.

## Runnable examples

Both examples run as modules from the package directory.

```bash
cd packages/charli3-settlement/python
python -m charli3_settlement_examples.price_alert --threshold 250000 --direction above
python -m charli3_settlement_examples.conditionalpay_quickstart
```

- `charli3_settlement_examples.price_alert` calls `request_fresh_price` and
  prints one line when the threshold is crossed.
- `charli3_settlement_examples.conditionalpay_quickstart` mirrors the
  ConditionalPay flow with `load_settings -> submit_odv_tx ->
  build_with_oracle_reference`, then submits a toy consumer tx with one
  output while attaching the fresh oracle UTxO as a reference input.

## License

MIT. See `LICENSE`.
