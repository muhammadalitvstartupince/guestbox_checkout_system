import { z } from "zod";
import { isValidLuhn } from "@/lib/payments/luhn";

// Step 1 — contact info only. Submitting this creates the order immediately
// (status "pending"), before any payment is attempted.
export const contactInfoSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().min(7, "Enter a valid phone number"),
});

export type ContactInfoValues = z.infer<typeof contactInfoSchema>;

export function parseContactInfoData(formData: FormData) {
  return contactInfoSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });
}

// Bare "PO Box" without a box number — catches "PO Box", "P.O. Box", etc.
// A full "PO Box 123" is fine; a bare "PO Box" is not shippable.
const BARE_PO_BOX_RE = /^\s*p[.\\/]?\s*o[.\\/]?\s*(box)?\s*$/i;

// Step 2 — address fields. The main form collects the shipping address (where
// the device ships). Billing is either the same or entered separately.
export const billingInfoSchema = z.object({
  addressLine1: z.string().trim().min(1, "Street address is required")
    .refine((v) => !BARE_PO_BOX_RE.test(v), "Please include a PO Box number (e.g. PO Box 123)"),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().default(""),
  zip: z.string().trim().min(1, "Zip code is required"),
  country: z.string().trim().min(2, "Select a country"),
  taxId: z.string().trim().optional().default(""),
}).superRefine((data, ctx) => {
  if (data.country === "US" && !data.state) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "State is required", path: ["state"] });
  }
  // US ZIP format: 5 digits or 5+4
  if (data.country === "US" && !/^\d{5}(-\d{4})?$/.test(data.zip)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid US ZIP code (e.g. 10001)", path: ["zip"] });
  }
  // Canada postal code format
  if (data.country === "CA" && !/^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(data.zip)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid Canadian postal code (e.g. K1A 0B1)", path: ["zip"] });
  }
  // Mexico tax ID required for customs
  if (data.country === "MX" && !data.taxId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Tax ID (RFC/CURP) is required for Mexico shipments", path: ["taxId"] });
  }
});

export type BillingInfoValues = z.infer<typeof billingInfoSchema>;

export function parseBillingInfoData(formData: FormData) {
  return billingInfoSchema.safeParse({
    addressLine1: formData.get("addressLine1"),
    city: formData.get("city"),
    state: formData.get("state"),
    zip: formData.get("zip"),
    country: formData.get("country"),
    taxId: formData.get("taxId") ?? "",
  });
}

// Step 3 — add-ons/upgrade, promo, and payment. Submitting this attempts the
// charge against the order's already-saved address from step 2.
export const paymentSchema = z.object({
  cardNumber: z
    .string()
    .trim()
    .regex(/^\d{13,19}$/, "Card number should be 13-19 digits")
    // Luhn checksum — catches an obviously-fabricated card number up front
    // so it never reaches Authorize.net; no need to attempt a real charge
    // just to find out the number itself is invalid.
    .refine(isValidLuhn, "Enter a valid card number"),
  expMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, "Invalid expiration month"),
  expYear: z.string().regex(/^\d{4}$/, "Invalid expiration year"),
  cvv: z.string().regex(/^\d{3,4}$/, "Invalid CVV"),

  quantity: z.coerce.number().int().min(1),
  promoCode: z.string().trim().optional().or(z.literal("")),
  addonIds: z.array(z.string().uuid()).default([]),
  upgradeSelected: z.boolean().default(false),

  agree: z.literal("on", { message: "You must agree to the Terms & Conditions" }),
});

export type PaymentValues = z.infer<typeof paymentSchema>;

export function parsePaymentData(formData: FormData) {
  return paymentSchema.safeParse({
    cardNumber: formData.get("cardNumber")?.toString().replace(/\s+/g, ""),
    expMonth: formData.get("expMonth"),
    expYear: formData.get("expYear"),
    cvv: formData.get("cvv"),
    quantity: formData.get("quantity"),
    promoCode: formData.get("promoCode") ?? undefined,
    addonIds: formData.getAll("addonIds"),
    upgradeSelected: formData.get("upgradeSelected") === "on",
    agree: formData.get("agree"),
  });
}
