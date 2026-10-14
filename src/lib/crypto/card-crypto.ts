import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Card field encryption: AES-256-CBC, encrypt-then-MAC with HMAC-SHA256,
 * hex-encoded (IV(16) + HMAC(32) + ciphertext) — same layout as the legacy
 * PHP encrypt()/decrypt() pair (__docs/roku-apple-14thJulySale-2026-order-form.php),
 * reimplemented with a proper 32-byte key instead of PHP's implicit
 * zero-pad/truncate of an arbitrary-length passphrase.
 *
 * CARD_ENCRYPTION_KEY must be 64 hex characters (32 bytes / 256 bits).
 * Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;
const HMAC_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const keyHex = process.env.CARD_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("CARD_ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error("CARD_ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  }
  return key;
}

export function encryptCardField(plaintext: string, key: Buffer = getEncryptionKey()): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  const hmac = createHmac("sha256", key).update(Buffer.concat([iv, encrypted])).digest();

  return Buffer.concat([iv, hmac, encrypted]).toString("hex").toUpperCase();
}

export function decryptCardField(ciphertextHex: string, key: Buffer = getEncryptionKey()): string {
  const data = Buffer.from(ciphertextHex, "hex");
  if (data.length < IV_LENGTH + HMAC_LENGTH) {
    throw new Error("Decryption failed: ciphertext too short");
  }

  const iv = data.subarray(0, IV_LENGTH);
  const hmac = data.subarray(IV_LENGTH, IV_LENGTH + HMAC_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + HMAC_LENGTH);

  const expectedHmac = createHmac("sha256", key).update(Buffer.concat([iv, encrypted])).digest();
  if (hmac.length !== expectedHmac.length || !timingSafeEqual(hmac, expectedHmac)) {
    throw new Error("Decryption failed: HMAC verification failed");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

/** Cryptographically-random per-order key an admin must supply (in addition
 *  to being authenticated) to decrypt that order's card fields. */
export function generateCardHashKey(length = 32): string {
  const characters = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters[bytes[i] % characters.length];
  }
  return result;
}

// Re-exported for backwards compatibility with existing import sites — the
// actual (pure, client-safe) logic lives in lib/payments/card-brand.ts so it
// can also be imported from "use client" components without dragging in
// this file's node:crypto usage.
export { detectCardBrand, getCardLast4 } from "../payments/card-brand";
