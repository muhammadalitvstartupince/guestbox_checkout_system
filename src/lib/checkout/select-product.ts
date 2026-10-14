/**
 * Resolves which product a given order is actually for: the checkout page's
 * base product, or its optional upgrade offer if the customer opted in.
 * Unlike add-ons (which stack), an upgrade REPLACES the base product's
 * price and Zoho mapping entirely.
 */

export interface BaseProduct {
  title: string;
  basePriceCents: number;
  recurringPriceCents: number | null;
  zohoItemId: string | null;
  zohoRecurringItemId: string | null;
}

export interface UpgradeOffer {
  upgradeTitle: string | null;
  upgradeDescription: string | null;
  upgradePriceCents: number | null;
  upgradeRecurringPriceCents: number | null;
  upgradeZohoItemId: string | null;
  upgradeZohoRecurringItemId: string | null;
}

export interface EffectiveProduct {
  title: string;
  priceCents: number;
  recurringPriceCents: number | null;
  zohoItemId: string | null;
  zohoRecurringItemId: string | null;
}

/** An upgrade offer is only "available" once both a title and a price are configured. */
export function hasUpgradeOffer(page: UpgradeOffer): boolean {
  return page.upgradeTitle != null && page.upgradeTitle.trim() !== "" && page.upgradePriceCents != null;
}

export function selectEffectiveProduct(
  base: BaseProduct,
  page: UpgradeOffer,
  upgradeSelected: boolean,
): EffectiveProduct {
  if (upgradeSelected && hasUpgradeOffer(page)) {
    return {
      title: page.upgradeTitle as string,
      priceCents: page.upgradePriceCents as number,
      recurringPriceCents: page.upgradeRecurringPriceCents,
      zohoItemId: page.upgradeZohoItemId,
      zohoRecurringItemId: page.upgradeZohoRecurringItemId,
    };
  }

  return {
    title: base.title,
    priceCents: base.basePriceCents,
    recurringPriceCents: base.recurringPriceCents,
    zohoItemId: base.zohoItemId,
    zohoRecurringItemId: base.zohoRecurringItemId,
  };
}
