"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { verifyAdminSession } from "@/lib/auth/dal";
import { revalidatePath } from "next/cache";
import type { PromotionFormState } from "./types";

const promotionSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  promoCodeId: z.string().uuid("Select a promo code"),
  priceTierId: z.string().uuid("Select a price tier"),
  checkoutPageIds: z.array(z.string().uuid()).min(1, "Select at least one checkout page"),
  timezone: z.string().min(1, "Select a timezone"),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

/** Convert a naive local datetime string + IANA timezone to a UTC Date. */
function localToUtc(naiveDatetime: string, timezone: string): Date {
  // Build an Intl formatter that renders in the target tz
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // Parse the naive string as if it were UTC, then figure out the offset
  const asUtc = new Date(`${naiveDatetime}:00Z`);
  const parts = Object.fromEntries(
    fmt.formatToParts(asUtc).map((p) => [p.type, p.value]),
  );
  const inTz = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`,
  );
  const offsetMs = inTz.getTime() - asUtc.getTime();

  // The admin typed the datetime meaning "in this timezone", so subtract the offset
  return new Date(asUtc.getTime() - offsetMs);
}

export async function createPromotion(
  _prevState: PromotionFormState,
  formData: FormData,
): Promise<PromotionFormState> {
  await verifyAdminSession();

  const checkoutPageIds = formData.getAll("checkoutPageIds").map(String);

  const parsed = promotionSchema.safeParse({
    name: formData.get("name"),
    promoCodeId: formData.get("promoCodeId"),
    priceTierId: formData.get("priceTierId"),
    checkoutPageIds,
    timezone: formData.get("timezone"),
    startsAt: formData.get("startsAt")?.toString().trim() || undefined,
    endsAt: formData.get("endsAt")?.toString().trim() || undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  await prisma.promotion.create({
    data: {
      name: data.name,
      promoCodeId: data.promoCodeId,
      priceTierId: data.priceTierId,
      timezone: data.timezone,
      startsAt: data.startsAt ? localToUtc(data.startsAt, data.timezone) : null,
      endsAt: data.endsAt ? localToUtc(data.endsAt, data.timezone) : null,
      isActive: false,
      checkoutPages: {
        create: data.checkoutPageIds.map((cpId) => ({ checkoutPageId: cpId })),
      },
    },
  });

  revalidatePath("/admin/promotions");
  return { status: "idle", message: `Promotion "${data.name}" created.` };
}

export async function updatePromotion(
  promotionId: string,
  _prevState: PromotionFormState,
  formData: FormData,
): Promise<PromotionFormState> {
  await verifyAdminSession();

  const checkoutPageIds = formData.getAll("checkoutPageIds").map(String);

  const parsed = promotionSchema.safeParse({
    name: formData.get("name"),
    promoCodeId: formData.get("promoCodeId"),
    priceTierId: formData.get("priceTierId"),
    checkoutPageIds,
    timezone: formData.get("timezone"),
    startsAt: formData.get("startsAt")?.toString().trim() || undefined,
    endsAt: formData.get("endsAt")?.toString().trim() || undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  await prisma.$transaction([
    // Remove old page links and re-create
    prisma.promotionCheckoutPage.deleteMany({ where: { promotionId } }),
    prisma.promotion.update({
      where: { id: promotionId },
      data: {
        name: data.name,
        promoCodeId: data.promoCodeId,
        priceTierId: data.priceTierId,
        timezone: data.timezone,
        startsAt: data.startsAt ? localToUtc(data.startsAt, data.timezone) : null,
        endsAt: data.endsAt ? localToUtc(data.endsAt, data.timezone) : null,
        checkoutPages: {
          create: data.checkoutPageIds.map((cpId) => ({ checkoutPageId: cpId })),
        },
      },
    }),
  ]);

  revalidatePath("/admin/promotions");
  return { status: "idle", message: `Promotion "${data.name}" updated.` };
}

export async function togglePromotion(promotionId: string): Promise<void> {
  await verifyAdminSession();
  const promo = await prisma.promotion.findUnique({
    where: { id: promotionId },
    select: { isActive: true },
  });
  if (!promo) return;
  await prisma.promotion.update({
    where: { id: promotionId },
    data: { isActive: !promo.isActive },
  });
  revalidatePath("/admin/promotions");
}
