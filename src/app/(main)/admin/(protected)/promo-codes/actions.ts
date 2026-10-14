"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { verifyAdminSession } from "@/lib/auth/dal";
import type { PromoCodeFormState } from "./types";

const promoCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Code must be at least 3 characters")
    .transform((v) => v.toUpperCase()),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.number().int().min(1, "Must be at least 1"),
  appliesToCheckoutPageId: z.string().optional(),
  maxRedemptions: z.number().int().min(1).nullable(),
  expiresAt: z.string().optional(),
});

export async function createPromoCode(
  _prevState: PromoCodeFormState,
  formData: FormData,
): Promise<PromoCodeFormState> {
  await verifyAdminSession();

  const discountType = formData.get("discountType")?.toString();
  const discountValueRaw = Number(formData.get("discountValue"));
  const discountValue =
    discountType === "fixed" ? Math.round(discountValueRaw * 100) : Math.round(discountValueRaw);

  const maxRedemptionsRaw = formData.get("maxRedemptions")?.toString().trim();
  const expiresAtRaw = formData.get("expiresAt")?.toString().trim();

  const parsed = promoCodeSchema.safeParse({
    code: formData.get("code"),
    discountType,
    discountValue,
    appliesToCheckoutPageId: formData.get("appliesToCheckoutPageId") || undefined,
    maxRedemptions: maxRedemptionsRaw ? Number(maxRedemptionsRaw) : null,
    expiresAt: expiresAtRaw || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const existing = await prisma.promoCode.findUnique({ where: { code: data.code } });
  if (existing) {
    return { status: "error", message: "That code already exists.", fieldErrors: { code: ["Already in use"] } };
  }

  await prisma.promoCode.create({
    data: {
      code: data.code,
      discountType: data.discountType,
      discountValue: data.discountValue,
      appliesToCheckoutPageId: data.appliesToCheckoutPageId || null,
      maxRedemptions: data.maxRedemptions,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      isActive: true,
    },
  });

  return { status: "idle", message: `Promo code ${data.code} created.` };
}

export async function togglePromoCode(promoCodeId: string): Promise<void> {
  await verifyAdminSession();
  const promo = await prisma.promoCode.findUnique({ where: { id: promoCodeId }, select: { isActive: true } });
  if (!promo) return;
  await prisma.promoCode.update({ where: { id: promoCodeId }, data: { isActive: !promo.isActive } });
}
