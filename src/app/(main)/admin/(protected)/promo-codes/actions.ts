"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { verifyAdminSession } from "@/lib/auth/dal";
import type { PromoCodeFormState } from "./types";

const discountTypeEnum = z.enum(["percent", "fixed"]);
const appliesToEnum = z.enum(["device", "monthly", "annual", "device_monthly", "device_annual", "monthly_annual", "all"]);

const baseFields = z.object({
  code: z.string().trim().min(3, "Code must be at least 3 characters").transform((v) => v.toUpperCase()),
  discountMode: z.enum(["single", "split"]).default("single"),
  appliesToCheckoutPageId: z.string().optional(),
  maxRedemptions: z.number().int().min(1).nullable(),
  expiresAt: z.string().optional(),
});

const singleFields = z.object({
  discountType: discountTypeEnum,
  discountValue: z.number().int().min(1, "Must be at least 1"),
  appliesTo: appliesToEnum.default("device"),
});

const optionalSlot = z.object({
  type: discountTypeEnum,
  value: z.number().int().min(1, "Must be at least 1"),
}).nullable();

const splitFields = z.object({
  deviceSlot: optionalSlot,
  monthlySlot: optionalSlot,
  annualSlot: optionalSlot,
});

function parseSlotFromForm(formData: FormData, prefix: string): { type: "percent" | "fixed"; value: number } | null {
  const type = formData.get(`${prefix}DiscountType`)?.toString();
  const rawValue = formData.get(`${prefix}DiscountValue`)?.toString()?.trim();
  if (!type || !rawValue) return null;
  const numVal = Number(rawValue);
  if (isNaN(numVal) || numVal <= 0) return null;
  return { type: type as "percent" | "fixed", value: type === "fixed" ? Math.round(numVal * 100) : Math.round(numVal) };
}

export async function createPromoCode(
  _prevState: PromoCodeFormState,
  formData: FormData,
): Promise<PromoCodeFormState> {
  await verifyAdminSession();

  const discountMode = formData.get("discountMode")?.toString() || "single";
  const perDevice = formData.get("perDevice") === "true";

  const baseParsed = baseFields.safeParse({
    code: formData.get("code"),
    discountMode,
    appliesToCheckoutPageId: formData.get("appliesToCheckoutPageId") || undefined,
    maxRedemptions: (() => { const v = formData.get("maxRedemptions")?.toString().trim(); return v ? Number(v) : null; })(),
    expiresAt: formData.get("expiresAt")?.toString().trim() || undefined,
  });

  if (!baseParsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: baseParsed.error.flatten().fieldErrors };
  }
  const base = baseParsed.data;

  const existing = await prisma.promoCode.findUnique({ where: { code: base.code } });
  if (existing) {
    return { status: "error", message: "That code already exists.", fieldErrors: { code: ["Already in use"] } };
  }

  if (base.discountMode === "split") {
    const deviceSlot = parseSlotFromForm(formData, "device");
    const monthlySlot = parseSlotFromForm(formData, "monthly");
    const annualSlot = parseSlotFromForm(formData, "annual");

    const splitParsed = splitFields.safeParse({ deviceSlot, monthlySlot, annualSlot });
    if (!splitParsed.success) {
      return { status: "error", message: "Please fix the split discount fields.", fieldErrors: splitParsed.error.flatten().fieldErrors };
    }

    if (!deviceSlot && !monthlySlot && !annualSlot) {
      return { status: "error", message: "At least one discount slot (device, monthly, or annual) is required." };
    }

    await prisma.promoCode.create({
      data: {
        code: base.code,
        discountMode: "split",
        discountType: "fixed", // placeholder for required column
        discountValue: 0,
        appliesTo: "device",
        perDevice,
        deviceDiscountType: deviceSlot?.type ?? null,
        deviceDiscountValue: deviceSlot?.value ?? null,
        monthlyDiscountType: monthlySlot?.type ?? null,
        monthlyDiscountValue: monthlySlot?.value ?? null,
        annualDiscountType: annualSlot?.type ?? null,
        annualDiscountValue: annualSlot?.value ?? null,
        appliesToCheckoutPageId: base.appliesToCheckoutPageId || null,
        maxRedemptions: base.maxRedemptions,
        expiresAt: base.expiresAt ? new Date(base.expiresAt) : null,
        isActive: true,
      },
    });

    return { status: "idle", message: `Split promo code ${base.code} created.` };
  }

  // --- Single mode (existing behavior) ---
  const discountType = formData.get("discountType")?.toString();
  const discountValueRaw = Number(formData.get("discountValue"));
  const discountValue = discountType === "fixed" ? Math.round(discountValueRaw * 100) : Math.round(discountValueRaw);

  const singleParsed = singleFields.safeParse({
    discountType,
    discountValue,
    appliesTo: formData.get("appliesTo") || "device",
  });

  if (!singleParsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: singleParsed.error.flatten().fieldErrors };
  }
  const single = singleParsed.data;

  await prisma.promoCode.create({
    data: {
      code: base.code,
      discountMode: "single",
      discountType: single.discountType,
      discountValue: single.discountValue,
      appliesTo: single.appliesTo,
      perDevice,
      appliesToCheckoutPageId: base.appliesToCheckoutPageId || null,
      maxRedemptions: base.maxRedemptions,
      expiresAt: base.expiresAt ? new Date(base.expiresAt) : null,
      isActive: true,
    },
  });

  return { status: "idle", message: `Promo code ${base.code} created.` };
}

export async function togglePromoCode(promoCodeId: string): Promise<void> {
  await verifyAdminSession();
  const promo = await prisma.promoCode.findUnique({ where: { id: promoCodeId }, select: { isActive: true } });
  if (!promo) return;
  await prisma.promoCode.update({ where: { id: promoCodeId }, data: { isActive: !promo.isActive } });
}
