/**
 * Somali mobile-money number helpers.
 *
 * WaafiPay routes payments by the subscriber's number. The prefixes below are
 * the commonly used ranges for each wallet; operators add ranges over time, so
 * treat `detectWallet` as a convenience, not as the source of truth.
 */

export type Wallet = "EVC_PLUS" | "ZAAD" | "SAHAL";

const WALLET_PREFIXES: Record<Wallet, string[]> = {
  EVC_PLUS: ["61", "77"], // Hormuud
  ZAAD: ["63"], // Telesom
  SAHAL: ["90"], // Golis
};

const COUNTRY_CODE = "252";

/**
 * Normalise a Somali mobile number to the 12-digit international form
 * WaafiPay expects (e.g. "252615123456").
 *
 * Accepts "+252 61 512 3456", "00252615123456", "0615123456", "615123456".
 */
export function normalizePhone(input: string): string {
  let digits = input.replace(/[^\d]/g, "");

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith(COUNTRY_CODE)) digits = digits.slice(COUNTRY_CODE.length);
  if (digits.startsWith("0")) digits = digits.slice(1);

  if (!/^\d{9}$/.test(digits)) {
    throw new InvalidPhoneError(input);
  }
  return COUNTRY_CODE + digits;
}

/** Best-effort wallet detection from the number prefix. Returns null if unknown. */
export function detectWallet(input: string): Wallet | null {
  const local = normalizePhone(input).slice(COUNTRY_CODE.length);
  for (const [wallet, prefixes] of Object.entries(WALLET_PREFIXES) as [Wallet, string[]][]) {
    if (prefixes.some((p) => local.startsWith(p))) return wallet;
  }
  return null;
}

export class InvalidPhoneError extends Error {
  constructor(public readonly input: string) {
    super(`"${input}" is not a valid Somali mobile number`);
    this.name = "InvalidPhoneError";
  }
}
