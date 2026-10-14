"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { verifySession } from "@/lib/auth/dal";
import type { AddonFormState } from "./types";

const dollarsToCents = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

const addonSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().optional(),
  imageUrl: z.string().trim().optional(),
  priceCents: z.number().int().min(0, "Price must be 0 or more"),
  originalPriceCents: z.number().int().min(0).nullable(),
  zohoItemId: z.string().trim().optional(),
});

function parseAddonForm(formData: FormData) {
  const originalPriceRaw = formData.get("originalPrice")?.toString().trim();

  return addonSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    imageUrl: formData.get("imageUrl") ?? undefined,
    priceCents: dollarsToCents(formData.get("price")),
    originalPriceCents: originalPriceRaw ? dollarsToCents(originalPriceRaw) : null,
    zohoItemId: formData.get("zohoItemId") ?? undefined,
  });
}

export async function createAddon(_prevState: AddonFormState, formData: FormData): Promise<AddonFormState> {
  await verifySession();

  const parsed = parseAddonForm(formData);
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const addon = await prisma.addon.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      imageUrl: parsed.data.imageUrl || null,
      priceCents: parsed.data.priceCents,
      originalPriceCents: parsed.data.originalPriceCents,
      zohoItemId: parsed.data.zohoItemId || null,
    },
  });

  redirect(`/admin/addons/${addon.id}`);
}

export async function updateAddon(
  addonId: string,
  _prevState: AddonFormState,
  formData: FormData,
): Promise<AddonFormState> {
  await verifySession();

  const parsed = parseAddonForm(formData);
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await prisma.addon.update({
    where: { id: addonId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      imageUrl: parsed.data.imageUrl || null,
      priceCents: parsed.data.priceCents,
      originalPriceCents: parsed.data.originalPriceCents,
      zohoItemId: parsed.data.zohoItemId || null,
    },
  });

  return { status: "idle", message: "Saved." };
}

export async function toggleAddonActive(addonId: string): Promise<void> {
  await verifySession();
  const addon = await prisma.addon.findUnique({ where: { id: addonId }, select: { isActive: true } });
  if (!addon) return;
  await prisma.addon.update({ where: { id: addonId }, data: { isActive: !addon.isActive } });
}

export async function deleteAddon(addonId: string): Promise<void> {
  await verifySession();
  try {
    await prisma.addon.delete({ where: { id: addonId } });
  } catch {
    // Foreign key restrict: this addon has been used on at least one order
    // and can't be hard-deleted. Deactivating it is the intended path for
    // retiring an addon that already has history.
  }
}
