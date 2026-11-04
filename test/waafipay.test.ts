import { describe, it, expect, vi } from "vitest";
import { WaafiPay } from "../src/index.js";

function mockFetch(response: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(response), { status }));
}

const config = { merchantUid: "M1", apiUserId: "U1", apiKey: "K1", sandbox: true };

describe("WaafiPay.purchase", () => {
  it("sends a well-formed API_PURCHASE request", async () => {
    const fetch = mockFetch({
      responseCode: "2001",
      responseMsg: "RCS_SUCCESS",
      params: { state: "APPROVED", transactionId: "T-99" },
    });
    const wp = new WaafiPay({ ...config, fetch });

    const result = await wp.purchase({ phone: "0615123456", amount: 5, referenceId: "order-1" });

    expect(result).toMatchObject({ ok: true, state: "APPROVED", transactionId: "T-99", wallet: "EVC_PLUS" });

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://sandbox.waafipay.net/asm");
    const body = JSON.parse(init.body as string);
    expect(body.serviceName).toBe("API_PURCHASE");
    expect(body.serviceParams.payerInfo.accountNo).toBe("252615123456");
    expect(body.serviceParams.transactionInfo).toMatchObject({ amount: "5.00", currency: "USD", referenceId: "order-1" });
  });

  it("reports a declined payment without throwing", async () => {
    const wp = new WaafiPay({
      ...config,
      fetch: mockFetch({ responseCode: "5206", responseMsg: "RCS_USER_REJECTED", params: { state: "DECLINED" } }),
    });
    const result = await wp.purchase({ phone: "0634123456", amount: 1, referenceId: "order-2" });
    expect(result.ok).toBe(false);
    expect(result.wallet).toBe("ZAAD");
    expect(result.message).toBe("RCS_USER_REJECTED");
  });

  it("validates input before calling the API", async () => {
    const fetch = mockFetch({});
    const wp = new WaafiPay({ ...config, fetch });
    await expect(wp.purchase({ phone: "0615123456", amount: 0, referenceId: "x" })).rejects.toThrow(/amount/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("wraps HTTP errors", async () => {
    const wp = new WaafiPay({ ...config, fetch: mockFetch({}, 502) });
    await expect(wp.purchase({ phone: "0615123456", amount: 1, referenceId: "x" })).rejects.toThrow(/HTTP 502/);
  });
});

describe("WaafiPay config", () => {
  it("requires credentials", () => {
    expect(() => new WaafiPay({ merchantUid: "", apiUserId: "u", apiKey: "k" })).toThrow(/merchantUid/);
  });
});
