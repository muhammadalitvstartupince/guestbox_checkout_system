"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { chargeCreditCard } from "@/lib/payments/authorize-net";
import { encryptCardField, generateCardHashKey } from "@/lib/crypto/card-crypto";
import { detectCardBrand, getCardLast4 } from "@/lib/payments/card-brand";
import { logInvoiceEvent } from "@/lib/invoices/log-event";
import { postZohoInvoice } from "@/lib/zoho/post-invoice";
import { sendEmail } from "@/lib/email/send";
import { getEmailSettings } from "@/lib/email/settings";
import { sendOrderWebhook } from "@/lib/webhook/send";
import type { ZohoLineItem, ZohoRecurringLineItem } from "@/lib/zoho/post-invoice";

const addressSchema = z.object({
  addressLine1: z.string().min(1, "Address required"),
  city: z.string().min(1, "City required"),
  state: z.string().min(1, "State required"),
  zip: z.string().min(1, "ZIP required"),
  country: z.string().min(1, "Country required"),
});

const paymentSchema = z.object({
  cardNumber: z.string().min(13).max(19),
  expMonth: z.string().regex(/^\d{2}$/),
  expYear: z.string().regex(/^\d{4}$/),
  cvv: z.string().min(3).max(4),
});

export async function saveInvoiceAddress(
  token: string,
  _prev: { error?: string | null },
  formData: FormData,
): Promise<{ error?: string | null }> {
  const invoice = await prisma.invoice.findUnique({ where: { token } });
  if (!invoice) return { error: "Invoice not found." };
  if (invoice.status === "paid") return { error: "This invoice has already been paid." };
  if (invoice.status === "voided") return { error: "This invoice has been voided." };
  if (invoice.status === "expired" || (invoice.expiresAt && invoice.expiresAt < new Date())) {
    return { error: "This invoice has expired." };
  }

  const parsed = addressSchema.safeParse({
    addressLine1: formData.get("addressLine1"),
    city: formData.get("city"),
    state: formData.get("state"),
    zip: formData.get("zip"),
    country: formData.get("country"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const shippingSame = formData.get("shippingSameAsBilling") === "true";

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      addressLine1: parsed.data.addressLine1,
      city: parsed.data.city,
      state: parsed.data.state,
      zip: parsed.data.zip,
      country: parsed.data.country,
      shippingSameAsBilling: shippingSame,
      shippingAddressLine1: shippingSame ? null : (formData.get("shippingAddressLine1") as string || null),
      shippingCity: shippingSame ? null : (formData.get("shippingCity") as string || null),
      shippingState: shippingSame ? null : (formData.get("shippingState") as string || null),
      shippingZip: shippingSame ? null : (formData.get("shippingZip") as string || null),
      shippingCountry: shippingSame ? null : (formData.get("shippingCountry") as string || null),
    },
  });

  await logInvoiceEvent(invoice.id, "address_saved");
  return { error: null };
}

export async function payInvoice(
  token: string,
  _prev: { status: string; message?: string; redirectUrl?: string | null },
  formData: FormData,
): Promise<{ status: string; message?: string; redirectUrl?: string | null }> {
  const invoice = await prisma.invoice.findUnique({
    where: { token },
    include: {
      lineItems: {
        orderBy: { sortOrder: "asc" },
        include: {
          checkoutPage: {
            select: {
              zohoItemId: true,
              zohoRecurringItemId: true,
              priceTiers: { orderBy: { sortOrder: "asc" }, select: { minQty: true, maxQty: true, zohoItemId: true, isBase: true } },
              planTiers: { select: { name: true, zohoMonthlyItemId: true, zohoAnnualItemId: true } },
            },
          },
        },
      },
    },
  });
  if (!invoice) return { status: "error", message: "Invoice not found." };
  if (invoice.status === "paid") return { status: "error", message: "This invoice has already been paid." };
  if (invoice.status === "voided") return { status: "error", message: "This invoice has been voided." };
  if (invoice.status === "expired" || (invoice.expiresAt && invoice.expiresAt < new Date())) {
    return { status: "error", message: "This invoice has expired." };
  }
  if (!invoice.addressLine1 || !invoice.city || !invoice.state || !invoice.zip || !invoice.country) {
    return { status: "error", message: "Please complete your address first." };
  }

  const parsed = paymentSchema.safeParse({
    cardNumber: (formData.get("cardNumber") as string)?.replace(/\s/g, ""),
    expMonth: formData.get("expMonth"),
    expYear: formData.get("expYear"),
    cvv: formData.get("cvv"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Please check your card details." };
  }

  const data = parsed.data;

  await logInvoiceEvent(invoice.id, "payment_attempted", `Charging $${(invoice.totalCents / 100).toFixed(2)}`);

  let chargeResult;
  try {
    chargeResult = await chargeCreditCard({
      cardNumber: data.cardNumber,
      expirationDate: `${data.expYear}-${data.expMonth}`,
      cardCode: data.cvv,
      firstName: invoice.firstName,
      lastName: invoice.lastName,
      address: invoice.addressLine1,
      city: invoice.city,
      state: invoice.state,
      zip: invoice.zip,
      country: invoice.country,
      email: invoice.email,
      amountCents: invoice.totalCents,
      invoiceNumber: invoice.invoiceNumber,
    });
  } catch (err) {
    console.error("Authorize.net charge threw", err);
    await logInvoiceEvent(invoice.id, "payment_failed", "Authorize.net request failed");
    return { status: "error", message: "We couldn't process your payment. Please try again." };
  }

  await logInvoiceEvent(
    invoice.id,
    chargeResult.success ? "payment_succeeded" : "payment_failed",
    chargeResult.success ? chargeResult.description : chargeResult.errorMessage,
  );

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      cardLast4: getCardLast4(data.cardNumber),
      cardBrand: detectCardBrand(data.cardNumber),
      cardNumberEncrypted: encryptCardField(data.cardNumber),
      cardCvvEncrypted: encryptCardField(data.cvv),
      cardExpiryEncrypted: encryptCardField(`${data.expMonth}/${data.expYear}`),
      cardHashKey: generateCardHashKey(),
      authNetResponseCode: chargeResult.responseCode,
      authNetAuthCode: chargeResult.authCode,
      authNetTransactionId: chargeResult.transactionId,
      authNetMessage: chargeResult.success ? chargeResult.description : chargeResult.errorMessage,
      status: chargeResult.success ? "paid" : invoice.status,
      paidAt: chargeResult.success ? new Date() : null,
    },
  });

  if (!chargeResult.success) {
    return {
      status: "error",
      message: chargeResult.errorMessage ?? "Transaction declined. Please check your card details and try again.",
    };
  }

  // Post-payment side effects — each isolated so one failure doesn't block the rest

  // Zoho sync — match checkout payload structure
  // Resolve Zoho IDs: line item's own zohoItemId → fallback to checkout page's zohoItemId
  try {
    const zohoLineItems: ZohoLineItem[] = invoice.lineItems
      .map((li) => {
        // Priority: line item zohoItemId → matching price tier by qty → base tier → checkout page zohoItemId
        let itemId = li.zohoItemId;
        if (!itemId && li.checkoutPage) {
          const cp = li.checkoutPage;
          const qtyTier = cp.priceTiers.find((t) => li.quantity >= t.minQty && (t.maxQty == null || li.quantity <= t.maxQty));
          const baseTier = cp.priceTiers.find((t) => t.isBase);
          itemId = qtyTier?.zohoItemId || baseTier?.zohoItemId || cp.priceTiers[0]?.zohoItemId || cp.zohoItemId;
        }
        if (!itemId) return null;
        return { item_id: itemId, quantity: String(li.quantity), discount: "0", tax_id: "" };
      })
      .filter((li): li is ZohoLineItem => li !== null);

    const todayStr = new Date().toISOString().slice(0, 10);
    const nextMonthStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Shipping address — use separate billing address if different, else primary
    const shippingAddr = !invoice.shippingSameAsBilling && invoice.shippingAddressLine1
      ? { streetad: invoice.shippingAddressLine1, city: invoice.shippingCity || invoice.city!, state: invoice.shippingState || invoice.state!, zipcode: invoice.shippingZip || invoice.zip!, country: invoice.shippingCountry || invoice.country! }
      : { streetad: invoice.addressLine1!, city: invoice.city!, state: invoice.state!, zipcode: invoice.zip!, country: invoice.country! };

    // Discount in dollars
    const discountDollars = invoice.discountCents > 0 ? invoice.discountCents / 100 : undefined;

    // Recurring invoice items — resolve zohoRecurringItemId from checkout page or plan tier
    const recurringInvoiceItems: ZohoRecurringLineItem[] = [];
    if (invoice.selectedPlanName && invoice.selectedPlanPriceCents) {
      const cpLineItem = invoice.lineItems.find((li) => li.checkoutPage);
      const cp = cpLineItem?.checkoutPage;
      // Try plan tier zoho IDs first, then checkout page's zohoRecurringItemId, then device zohoItemId
      let recurringItemId: string | null = null;
      if (cp) {
        const matchedTier = cp.planTiers.find((t) => t.name === invoice.selectedPlanName);
        if (matchedTier) {
          recurringItemId = invoice.selectedPlanInterval === "annually"
            ? matchedTier.zohoAnnualItemId
            : matchedTier.zohoMonthlyItemId;
        }
        recurringItemId = recurringItemId || cp.zohoRecurringItemId || cp.zohoItemId;
      }
      // Fallback: first resolved zoho item ID from line items
      if (!recurringItemId && zohoLineItems.length > 0) {
        recurringItemId = zohoLineItems[0].item_id;
      }
      if (recurringItemId) {
        recurringInvoiceItems.push({
          item_id: recurringItemId,
          quantity: String(invoice.listingQty),
          discount: "0",
          tax_id: "",
          rate: (invoice.selectedPlanPriceCents / 100).toFixed(2),
        });
      }
    }

    const zohoResult = await postZohoInvoice({
      firstName: invoice.firstName,
      lastName: invoice.lastName,
      email: invoice.email,
      phone: invoice.phone ?? "",
      streetAddress: invoice.addressLine1!,
      city: invoice.city!,
      state: invoice.state!,
      zipCode: invoice.zip!,
      country: invoice.country!,
      amountCents: invoice.totalCents,
      startDate: invoice.selectedPlanInterval === "monthly" ? nextMonthStr : todayStr,
      payDate: todayStr,
      lineItems: zohoLineItems,
      recurringInvoiceItems,
      shippingAddress: shippingAddr,
      shippingCharge: invoice.shippingCents > 0 ? invoice.shippingCents / 100 : undefined,
      discountAmount: discountDollars,
      fulfillmentItems: zohoLineItems.length > 0 ? zohoLineItems : undefined,
      planType: invoice.selectedPlanName ?? undefined,
      billingCycle: invoice.selectedPlanInterval ?? undefined,
      billingQty: invoice.listingQty > 0 ? invoice.listingQty : undefined,
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        zohoSynced: zohoResult.success,
        zohoPayload: zohoResult.payload as object,
        zohoResponse: (zohoResult.response ?? { error: zohoResult.error }) as object,
      },
    });
    await logInvoiceEvent(invoice.id, zohoResult.success ? "zoho_synced" : "zoho_failed", zohoResult.success ? undefined : zohoResult.error);
  } catch (err) {
    console.error("Invoice Zoho sync failed", err);
    await logInvoiceEvent(invoice.id, "zoho_failed", `Exception: ${err instanceof Error ? err.message : String(err)}`).catch(() => {});
  }

  // Emails
  try {
    const settings = await getEmailSettings();
    const emailResult = await sendEmail({
      to: invoice.email,
      subject: `Payment Received — ${invoice.invoiceNumber}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2>Payment Confirmed</h2>
          <p>Hi ${invoice.firstName},</p>
          <p>Thank you for your payment of <strong>$${(invoice.totalCents / 100).toFixed(2)}</strong> for invoice <strong>${invoice.invoiceNumber}</strong>.</p>
          <p>Best regards,<br/>GuestBox</p>
        </div>
      `,
      apiKey: settings.sendgridApiKey,
      from: settings.emailFrom,
    });
    await logInvoiceEvent(invoice.id, emailResult.success ? "customer_email_sent" : "customer_email_failed", emailResult.error);

    if (settings.internalNotifyEmails.length > 0) {
      const intResult = await sendEmail({
        to: settings.internalNotifyEmails,
        subject: `Invoice ${invoice.invoiceNumber} paid — $${(invoice.totalCents / 100).toFixed(2)}`,
        html: `<p>Invoice <strong>${invoice.invoiceNumber}</strong> paid by <strong>${invoice.firstName} ${invoice.lastName}</strong> (${invoice.email}).</p><p>Amount: $${(invoice.totalCents / 100).toFixed(2)}</p>`,
        apiKey: settings.sendgridApiKey,
        from: settings.emailFrom,
      });
      await logInvoiceEvent(invoice.id, intResult.success ? "internal_email_sent" : "internal_email_failed", intResult.error);
    }
  } catch (err) {
    console.error("Invoice email failed", err);
  }

  // Marketing webhook — match checkout payload style
  if (invoice.webhookUrl) {
    try {
      const shippingWebhook = !invoice.shippingSameAsBilling && invoice.shippingAddressLine1
        ? { address: invoice.shippingAddressLine1, city: invoice.shippingCity || invoice.city, state: invoice.shippingState || invoice.state, zip: invoice.shippingZip || invoice.zip, country: invoice.shippingCountry || invoice.country }
        : { address: invoice.addressLine1, city: invoice.city, state: invoice.state, zip: invoice.zip, country: invoice.country };

      const webhookData: Record<string, unknown> = {
        type: "invoice_paid",
        invoiceNumber: invoice.invoiceNumber,
        fname: invoice.firstName,
        lname: invoice.lastName,
        email: invoice.email,
        phone: invoice.phone,
        streetad: invoice.addressLine1,
        city: invoice.city,
        state: invoice.state,
        zipcode: invoice.zip,
        country: invoice.country,
        shipping_address: shippingWebhook.address,
        shipping_city: shippingWebhook.city,
        shipping_state: shippingWebhook.state,
        shipping_zipcode: shippingWebhook.zip,
        shipping_country: shippingWebhook.country,
        amount: String(invoice.totalCents / 100),
        start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        pay_date: new Date().toISOString().slice(0, 10),
        invoice_Date: String(Math.floor(Date.now() / 1000)),
        autoaccountID: invoice.authNetTransactionId ?? "",
        billing: invoice.selectedPlanName ? `${invoice.selectedPlanName} (${invoice.selectedPlanInterval ?? "monthly"})` : "",
        qty: String(invoice.lineItems.reduce((s, li) => s + li.quantity, 0)),
        listing_qty: String(invoice.listingQty),
        rec_amount: invoice.selectedPlanPriceCents ? String((invoice.selectedPlanPriceCents * invoice.listingQty) / 100) : "0",
        shipping_amount: String(invoice.shippingCents / 100),
        shipping_carrier: invoice.shippingCarrier ?? "",
        shipping_service: invoice.shippingService ?? "",
        discount_amount: String(invoice.discountCents / 100),
        discount_label: invoice.discountLabel ?? "",
        line_items: invoice.lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unit_price: (li.unitPriceCents / 100).toFixed(2),
          total: (li.totalCents / 100).toFixed(2),
        })),
      };
      const webhookResult = await sendOrderWebhook(invoice.webhookUrl, webhookData);
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          webhookPayload: webhookData as object,
          webhookResponse: (webhookResult.responseBody ?? { error: webhookResult.error, statusCode: webhookResult.statusCode }) as object,
        },
      });
      await logInvoiceEvent(invoice.id, webhookResult.success ? "webhook_sent" : "webhook_failed", webhookResult.success ? undefined : webhookResult.error);
    } catch (err) {
      console.error("Invoice webhook failed", err);
      await logInvoiceEvent(invoice.id, "webhook_failed", `Exception: ${err instanceof Error ? err.message : String(err)}`).catch(() => {});
    }
  }

  const redirectUrl = invoice.successRedirectUrl
    ? `${invoice.successRedirectUrl}${invoice.successRedirectUrl.includes("?") ? "&" : "?"}invoice=${invoice.invoiceNumber}&amount=${(invoice.totalCents / 100).toFixed(2)}`
    : null;

  return { status: "success", redirectUrl };
}
