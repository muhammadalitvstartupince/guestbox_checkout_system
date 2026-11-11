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
      recurringDiscountCents: 0,
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

  it("device-only promo does not discount recurring", () => {
    const result = calculateOrderPrice({
      basePriceCents: 10000,
      quantity: 2,
      recurringPriceCents: 4900,
      promo: { type: "percent", value: 50, appliesTo: "device" },
      selectedInterval: "monthly",
    });
    expect(result.recurringDiscountCents).toBe(0);
    expect(result.discountCents).toBe(10000); // 50% of 20000
    expect(result.totalCents).toBe(10000);
  });

  it("passes recurring through as-is (caller pre-multiplies)", () => {
    const result = calculateOrderPrice({
      basePriceCents: 10000,
      quantity: 3,
      recurringPriceCents: 14700, // caller passes 4900 * 3
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

  // --- appliesTo target tests ---

  it("monthly promo discounts recurring when monthly selected", () => {
    const result = calculateOrderPrice({
      basePriceCents: 10000,
      quantity: 1,
      recurringPriceCents: 2400,
      promo: { type: "percent", value: 25, appliesTo: "monthly" },
      selectedInterval: "monthly",
    });
    expect(result.discountCents).toBe(0);
    expect(result.recurringDiscountCents).toBe(600); // 25% of 2400
  });

  it("monthly promo has no effect when annual selected", () => {
    const result = calculateOrderPrice({
      basePriceCents: 10000,
      quantity: 1,
      recurringPriceCents: 24900,
      promo: { type: "percent", value: 25, appliesTo: "monthly" },
      selectedInterval: "annually",
    });
    expect(result.discountCents).toBe(0);
    expect(result.recurringDiscountCents).toBe(0);
  });

  it("fixed device_monthly splits discount proportionally across device and plan", () => {
    // $10 fixed off (20000 device + 4800 plan = 24800 combined)
    // device share: round(1000 * 20000 / 24800) = 806
    // recurring share: 1000 - 806 = 194
    const result = calculateOrderPrice({
      basePriceCents: 10000,
      quantity: 2,
      recurringPriceCents: 4800,
      promo: { type: "fixed", value: 1000, appliesTo: "device_monthly" },
      selectedInterval: "monthly",
    });
    expect(result.discountCents + result.recurringDiscountCents).toBe(1000);
    expect(result.discountCents).toBe(806);
    expect(result.recurringDiscountCents).toBe(194);
  });

  it("all promo discounts device and whichever plan is selected", () => {
    const result = calculateOrderPrice({
      basePriceCents: 9900,
      quantity: 1,
      recurringPriceCents: 24900,
      promo: { type: "percent", value: 10, appliesTo: "all" },
      selectedInterval: "annually",
    });
    expect(result.discountCents).toBe(990); // 10% of 9900
    expect(result.recurringDiscountCents).toBe(2490); // 10% of 24900
  });

  it("no recurring discount when no interval selected", () => {
    const result = calculateOrderPrice({
      basePriceCents: 10000,
      quantity: 1,
      recurringPriceCents: 2400,
      promo: { type: "percent", value: 50, appliesTo: "all" },
    });
    expect(result.discountCents).toBe(5000);
    expect(result.recurringDiscountCents).toBe(0); // no interval selected
  });

  it("monthly_annual discounts both monthly and annual", () => {
    const result = calculateOrderPrice({
      basePriceCents: 10000,
      quantity: 1,
      recurringPriceCents: 2400,
      promo: { type: "percent", value: 20, appliesTo: "monthly_annual" },
      selectedInterval: "monthly",
    });
    expect(result.discountCents).toBe(0); // no device discount
    expect(result.recurringDiscountCents).toBe(480); // 20% of 2400
  });

  it("defaults appliesTo to device when omitted", () => {
    const result = calculateOrderPrice({
      basePriceCents: 10000,
      quantity: 1,
      recurringPriceCents: 2400,
      promo: { type: "percent", value: 50 },
      selectedInterval: "monthly",
    });
    expect(result.discountCents).toBe(5000);
    expect(result.recurringDiscountCents).toBe(0);
  });

  // --- split mode tests ---

  it("split: device-only discount, no plan discount", () => {
    const result = calculateOrderPrice({
      basePriceCents: 10000,
      quantity: 2,
      recurringPriceCents: 4900,
      promo: { mode: "split", device: { type: "fixed", value: 2000 }, monthly: null, annual: null },
      selectedInterval: "monthly",
    });
    expect(result.discountCents).toBe(2000);
    expect(result.recurringDiscountCents).toBe(0);
    expect(result.totalCents).toBe(18000);
  });

  it("split: monthly discount applied when monthly selected", () => {
    const result = calculateOrderPrice({
      basePriceCents: 10000,
      quantity: 1,
      recurringPriceCents: 4900,
      promo: { mode: "split", device: null, monthly: { type: "percent", value: 10 }, annual: null },
      selectedInterval: "monthly",
    });
    expect(result.discountCents).toBe(0);
    expect(result.recurringDiscountCents).toBe(490); // 10% of 4900
  });

  it("split: annual discount applied when annual selected", () => {
    const result = calculateOrderPrice({
      basePriceCents: 10000,
      quantity: 1,
      recurringPriceCents: 24900,
      promo: { mode: "split", device: null, monthly: { type: "fixed", value: 500 }, annual: { type: "percent", value: 20 } },
      selectedInterval: "annually",
    });
    expect(result.discountCents).toBe(0);
    expect(result.recurringDiscountCents).toBe(4980); // 20% of 24900, NOT the monthly $5
  });

  it("split: device + monthly together, independent discounts", () => {
    const result = calculateOrderPrice({
      basePriceCents: 10000,
      quantity: 2,
      recurringPriceCents: 4900,
      promo: {
        mode: "split",
        device: { type: "fixed", value: 2000 },
        monthly: { type: "fixed", value: 1000 },
        annual: { type: "percent", value: 50 },
      },
      selectedInterval: "monthly",
    });
    expect(result.discountCents).toBe(2000); // $20 off devices
    expect(result.recurringDiscountCents).toBe(1000); // $10 off monthly
    expect(result.totalCents).toBe(18000);
  });

  it("split: device discount clamped to subtotal", () => {
    const result = calculateOrderPrice({
      basePriceCents: 1000,
      quantity: 1,
      promo: { mode: "split", device: { type: "fixed", value: 99999 }, monthly: null, annual: null },
    });
    expect(result.discountCents).toBe(1000);
    expect(result.totalCents).toBe(0);
  });

  it("split: no plan discount when no interval selected", () => {
    const result = calculateOrderPrice({
      basePriceCents: 10000,
      quantity: 1,
      recurringPriceCents: 4900,
      promo: { mode: "split", device: { type: "fixed", value: 500 }, monthly: { type: "fixed", value: 500 }, annual: null },
    });
    expect(result.discountCents).toBe(500);
    expect(result.recurringDiscountCents).toBe(0); // no interval selected
  });
});
