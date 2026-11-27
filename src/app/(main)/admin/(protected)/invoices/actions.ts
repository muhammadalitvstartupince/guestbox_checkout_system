"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { verifyAdminSession } from "@/lib/auth/dal";
import { generateInvoiceNumber } from "@/lib/invoices/generate-number";
import { logInvoiceEvent } from "@/lib/invoices/log-event";
import { sendEmail } from "@/lib/email/send";
import { getEmailSettings } from "@/lib/email/settings";
import { postZohoInvoice } from "@/lib/zoho/post-invoice";
import type { ZohoLineItem, ZohoRecurringLineItem } from "@/lib/zoho/post-invoice";
import { getShippingRates } from "@/lib/shipping/get-rates";
import type { ShippingRate } from "@/lib/shipping/get-rates";
import type { InvoiceFormState } from "./types";

const lineItemSchema = z.object({
  description: z.string().min(1, "Description required"),
  quantity: z.coerce.number().int().min(1),
  unitPriceCents: z.coerce.number().int().min(0),
  checkoutPageId: z.string().optional().nullable(),
  zohoItemId: z.string().optional().nullable(),
});

const invoiceSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  taxId: z.string().nullish().transform((v) => v ?? ""),
  billingSameAsShipping: z.boolean(),
  billingAddressLine1: z.string().nullish().transform((v) => v ?? ""),
  billingCity: z.string().nullish().transform((v) => v ?? ""),
  billingState: z.string().nullish().transform((v) => v ?? ""),
  billingZip: z.string().nullish().transform((v) => v ?? ""),
  billingCountry: z.string().nullish().transform((v) => v ?? ""),
  discountCents: z.coerce.number().int().min(0).default(0),
  discountLabel: z.string().optional(),
  shippingCents: z.coerce.number().int().min(0).default(0),
  shippingCarrier: z.string().nullish(),
  shippingService: z.string().nullish(),
  shippingEstDays: z.coerce.number().int().optional(),
  listingQty: z.coerce.number().int().min(1).default(1),
  selectedPlanName: z.string().optional(),
  selectedPlanInterval: z.string().optional(),
  selectedPlanPriceCents: z.coerce.number().int().optional(),
  successRedirectUrl: z.string().optional(),
  webhookUrl: z.string().optional(),
  adminNotes: z.string().optional(),
  customerNotes: z.string().optional(),
  expiresAt: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item required"),
});

export async function createInvoice(
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const session = await verifyAdminSession();

  // Parse line items from form data
  const lineItemCount = parseInt(formData.get("lineItemCount") as string, 10) || 0;
  const lineItems: z.infer<typeof lineItemSchema>[] = [];
  for (let i = 0; i < lineItemCount; i++) {
    lineItems.push({
      description: formData.get(`lineItems.${i}.description`) as string ?? "",
      quantity: parseInt(formData.get(`lineItems.${i}.quantity`) as string, 10) || 1,
      unitPriceCents: Math.round(parseFloat(formData.get(`lineItems.${i}.unitPrice`) as string || "0") * 100),
      checkoutPageId: (formData.get(`lineItems.${i}.checkoutPageId`) as string) || null,
      zohoItemId: (formData.get(`lineItems.${i}.zohoItemId`) as string) || null,
    });
  }

  const parsed = invoiceSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    addressLine1: formData.get("addressLine1"),
    city: formData.get("city"),
    state: formData.get("state"),
    zip: formData.get("zip"),
    country: formData.get("country"),
    taxId: formData.get("taxId"),
    billingSameAsShipping: formData.get("billingSameAsShipping") === "true",
    billingAddressLine1: formData.get("billingAddressLine1"),
    billingCity: formData.get("billingCity"),
    billingState: formData.get("billingState"),
    billingZip: formData.get("billingZip"),
    billingCountry: formData.get("billingCountry"),
    discountCents: formData.get("discountCents"),
    discountLabel: formData.get("discountLabel"),
    shippingCents: formData.get("shippingCents"),
    shippingCarrier: formData.get("shippingCarrier"),
    shippingService: formData.get("shippingService"),
    shippingEstDays: formData.get("shippingEstDays"),
    listingQty: formData.get("listingQty"),
    selectedPlanName: formData.get("selectedPlanName"),
    selectedPlanInterval: formData.get("selectedPlanInterval"),
    selectedPlanPriceCents: formData.get("selectedPlanPriceCents"),
    successRedirectUrl: formData.get("successRedirectUrl"),
    webhookUrl: formData.get("webhookUrl"),
    adminNotes: formData.get("adminNotes"),
    customerNotes: formData.get("customerNotes"),
    expiresAt: formData.get("expiresAt"),
    lineItems,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".")] = issue.message;
    }
    // Preserve form values so inputs don't clear on error
    const values: Record<string, string> = {};
    for (const [key, val] of formData.entries()) {
      if (typeof val === "string") values[key] = val;
    }
    return { error: "Please fix the errors below.", fieldErrors, values };
  }

  const data = parsed.data;
  const subtotalCents = data.lineItems.reduce((sum, li) => sum + li.unitPriceCents * li.quantity, 0);
  const discountCents = Math.min(data.discountCents, subtotalCents);
  const shippingCents = data.shippingCents;
  const totalCents = subtotalCents - discountCents + shippingCents;

  const invoiceNumber = await generateInvoiceNumber();

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone || null,
      // Shipping = primary address
      addressLine1: data.addressLine1 || null,
      city: data.city || null,
      state: data.state || null,
      zip: data.zip || null,
      country: data.country || null,
      taxId: data.taxId || null,
      // Billing = same as shipping unless separate
      shippingSameAsBilling: data.billingSameAsShipping,
      shippingAddressLine1: data.billingSameAsShipping ? null : (data.billingAddressLine1 || null),
      shippingCity: data.billingSameAsShipping ? null : (data.billingCity || null),
      shippingState: data.billingSameAsShipping ? null : (data.billingState || null),
      shippingZip: data.billingSameAsShipping ? null : (data.billingZip || null),
      shippingCountry: data.billingSameAsShipping ? null : (data.billingCountry || null),
      subtotalCents,
      discountCents,
      discountLabel: discountCents > 0 ? (data.discountLabel || null) : null,
      shippingCents,
      shippingCarrier: data.shippingCarrier || null,
      shippingService: data.shippingService || null,
      shippingEstDays: data.shippingEstDays || null,
      listingQty: data.listingQty,
      selectedPlanName: data.selectedPlanName || null,
      selectedPlanInterval: data.selectedPlanInterval || null,
      selectedPlanPriceCents: data.selectedPlanPriceCents || null,
      totalCents,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      successRedirectUrl: data.successRedirectUrl || null,
      webhookUrl: data.webhookUrl || null,
      adminNotes: data.adminNotes || null,
      customerNotes: data.customerNotes || null,
      createdById: session.adminUserId as string,
      lineItems: {
        create: data.lineItems.map((li, i) => ({
          description: li.description,
          quantity: li.quantity,
          unitPriceCents: li.unitPriceCents,
          totalCents: li.unitPriceCents * li.quantity,
          checkoutPageId: li.checkoutPageId || null,
          zohoItemId: li.zohoItemId || null,
          sortOrder: i,
        })),
      },
    },
  });

  await logInvoiceEvent(invoice.id, "created", `Created by admin`);

  revalidatePath("/admin/invoices");
  return { error: null, invoiceId: invoice.id };
}

export async function updateInvoice(
  invoiceId: string,
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  await verifyAdminSession();

  const existing = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!existing || (existing.status !== "draft" && existing.status !== "sent")) {
    return { error: "Only draft or sent invoices can be edited." };
  }

  const lineItemCount = parseInt(formData.get("lineItemCount") as string, 10) || 0;
  const lineItems: z.infer<typeof lineItemSchema>[] = [];
  for (let i = 0; i < lineItemCount; i++) {
    lineItems.push({
      description: formData.get(`lineItems.${i}.description`) as string ?? "",
      quantity: parseInt(formData.get(`lineItems.${i}.quantity`) as string, 10) || 1,
      unitPriceCents: Math.round(parseFloat(formData.get(`lineItems.${i}.unitPrice`) as string || "0") * 100),
      checkoutPageId: (formData.get(`lineItems.${i}.checkoutPageId`) as string) || null,
      zohoItemId: (formData.get(`lineItems.${i}.zohoItemId`) as string) || null,
    });
  }

  const parsed = invoiceSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    addressLine1: formData.get("addressLine1"),
    city: formData.get("city"),
    state: formData.get("state"),
    zip: formData.get("zip"),
    country: formData.get("country"),
    taxId: formData.get("taxId"),
    billingSameAsShipping: formData.get("billingSameAsShipping") === "true",
    billingAddressLine1: formData.get("billingAddressLine1"),
    billingCity: formData.get("billingCity"),
    billingState: formData.get("billingState"),
    billingZip: formData.get("billingZip"),
    billingCountry: formData.get("billingCountry"),
    discountCents: formData.get("discountCents"),
    discountLabel: formData.get("discountLabel"),
    shippingCents: formData.get("shippingCents"),
    shippingCarrier: formData.get("shippingCarrier"),
    shippingService: formData.get("shippingService"),
    shippingEstDays: formData.get("shippingEstDays"),
    listingQty: formData.get("listingQty"),
    selectedPlanName: formData.get("selectedPlanName"),
    selectedPlanInterval: formData.get("selectedPlanInterval"),
    selectedPlanPriceCents: formData.get("selectedPlanPriceCents"),
    successRedirectUrl: formData.get("successRedirectUrl"),
    webhookUrl: formData.get("webhookUrl"),
    adminNotes: formData.get("adminNotes"),
    customerNotes: formData.get("customerNotes"),
    expiresAt: formData.get("expiresAt"),
    lineItems,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".")] = issue.message;
    }
    const values: Record<string, string> = {};
    for (const [key, val] of formData.entries()) {
      if (typeof val === "string") values[key] = val;
    }
    return { error: "Please fix the errors below.", fieldErrors, values };
  }

  const data = parsed.data;
  const subtotalCents = data.lineItems.reduce((sum, li) => sum + li.unitPriceCents * li.quantity, 0);
  const discountCents = Math.min(data.discountCents, subtotalCents);
  const shippingCents = data.shippingCents;
  const totalCents = subtotalCents - discountCents + shippingCents;

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone || null,
      addressLine1: data.addressLine1 || null,
      city: data.city || null,
      state: data.state || null,
      zip: data.zip || null,
      country: data.country || null,
      taxId: data.taxId || null,
      shippingSameAsBilling: data.billingSameAsShipping,
      shippingAddressLine1: data.billingSameAsShipping ? null : (data.billingAddressLine1 || null),
      shippingCity: data.billingSameAsShipping ? null : (data.billingCity || null),
      shippingState: data.billingSameAsShipping ? null : (data.billingState || null),
      shippingZip: data.billingSameAsShipping ? null : (data.billingZip || null),
      shippingCountry: data.billingSameAsShipping ? null : (data.billingCountry || null),
      subtotalCents,
      discountCents,
      discountLabel: discountCents > 0 ? (data.discountLabel || null) : null,
      shippingCents,
      shippingCarrier: data.shippingCarrier || null,
      shippingService: data.shippingService || null,
      shippingEstDays: data.shippingEstDays || null,
      listingQty: data.listingQty,
      selectedPlanName: data.selectedPlanName || null,
      selectedPlanInterval: data.selectedPlanInterval || null,
      selectedPlanPriceCents: data.selectedPlanPriceCents || null,
      totalCents,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      successRedirectUrl: data.successRedirectUrl || null,
      webhookUrl: data.webhookUrl || null,
      adminNotes: data.adminNotes || null,
      customerNotes: data.customerNotes || null,
      lineItems: {
        deleteMany: {},
        create: data.lineItems.map((li, i) => ({
          description: li.description,
          quantity: li.quantity,
          unitPriceCents: li.unitPriceCents,
          totalCents: li.unitPriceCents * li.quantity,
          checkoutPageId: li.checkoutPageId || null,
          zohoItemId: li.zohoItemId || null,
          sortOrder: i,
        })),
      },
    },
  });

  await logInvoiceEvent(invoiceId, "updated", "Updated by admin");

  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath("/admin/invoices");
  return { error: null, invoiceId };
}

export async function voidInvoice(invoiceId: string): Promise<void> {
  await verifyAdminSession();

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "voided" },
  });

  await logInvoiceEvent(invoiceId, "voided", "Voided by admin");
  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath("/admin/invoices");
}

export async function sendInvoiceEmail(invoiceId: string): Promise<void> {
  await verifyAdminSession();

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (!invoice) return;
  if (invoice.status !== "draft" && invoice.status !== "sent") return;

  const settings = await getEmailSettings();
  const paymentUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/c/invoice/${invoice.token}`;

  const f = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const tdR = 'style="padding:6px 8px;text-align:right"';
  const tdL = 'style="padding:6px 8px;text-align:left"';
  const tdC = 'style="padding:6px 8px;text-align:center"';

  const lineItemsHtml = invoice.lineItems
    .map((li) => `<tr><td ${tdL} style="padding:6px 8px;border-bottom:1px solid #eee">${li.description}</td><td ${tdC} style="padding:6px 8px;border-bottom:1px solid #eee">${li.quantity}</td><td ${tdR} style="padding:6px 8px;border-bottom:1px solid #eee">${f(li.totalCents)}</td></tr>`)
    .join("");

  // Build summary rows
  const summaryRows: string[] = [];
  summaryRows.push(`<tr><td colspan="2" ${tdR} style="padding:6px 8px;color:#666">Subtotal</td><td ${tdR} style="padding:6px 8px;color:#666">${f(invoice.subtotalCents)}</td></tr>`);
  if (invoice.discountCents > 0) {
    summaryRows.push(`<tr><td colspan="2" ${tdR} style="padding:6px 8px;color:#059669">Discount</td><td ${tdR} style="padding:6px 8px;color:#059669">−${f(invoice.discountCents)}</td></tr>`);
  }
  if (invoice.shippingCents > 0) {
    const shipLabel = invoice.shippingCarrier ? `Shipping (${invoice.shippingCarrier}${invoice.shippingEstDays ? ` ~${invoice.shippingEstDays} days` : ""})` : "Shipping";
    summaryRows.push(`<tr><td colspan="2" ${tdR} style="padding:6px 8px;color:#666">${shipLabel}</td><td ${tdR} style="padding:6px 8px;color:#666">+${f(invoice.shippingCents)}</td></tr>`);
  }
  summaryRows.push(`<tr><td colspan="2" style="padding:10px 8px;text-align:right;font-weight:bold;font-size:16px;border-top:2px solid #e5e7eb">Total Due</td><td style="padding:10px 8px;text-align:right;font-weight:bold;font-size:16px;border-top:2px solid #e5e7eb">${f(invoice.totalCents)}</td></tr>`);

  // Plan / recurring info
  let recurringHtml = "";
  if (invoice.selectedPlanName) {
    if (invoice.selectedPlanInterval === "monthly") {
      recurringHtml = `<div style="margin:16px 0;padding:12px 16px;background:#eff6ff;border-radius:8px;border-left:4px solid #3b82f6">
        <p style="margin:0;font-size:14px;color:#1d4ed8;font-weight:600">📋 Billing Plan: ${invoice.selectedPlanName} (Monthly)</p>
        <p style="margin:4px 0 0;font-size:13px;color:#1e40af">${f(invoice.selectedPlanPriceCents ?? 0)}/mo per listing — 1st month free, billing starts after first month.</p>
      </div>`;
    } else {
      recurringHtml = `<div style="margin:16px 0;padding:12px 16px;background:#f5f3ff;border-radius:8px;border-left:4px solid #7c3aed">
        <p style="margin:0;font-size:14px;color:#6d28d9;font-weight:600">📋 Billing Plan: ${invoice.selectedPlanName} (Annual)</p>
        <p style="margin:4px 0 0;font-size:13px;color:#5b21b6">${f(invoice.selectedPlanPriceCents ?? 0)}/yr per listing — included in invoice total.</p>
      </div>`;
    }
  }

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
      <div style="padding:24px 0;border-bottom:1px solid #e5e7eb">
        <h2 style="margin:0;font-size:24px;color:#111827">Invoice ${invoice.invoiceNumber}</h2>
      </div>
      <p style="margin:16px 0;font-size:15px">Hi ${invoice.firstName},</p>
      ${invoice.customerNotes ? `<p style="margin:0 0 16px;padding:12px 16px;background:#f9fafb;border-radius:8px;font-size:14px;color:#4b5563">${invoice.customerNotes}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead><tr style="background:#f9fafb"><th style="padding:10px 8px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280;letter-spacing:0.05em">Item</th><th style="padding:10px 8px;text-align:center;font-size:12px;text-transform:uppercase;color:#6b7280;letter-spacing:0.05em">Qty</th><th style="padding:10px 8px;text-align:right;font-size:12px;text-transform:uppercase;color:#6b7280;letter-spacing:0.05em">Amount</th></tr></thead>
        <tbody>${lineItemsHtml}</tbody>
        <tfoot>${summaryRows.join("")}</tfoot>
      </table>
      ${recurringHtml}
      ${invoice.expiresAt ? `<p style="margin:16px 0;color:#9ca3af;font-size:13px">⏰ This invoice expires on ${invoice.expiresAt.toISOString().slice(0, 10)}.</p>` : ""}
      <div style="margin:24px 0;text-align:center">
        <a href="${paymentUrl}" style="display:inline-block;padding:14px 32px;background:#4f46e5;color:white;text-decoration:none;border-radius:10px;font-weight:700;font-size:16px">Pay Now — ${f(invoice.totalCents)}</a>
      </div>
      <p style="color:#9ca3af;font-size:12px;text-align:center">Or copy this link: <a href="${paymentUrl}" style="color:#6366f1">${paymentUrl}</a></p>
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center">
        <p style="margin:0;font-size:12px;color:#9ca3af">GuestBox</p>
      </div>
    </div>
  `;

  const result = await sendEmail({
    to: invoice.email,
    subject: `Invoice ${invoice.invoiceNumber} from GuestBox — $${(invoice.totalCents / 100).toFixed(2)}`,
    html,
    apiKey: settings.sendgridApiKey,
    from: settings.emailFrom,
  });

  if (result.success) {
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "sent" } });
    await logInvoiceEvent(invoiceId, "sent", "Invoice email sent");
  } else {
    await logInvoiceEvent(invoiceId, "customer_email_failed", result.error);
  }

  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath("/admin/invoices");
}

export async function retryInvoiceZohoSync(invoiceId: string): Promise<void> {
  await verifyAdminSession();

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
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
  if (!invoice || invoice.status !== "paid") return;
  if (!invoice.addressLine1 || !invoice.city || !invoice.state || !invoice.zip || !invoice.country) return;

  const lineItems: ZohoLineItem[] = invoice.lineItems
    .map((li) => {
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

  const payDate = (invoice.paidAt ?? invoice.createdAt).toISOString().slice(0, 10);
  const nextMonthStr = new Date((invoice.paidAt ?? invoice.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const shippingAddr = !invoice.shippingSameAsBilling && invoice.shippingAddressLine1
    ? { streetad: invoice.shippingAddressLine1, city: invoice.shippingCity || invoice.city!, state: invoice.shippingState || invoice.state!, zipcode: invoice.shippingZip || invoice.zip!, country: invoice.shippingCountry || invoice.country! }
    : { streetad: invoice.addressLine1!, city: invoice.city!, state: invoice.state!, zipcode: invoice.zip!, country: invoice.country! };

  const recurringInvoiceItems: ZohoRecurringLineItem[] = [];
  if (invoice.selectedPlanName && invoice.selectedPlanPriceCents) {
    const cpLineItem = invoice.lineItems.find((li) => li.checkoutPage);
    const cp = cpLineItem?.checkoutPage;
    let recurringItemId: string | null = null;
    if (cp) {
      const matchedTier = cp.planTiers.find((t) => t.name === invoice.selectedPlanName);
      if (matchedTier) {
        recurringItemId = invoice.selectedPlanInterval === "annually" ? matchedTier.zohoAnnualItemId : matchedTier.zohoMonthlyItemId;
      }
      recurringItemId = recurringItemId || cp.zohoRecurringItemId || cp.zohoItemId;
    }
    if (!recurringItemId && lineItems.length > 0) {
      recurringItemId = lineItems[0].item_id;
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

  const result = await postZohoInvoice({
    firstName: invoice.firstName,
    lastName: invoice.lastName,
    email: invoice.email,
    phone: invoice.phone ?? "",
    streetAddress: invoice.addressLine1,
    city: invoice.city,
    state: invoice.state,
    zipCode: invoice.zip,
    country: invoice.country,
    amountCents: invoice.totalCents,
    startDate: invoice.selectedPlanInterval === "monthly" ? nextMonthStr : payDate,
    payDate,
    lineItems,
    recurringInvoiceItems,
    shippingAddress: shippingAddr,
    shippingCharge: invoice.shippingCents > 0 ? invoice.shippingCents / 100 : undefined,
    discountAmount: invoice.discountCents > 0 ? invoice.discountCents / 100 : undefined,
    fulfillmentItems: lineItems.length > 0 ? lineItems : undefined,
    planType: invoice.selectedPlanName ?? undefined,
    billingCycle: invoice.selectedPlanInterval ?? undefined,
    billingQty: invoice.listingQty > 0 ? invoice.listingQty : undefined,
  });

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      zohoSynced: result.success,
      zohoPayload: result.payload as object,
      zohoResponse: (result.response ?? { error: result.error }) as object,
    },
  });

  await logInvoiceEvent(invoiceId, result.success ? "zoho_synced" : "zoho_failed", result.success ? "Manual retry" : result.error);
  revalidatePath(`/admin/invoices/${invoiceId}`);
}

export async function fetchShippingRates(address: {
  street1: string; city: string; state: string; zip: string; country: string;
}, quantity: number): Promise<{ rates: ShippingRate[]; error?: string }> {
  await verifyAdminSession();
  if (!address.street1 || !address.city || !address.zip || !address.country) {
    return { rates: [], error: "Fill in the billing address first." };
  }
  const result = await getShippingRates(address, quantity);
  return { rates: result.rates, error: result.error };
}
