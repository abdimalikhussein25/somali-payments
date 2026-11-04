import { describe, it, expect } from "vitest";
import { normalizePhone, detectWallet, InvalidPhoneError } from "../src/index.js";

describe("normalizePhone", () => {
  it.each([
    ["+252 61 512 3456", "252615123456"],
    ["00252615123456", "252615123456"],
    ["0615123456", "252615123456"],
    ["615123456", "252615123456"],
    ["252-63-4123456", "252634123456"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("rejects numbers with the wrong length", () => {
    expect(() => normalizePhone("61512")).toThrow(InvalidPhoneError);
  });
});

describe("detectWallet", () => {
  it("detects EVC Plus, Zaad and Sahal", () => {
    expect(detectWallet("0615123456")).toBe("EVC_PLUS");
    expect(detectWallet("0775123456")).toBe("EVC_PLUS");
    expect(detectWallet("0634123456")).toBe("ZAAD");
    expect(detectWallet("0907123456")).toBe("SAHAL");
  });

  it("returns null for unknown prefixes", () => {
    expect(detectWallet("0991234567")).toBeNull();
  });
});
