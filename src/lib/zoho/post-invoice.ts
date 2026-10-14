/**
 * Posts order data to the existing Zoho invoice-creation endpoint
 * (__docs/zoho_invoice_functions.php: post_zoho_invoices()). We are not
 * rebuilding Zoho logic — this calls the same external endpoint the legacy
 * system already posts to.
 *
 * The bearer token embedded in the legacy PHP file is not reused here: it
 * may have rotated since, and a live credential shouldn't be copied out of
 * a reference file into new source. Set ZOHO_API_TOKEN instead.
 */

const DEFAULT_ENDPOINT = "https://zohoapi.guestbox.tv/index.php";

export interface ZohoLineItem {
  item_id: string;
  quantity: string;
  discount: string;
  tax_id: string;
}

export interface ZohoRecurringLineItem extends ZohoLineItem {
  rate: string;
}

export interface ZohoShippingAddress {
  streetad: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
}

export interface PostZohoInvoiceInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  amountCents: number;
  startDate: string; // Y-m-d
  payDate: string; // Y-m-d
  lineItems: ZohoLineItem[];
  recurringInvoiceItems: ZohoRecurringLineItem[];
  // Optional fields matching PHP reference
  phoneCountry?: string;
  company?: string;
  timezone?: string;
  currency?: string;
  fulfillmentItems?: ZohoLineItem[];
  shippingAddress?: ZohoShippingAddress;
  discountAmount?: number; // dollars, not cents
}

export interface PostZohoInvoiceResult {
  success: boolean;
  payload: Record<string, unknown>;
  response?: unknown;
  error?: string;
}

function centsToDollars(cents: number): number {
  return Math.trunc(cents) / 100;
}

export async function postZohoInvoice(
  input: PostZohoInvoiceInput,
): Promise<PostZohoInvoiceResult> {
  const token = process.env.ZOHO_API_TOKEN;
  if (!token) {
    return { success: false, payload: {}, error: "ZOHO_API_TOKEN is not configured" };
  }
  const endpoint = process.env.ZOHO_ENDPOINT_URL ?? DEFAULT_ENDPOINT;

  const payload: Record<string, unknown> = {
    fname: input.firstName,
    lname: input.lastName,
    email: input.email,
    phone: input.phone,
    streetad: input.streetAddress,
    city: input.city || "HCM",
    state: input.state || "HCM",
    zipcode: input.zipCode || "900",
    country: input.country || "VN",
    amount: centsToDollars(input.amountCents),
    start_date: input.startDate,
    pay_date: input.payDate,
    line_item: input.lineItems,
    recurring_invoices_item: input.recurringInvoiceItems,
  };

  // Optional fields — only include when present (matches PHP reference)
  if (input.phoneCountry) payload.phone_country = input.phoneCountry;
  if (input.company) payload.company = input.company;
  if (input.timezone) payload.timezone = input.timezone;
  if (input.currency) payload.currency = input.currency;
  if (input.fulfillmentItems?.length) {
    payload.fulfillment = true;
    payload.fulfillment_items = input.fulfillmentItems;
  }
  if (input.shippingAddress) {
    payload.shipping_address = input.shippingAddress;
  }
  if (input.discountAmount && input.discountAmount > 0) {
    payload.discount = input.discountAmount;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `tvstartup-oauthtoken ${token}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    const text = await response.text();
    try {
      return { success: response.ok, payload, response: JSON.parse(text) };
    } catch {
      return { success: response.ok, payload, response: text };
    }
  } catch (err) {
    return {
      success: false,
      payload,
      error: `Zoho invoice POST failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
