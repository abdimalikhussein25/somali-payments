import { randomUUID } from "node:crypto";
import { normalizePhone, detectWallet, type Wallet } from "./phone.js";

export interface WaafiPayConfig {
  merchantUid: string;
  apiUserId: string;
  apiKey: string;
  /** Use the WaafiPay sandbox instead of production. Default: false. */
  sandbox?: boolean;
  /** Override the endpoint (useful for proxies or tests). */
  baseUrl?: string;
  /** Request timeout in ms. Default: 60s — the customer approves on their phone. */
  timeoutMs?: number;
  /** Custom fetch implementation (tests, older runtimes). */
  fetch?: typeof fetch;
}

export interface PurchaseRequest {
  /** Customer phone in any common format, e.g. "0615123456". */
  phone: string;
  amount: number;
  currency?: "USD" | "SLSH" | "SOS";
  /** Your order/reference id. Must be unique per attempt. */
  referenceId: string;
  invoiceId?: string;
  description?: string;
}

export interface PaymentResult {
  ok: boolean;
  /** "APPROVED", "DECLINED", ... as reported by WaafiPay. */
  state: string | null;
  transactionId: string | null;
  referenceId: string;
  wallet: Wallet | null;
  responseCode: string;
  message: string;
  raw: unknown;
}

const PRODUCTION_URL = "https://api.waafipay.net/asm";
const SANDBOX_URL = "https://sandbox.waafipay.net/asm";
const SUCCESS_CODE = "2001";

type ServiceName =
  | "API_PURCHASE"
  | "API_PREAUTHORIZE"
  | "API_PREAUTHORIZE_COMMIT"
  | "API_PREAUTHORIZE_CANCEL"
  | "API_REFUND";

/**
 * Minimal, dependency-free client for WaafiPay — the gateway behind
 * EVC Plus (Hormuud), Zaad (Telesom) and Sahal (Golis).
 */
export class WaafiPay {
  private readonly url: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: WaafiPayConfig) {
    for (const key of ["merchantUid", "apiUserId", "apiKey"] as const) {
      if (!config[key]) throw new Error(`WaafiPay: missing "${key}"`);
    }
    this.url = config.baseUrl ?? (config.sandbox ? SANDBOX_URL : PRODUCTION_URL);
    this.timeoutMs = config.timeoutMs ?? 60_000;
    this.fetchImpl = config.fetch ?? globalThis.fetch;
  }

  /** Charge a customer's wallet immediately. They confirm with their PIN. */
  purchase(req: PurchaseRequest): Promise<PaymentResult> {
    return this.walletRequest("API_PURCHASE", req);
  }

  /** Hold funds now, capture later with `commit` (e.g. when the order ships). */
  preauthorize(req: PurchaseRequest): Promise<PaymentResult> {
    return this.walletRequest("API_PREAUTHORIZE", req);
  }

  commit(transactionId: string, referenceId: string, description = "Commit"): Promise<PaymentResult> {
    return this.call("API_PREAUTHORIZE_COMMIT", { transactionId, description, referenceId }, referenceId, null);
  }

  cancel(transactionId: string, referenceId: string, description = "Cancel"): Promise<PaymentResult> {
    return this.call("API_PREAUTHORIZE_CANCEL", { transactionId, description, referenceId }, referenceId, null);
  }

  async refund(transactionId: string, amount: number, referenceId: string, description = "Refund"): Promise<PaymentResult> {
    assertAmount(amount);
    return this.call(
      "API_REFUND",
      { transactionId, amount: amount.toFixed(2), description, referenceId },
      referenceId,
      null,
    );
  }

  private async walletRequest(service: ServiceName, req: PurchaseRequest): Promise<PaymentResult> {
    assertAmount(req.amount);
    if (!req.referenceId) throw new Error("WaafiPay: referenceId is required");

    const accountNo = normalizePhone(req.phone);
    return this.call(
      service,
      {
        paymentMethod: "mwallet_account",
        payerInfo: { accountNo },
        transactionInfo: {
          referenceId: req.referenceId,
          invoiceId: req.invoiceId ?? req.referenceId,
          amount: req.amount.toFixed(2),
          currency: req.currency ?? "USD",
          description: req.description ?? "Payment",
        },
      },
      req.referenceId,
      detectWallet(accountNo),
    );
  }

  private async call(
    serviceName: ServiceName,
    params: Record<string, unknown>,
    referenceId: string,
    wallet: Wallet | null,
  ): Promise<PaymentResult> {
    const body = {
      schemaVersion: "1.0",
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
      channelName: "WEB",
      serviceName,
      serviceParams: {
        merchantUid: this.config.merchantUid,
        apiUserId: this.config.apiUserId,
        apiKey: this.config.apiKey,
        ...params,
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      throw new WaafiPayNetworkError(serviceName, err);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) throw new WaafiPayNetworkError(serviceName, new Error(`HTTP ${res.status}`));

    const data = (await res.json()) as WaafiPayResponse;
    const state = data.params?.state ?? null;
    const ok = data.responseCode === SUCCESS_CODE && (state === null || state === "APPROVED");

    return {
      ok,
      state,
      transactionId: data.params?.transactionId ?? null,
      referenceId,
      wallet,
      responseCode: data.responseCode,
      message: data.params?.description ?? data.responseMsg ?? "",
      raw: data,
    };
  }
}

interface WaafiPayResponse {
  responseCode: string;
  responseMsg?: string;
  params?: { state?: string; transactionId?: string; description?: string };
}

function assertAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`WaafiPay: invalid amount ${amount}`);
  }
}

export class WaafiPayNetworkError extends Error {
  constructor(public readonly service: string, public readonly cause: unknown) {
    super(`WaafiPay ${service} request failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "WaafiPayNetworkError";
  }
}
