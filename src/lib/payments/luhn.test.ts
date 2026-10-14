import { describe, expect, it } from "vitest";
import { isValidLuhn } from "./luhn";

describe("isValidLuhn", () => {
  it("accepts well-known test card numbers", () => {
    expect(isValidLuhn("4111111111111111")).toBe(true); // Visa
    expect(isValidLuhn("5555555555554444")).toBe(true); // Mastercard
    expect(isValidLuhn("378282246310005")).toBe(true); // Amex
  });

  it("rejects a number with a bad check digit", () => {
    expect(isValidLuhn("4111111111111112")).toBe(false);
  });

  it("rejects sequential digits that aren't a real card number", () => {
    expect(isValidLuhn("1234567890123456")).toBe(false);
  });
});
