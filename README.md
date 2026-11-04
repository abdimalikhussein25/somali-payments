# somali-payments

Accept **EVC Plus**, **Zaad** and **Sahal** mobile-money payments from Node.js through [WaafiPay](https://waafipay.com) — typed, tested, and with zero runtime dependencies.

![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

| Wallet | Operator | Number prefixes |
|---|---|---|
| EVC Plus | Hormuud | 61, 77 |
| Zaad | Telesom | 63 |
| Sahal | Golis | 90 |

## Why

Most Somali businesses still take payment by asking customers to "send to this number" and checking SMS by hand. WaafiPay exposes a proper API, but every project ends up re-writing the same request envelope, phone formatting and error handling. This package does it once, properly.

## Install

```bash
npm install somali-payments
```

## Usage

```ts
import { WaafiPay } from "somali-payments";

const waafi = new WaafiPay({
  merchantUid: process.env.WAAFI_MERCHANT_UID!,
  apiUserId: process.env.WAAFI_API_USER_ID!,
  apiKey: process.env.WAAFI_API_KEY!,
  sandbox: true,
});

const result = await waafi.purchase({
  phone: "061 512 3456",   // any common format works
  amount: 2.5,
  referenceId: "order-1001",
  description: "Order #1001",
});

if (result.ok) {
  console.log("Paid", result.transactionId, "via", result.wallet);
} else {
  console.log("Not paid:", result.message); // e.g. customer rejected the PIN prompt
}
```

The customer receives a PIN prompt on their phone; `purchase` resolves once they approve or reject it.

### Pre-authorise, then capture

```ts
const hold = await waafi.preauthorize({ phone, amount: 40, referenceId: "booking-77" });
// ... later, when the service is delivered
await waafi.commit(hold.transactionId!, "booking-77");
// ... or release the funds
await waafi.cancel(hold.transactionId!, "booking-77");
```

### Refund

```ts
await waafi.refund(transactionId, 2.5, "refund-order-1001");
```

### Phone helpers

```ts
import { normalizePhone, detectWallet } from "somali-payments";

normalizePhone("+252 63 412 3456"); // "252634123456"
detectWallet("0907123456");         // "SAHAL"
```

## Error handling

| Situation | Behaviour |
|---|---|
| Customer declines / insufficient balance | Resolves with `ok: false` and WaafiPay's message |
| Invalid phone or amount | Rejects with `InvalidPhoneError` / `Error` **before** any API call |
| Network failure, timeout, non-2xx | Rejects with `WaafiPayNetworkError` |

A network error does **not** mean the payment failed — the customer may still have approved it. Always reconcile by `referenceId` before retrying with a new one.

## Security notes

- Keep `apiKey` on the server. Never ship it to a browser or mobile app.
- Use a unique `referenceId` per attempt so you can reconcile and avoid double charges.
- Confirm the amount on your server — never trust an amount sent from the client.

## Example

[`examples/express-checkout.ts`](examples/express-checkout.ts) is a ~40-line HTTP checkout endpoint.

## Development

```bash
npm install
npm test
npm run build
```

## Disclaimer

Not affiliated with WaafiPay, Hormuud, Telesom or Golis. Verify field names and response codes against the documentation WaafiPay provides with your merchant account, and test in the sandbox before going live.

## License

MIT © Abdimalik Salad Hussein — [Fiddo Technology](https://fiddotechnology.com)
