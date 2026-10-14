import { describe, expect, it } from "vitest";
import { calculateOrderPrice } from "./calculate";

describe("calculateOrderPrice", () => {
  it("prices a single unit with no addons or promo", () => {
    const result = calculateOrderPrice({ basePriceCents: 129900, quantity: 1 });
    expect(result).toEqual({
      subtotalCents: 129900,
      discountCents: 0,
      totalCents: 129900,
      recurringTotalCents: 0,
    });
  });

  it("multiplies base price by quantity", () => {
    const result = calculateOrderPrice({ basePriceCents: 129900, quantity: 2 });
    expect(result.subtotalCents).toBe(259800);
    expect(result.totalCents).toBe(259800);
  });

  it("adds addon prices to the subtotal", () => {
    const result = calculateOrderPrice({
      basePriceCents: 129900,
      quantity: 1,
      addons: [{ priceCents: 9900 }, { priceCents: 7900 }],
    });
    expect(result.subtotalCents).toBe(129900 + 9900 + 7900);
    expect(result.totalCents).toBe(result.subtotalCents);
  });

  it("applies a fixed promo discount", () => {
    const result = calculateOrderPrice({
      basePriceCents: 10000,
      quantity: 1,
      promo: { type: "fixed", value: 1500 },
    });
    expect(result.discountCents).toBe(1500);
    expect(result.totalCents).toBe(8500);
  });

  it("applies a percent promo discount, rounded to the nearest cent", () => {
    const result = calculateOrderPrice({
      basePriceCents: 9999,
      quantity: 1,
      promo: { type: "percent", value: 10 },
    });
    // 9999 * 0.10 = 999.9 -> rounds to 1000
    expect(result.discountCents).toBe(1000);
    expect(result.totalCents).toBe(8999);
  });

  it("clamps a discount that would exceed the subtotal to zero total", () => {
    const result = calculateOrderPrice({
      basePriceCents: 1000,
      quantity: 1,
      promo: { type: "fixed", value: 5000 },
    });
    expect(result.discountCents).toBe(1000);
    expect(result.totalCents).toBe(0);
  });

  it("never applies the promo discount to the recurring total", () => {
    const result = calculateOrderPrice({
      basePriceCents: 10000,
      quantity: 2,
      recurringPriceCents: 4900,
      promo: { type: "percent", value: 50 },
    });
    expect(result.recurringTotalCents).toBe(9800);
    expect(result.totalCents).toBe(10000); // 20000 subtotal - 50% = 10000
  });

  it("scales the recurring total by quantity", () => {
    const result = calculateOrderPrice({
      basePriceCents: 10000,
      quantity: 3,
      recurringPriceCents: 4900,
    });
    expect(result.recurringTotalCents).toBe(14700);
  });

  it("defaults recurringTotalCents to 0 when there is no recurring price", () => {
    const result = calculateOrderPrice({ basePriceCents: 10000, quantity: 1 });
    expect(result.recurringTotalCents).toBe(0);
  });

  it("rejects a non-positive quantity", () => {
    expect(() => calculateOrderPrice({ basePriceCents: 1000, quantity: 0 })).toThrow(
      /quantity/,
    );
    expect(() => calculateOrderPrice({ basePriceCents: 1000, quantity: -1 })).toThrow(
      /quantity/,
    );
  });

  it("rejects a non-integer quantity", () => {
    expect(() => calculateOrderPrice({ basePriceCents: 1000, quantity: 1.5 })).toThrow(
      /quantity/,
    );
  });

  it("rejects a negative base price", () => {
    expect(() => calculateOrderPrice({ basePriceCents: -1, quantity: 1 })).toThrow(
      /basePriceCents/,
    );
  });

  it("rejects a negative addon price", () => {
    expect(() =>
      calculateOrderPrice({
        basePriceCents: 1000,
        quantity: 1,
        addons: [{ priceCents: -100 }],
      }),
    ).toThrow(/addon/);
  });

  it("rejects an out-of-range percent promo", () => {
    expect(() =>
      calculateOrderPrice({
        basePriceCents: 1000,
        quantity: 1,
        promo: { type: "percent", value: 150 },
      }),
    ).toThrow(/percent/);
  });

  it("rejects a negative fixed promo value", () => {
    expect(() =>
      calculateOrderPrice({
        basePriceCents: 1000,
        quantity: 1,
        promo: { type: "fixed", value: -100 },
      }),
    ).toThrow(/fixed/);
  });
});
