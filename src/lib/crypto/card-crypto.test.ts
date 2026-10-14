import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decryptCardField,
  detectCardBrand,
  encryptCardField,
  generateCardHashKey,
  getCardLast4,
} from "./card-crypto";

const testKey = randomBytes(32);

describe("encryptCardField / decryptCardField", () => {
  it("round-trips a card number", () => {
    const plaintext = "4111111111111111";
    const encrypted = encryptCardField(plaintext, testKey);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptCardField(encrypted, testKey)).toBe(plaintext);
  });

  it("round-trips a CVV", () => {
    const plaintext = "123";
    const encrypted = encryptCardField(plaintext, testKey);
    expect(decryptCardField(encrypted, testKey)).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const a = encryptCardField("4111111111111111", testKey);
    const b = encryptCardField("4111111111111111", testKey);
    expect(a).not.toBe(b);
  });

  it("rejects a ciphertext tampered after encryption", () => {
    const encrypted = encryptCardField("4111111111111111", testKey);
    // flip a character well into the ciphertext portion
    const tampered = encrypted.slice(0, -1) + (encrypted.at(-1) === "0" ? "1" : "0");
    expect(() => decryptCardField(tampered, testKey)).toThrow(/HMAC/);
  });

  it("rejects decryption with the wrong key", () => {
    const encrypted = encryptCardField("4111111111111111", testKey);
    const wrongKey = randomBytes(32);
    expect(() => decryptCardField(encrypted, wrongKey)).toThrow(/HMAC/);
  });

  it("rejects a truncated ciphertext", () => {
    expect(() => decryptCardField("AB", testKey)).toThrow(/too short/);
  });

  it("throws when CARD_ENCRYPTION_KEY is not set and no key is passed", () => {
    const original = process.env.CARD_ENCRYPTION_KEY;
    delete process.env.CARD_ENCRYPTION_KEY;
    try {
      expect(() => encryptCardField("4111111111111111")).toThrow(/CARD_ENCRYPTION_KEY/);
    } finally {
      if (original !== undefined) process.env.CARD_ENCRYPTION_KEY = original;
    }
  });

  it("throws when CARD_ENCRYPTION_KEY is the wrong length", () => {
    const original = process.env.CARD_ENCRYPTION_KEY;
    process.env.CARD_ENCRYPTION_KEY = "deadbeef"; // 4 bytes, not 32
    try {
      expect(() => encryptCardField("4111111111111111")).toThrow(/64 hex characters/);
    } finally {
      if (original !== undefined) process.env.CARD_ENCRYPTION_KEY = original;
      else delete process.env.CARD_ENCRYPTION_KEY;
    }
  });
});

describe("generateCardHashKey", () => {
  it("generates a 32-character alphanumeric key by default", () => {
    const key = generateCardHashKey();
    expect(key).toHaveLength(32);
    expect(key).toMatch(/^[0-9a-zA-Z]+$/);
  });

  it("generates distinct keys on each call", () => {
    const a = generateCardHashKey();
    const b = generateCardHashKey();
    expect(a).not.toBe(b);
  });

  it("respects a custom length", () => {
    expect(generateCardHashKey(16)).toHaveLength(16);
  });
});

describe("detectCardBrand", () => {
  it.each([
    ["4111111111111111", "visa"],
    ["5500000000000004", "mastercard"],
    ["340000000000009", "amex"],
    ["6011000000000004", "discover"],
    ["1234567890123456", null],
  ])("detects %s as %s", (number, expected) => {
    expect(detectCardBrand(number)).toBe(expected);
  });
});

describe("getCardLast4", () => {
  it("returns the last 4 digits", () => {
    expect(getCardLast4("4111 1111 1111 1111")).toBe("1111");
  });
});
