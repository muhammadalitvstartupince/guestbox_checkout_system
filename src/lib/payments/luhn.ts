/** Luhn (mod 10) checksum — validates a card number's check digit format
 *  is internally consistent, without needing to attempt a real charge
 *  against the payment gateway just to find out it's garbage. Expects a
 *  digits-only string (strip spaces/dashes before calling). */
export function isValidLuhn(digits: string): boolean {
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}
