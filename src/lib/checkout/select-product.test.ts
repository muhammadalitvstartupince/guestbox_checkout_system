import { describe, expect, it } from "vitest";
import { hasUpgradeOffer, selectEffectiveProduct, type BaseProduct, type UpgradeOffer } from "./select-product";

const base: BaseProduct = {
  title: "Roku Channel Launch",
  basePriceCents: 9900,
  recurringPriceCents: 2900,
  zohoItemId: "BASE_ITEM",
  zohoRecurringItemId: "BASE_REC_ITEM",
};

const configuredUpgrade: UpgradeOffer = {
  upgradeTitle: "Roku + Apple TV Bundle",
  upgradeDescription: "Launch on both platforms",
  upgradePriceCents: 14900,
  upgradeRecurringPriceCents: 3900,
  upgradeZohoItemId: "UPGRADE_ITEM",
  upgradeZohoRecurringItemId: "UPGRADE_REC_ITEM",
};

const noUpgrade: UpgradeOffer = {
  upgradeTitle: null,
  upgradeDescription: null,
  upgradePriceCents: null,
  upgradeRecurringPriceCents: null,
  upgradeZohoItemId: null,
  upgradeZohoRecurringItemId: null,
};

describe("hasUpgradeOffer", () => {
  it("is true when both title and price are set", () => {
    expect(hasUpgradeOffer(configuredUpgrade)).toBe(true);
  });

  it("is false when nothing is set", () => {
    expect(hasUpgradeOffer(noUpgrade)).toBe(false);
  });

  it("is false when title is set but price is missing", () => {
    expect(hasUpgradeOffer({ ...noUpgrade, upgradeTitle: "Bundle" })).toBe(false);
  });

  it("is false when price is set but title is missing", () => {
    expect(hasUpgradeOffer({ ...noUpgrade, upgradePriceCents: 14900 })).toBe(false);
  });

  it("is false when title is only whitespace", () => {
    expect(hasUpgradeOffer({ ...configuredUpgrade, upgradeTitle: "   " })).toBe(false);
  });
});

describe("selectEffectiveProduct", () => {
  it("returns the base product when the upgrade wasn't selected", () => {
    const result = selectEffectiveProduct(base, configuredUpgrade, false);
    expect(result).toEqual({
      title: "Roku Channel Launch",
      priceCents: 9900,
      recurringPriceCents: 2900,
      zohoItemId: "BASE_ITEM",
      zohoRecurringItemId: "BASE_REC_ITEM",
    });
  });

  it("returns the upgrade product when selected and configured", () => {
    const result = selectEffectiveProduct(base, configuredUpgrade, true);
    expect(result).toEqual({
      title: "Roku + Apple TV Bundle",
      priceCents: 14900,
      recurringPriceCents: 3900,
      zohoItemId: "UPGRADE_ITEM",
      zohoRecurringItemId: "UPGRADE_REC_ITEM",
    });
  });

  it("falls back to the base product when selected but no upgrade is configured on the page", () => {
    // Never trust a client-submitted upgradeSelected=true against a page
    // that doesn't actually have one configured.
    const result = selectEffectiveProduct(base, noUpgrade, true);
    expect(result.title).toBe("Roku Channel Launch");
    expect(result.priceCents).toBe(9900);
  });

  it("passes through a null recurring price on the upgrade unchanged", () => {
    const result = selectEffectiveProduct(base, { ...configuredUpgrade, upgradeRecurringPriceCents: null }, true);
    expect(result.recurringPriceCents).toBeNull();
  });
});
