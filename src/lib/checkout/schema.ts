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

// Step 2 — billing address only. Submitting this updates the order created
// in step 1 with address fields; no charge happens yet.
export const billingInfoSchema = z.object({
  addressLine1: z.string().trim().min(1, "Street address is required"),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "State is required"),
  zip: z.string().trim().min(1, "Zip code is required"),
  country: z.string().trim().min(2, "Select a country"),
});

export type BillingInfoValues = z.infer<typeof billingInfoSchema>;

export function parseBillingInfoData(formData: FormData) {
  return billingInfoSchema.safeParse({
    addressLine1: formData.get("addressLine1"),
    city: formData.get("city"),
    state: formData.get("state"),
    zip: formData.get("zip"),
    country: formData.get("country"),
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

  quantity: z.coerce.number().int().min(1).max(10),
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
