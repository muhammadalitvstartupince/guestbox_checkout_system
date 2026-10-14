// Pure, no server-only imports (unlike lib/crypto/card-crypto.ts, which
// pulls in node:crypto) — safe to import from a "use client" component for
// live brand detection as the customer types, as well as from the server.

const CARD_BRAND_PATTERNS: { brand: string; pattern: RegExp }[] = [
  { brand: "amex", pattern: /^3[47]/ },
  { brand: "visa", pattern: /^4/ },
  { brand: "mastercard", pattern: /^(5[1-5]|2[2-7])/ },
  { brand: "discover", pattern: /^6(?:011|5)/ },
];

/** Best-effort brand detection from the card number prefix (IIN ranges). */
export function detectCardBrand(cardNumber: string): string | null {
  const digits = cardNumber.replace(/\D/g, "");
  for (const { brand, pattern } of CARD_BRAND_PATTERNS) {
    if (pattern.test(digits)) return brand;
  }
  return null;
}

export function getCardLast4(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, "");
  return digits.slice(-4);
}
