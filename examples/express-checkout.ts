/**
 * Minimal checkout endpoint.
 *   WAAFI_MERCHANT_UID=... WAAFI_API_USER_ID=... WAAFI_API_KEY=... npx tsx examples/express-checkout.ts
 *   curl -X POST localhost:3000/pay -H 'content-type: application/json' \
 *        -d '{"phone":"0615123456","amount":2.5,"orderId":"A-1001"}'
 */
import { createServer } from "node:http";
import { WaafiPay, InvalidPhoneError } from "../src/index.js";

const waafi = new WaafiPay({
  merchantUid: process.env.WAAFI_MERCHANT_UID!,
  apiUserId: process.env.WAAFI_API_USER_ID!,
  apiKey: process.env.WAAFI_API_KEY!,
  sandbox: process.env.NODE_ENV !== "production",
});

createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/pay") {
    res.writeHead(404).end();
    return;
  }
  let raw = "";
  for await (const chunk of req) raw += chunk;

  try {
    const { phone, amount, orderId } = JSON.parse(raw);
    const result = await waafi.purchase({ phone, amount, referenceId: orderId, description: `Order ${orderId}` });
    res.writeHead(result.ok ? 200 : 402, { "content-type": "application/json" });
    res.end(JSON.stringify({ paid: result.ok, transactionId: result.transactionId, message: result.message }));
  } catch (err) {
    const status = err instanceof InvalidPhoneError ? 400 : 500;
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}).listen(3000, () => console.log("Checkout listening on :3000"));
