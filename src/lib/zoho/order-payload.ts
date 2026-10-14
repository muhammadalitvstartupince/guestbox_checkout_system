import type { ZohoLineItem, ZohoRecurringLineItem } from "./post-invoice";

interface CheckoutPageZohoFields {
  zohoItemId: string | null;
  zohoRecurringItemId: string | null;
}

interface AddonZohoFields {
  zohoItemId: string | null;
}

/** Shared by the checkout submit flow and the admin "retry Zoho sync"
 *  action, so both build the exact same line-item shape.
 *  When a billing plan with chargeAtCheckout is selected, pass its
 *  zohoItemId as billingPlanZohoItemId so it's included in line_item. */
export function buildZohoLineItems(
  checkoutPage: CheckoutPageZohoFields,
  quantity: number,
  addons: AddonZohoFields[],
  billingPlanZohoItemId?: string | null,
): ZohoLineItem[] {
  const lineItems: ZohoLineItem[] = [];

  if (checkoutPage.zohoItemId) {
    lineItems.push({ item_id: checkoutPage.zohoItemId, quantity: String(quantity), discount: "0.00", tax_id: "" });
  }

  if (billingPlanZohoItemId) {
    lineItems.push({ item_id: billingPlanZohoItemId, quantity: String(quantity), discount: "0.00", tax_id: "" });
  }

  for (const addon of addons) {
    if (addon.zohoItemId) {
      lineItems.push({ item_id: addon.zohoItemId, quantity: "1", discount: "0.00", tax_id: "" });
    }
  }

  return lineItems;
}

export function buildZohoRecurringLineItems(
  checkoutPage: CheckoutPageZohoFields,
  recurringTotalCents: number,
  quantity: number,
): ZohoRecurringLineItem[] {
  if (!checkoutPage.zohoRecurringItemId || recurringTotalCents <= 0) return [];

  return [
    {
      item_id: checkoutPage.zohoRecurringItemId,
      rate: (recurringTotalCents / 100).toFixed(2),
      quantity: String(quantity),
      discount: "0.00",
      tax_id: "",
    },
  ];
}
