"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { verifyAdminSession } from "@/lib/auth/dal";
import type { ShippingSettingsFormState } from "./types";

const warehouseSchema = z.object({
  warehouseName: z.string().trim().min(1, "Required"),
  warehouseStreet: z.string().trim().min(1, "Required"),
  warehouseCity: z.string().trim().min(1, "Required"),
  warehouseState: z.string().trim().min(1, "Required"),
  warehouseZip: z.string().trim().min(1, "Required"),
  warehouseCountry: z.string().trim().min(2, "Required").max(2),
  warehousePhone: z.string().trim().min(1, "Required"),
  maxDevicesPerBox: z.coerce.number().int().min(1).max(100),
});

export async function toggleShippingEnabled(enabled: boolean): Promise<void> {
  await verifyAdminSession();
  const existing = await prisma.shippingSettings.findFirst();
  if (existing) {
    await prisma.shippingSettings.update({ where: { id: existing.id }, data: { enabled } });
  } else {
    await prisma.shippingSettings.create({
      data: {
        enabled,
        warehouseName: "",
        warehouseStreet: "",
        warehouseCity: "",
        warehouseState: "",
        warehouseZip: "",
        warehouseCountry: "US",
        warehousePhone: "",
      },
    });
  }
  revalidatePath("/admin/settings/shipping");
}

export async function updateShippingSettings(
  _prevState: ShippingSettingsFormState,
  formData: FormData,
): Promise<ShippingSettingsFormState> {
  await verifyAdminSession();

  const parsed = warehouseSchema.safeParse({
    warehouseName: formData.get("warehouseName"),
    warehouseStreet: formData.get("warehouseStreet"),
    warehouseCity: formData.get("warehouseCity"),
    warehouseState: formData.get("warehouseState"),
    warehouseZip: formData.get("warehouseZip"),
    warehouseCountry: formData.get("warehouseCountry"),
    warehousePhone: formData.get("warehousePhone"),
    maxDevicesPerBox: formData.get("maxDevicesPerBox"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const existing = await prisma.shippingSettings.findFirst();
  await prisma.shippingSettings.upsert({
    where: { id: existing?.id ?? "00000000-0000-0000-0000-000000000000" },
    update: parsed.data,
    create: parsed.data,
  });

  revalidatePath("/admin/settings/shipping");
  return { status: "idle", message: "Shipping settings saved." };
}

export async function updatePackageTiers(
  _prevState: ShippingSettingsFormState,
  formData: FormData,
): Promise<ShippingSettingsFormState> {
  await verifyAdminSession();

  const settings = await prisma.shippingSettings.findFirst();
  if (!settings) {
    return { status: "error", message: "Save warehouse settings first." };
  }

  const count = Number(formData.get("tierCount") || 0);
  const tiers: Array<{ minQty: number; maxQty: number; label: string; lengthIn: number; widthIn: number; heightIn: number; maxWeightLb: number }> = [];

  for (let i = 0; i < count; i++) {
    const minQty = Number(formData.get(`tier_${i}_minQty`));
    const maxQty = Number(formData.get(`tier_${i}_maxQty`));
    const label = formData.get(`tier_${i}_label`)?.toString().trim() || "";
    const lengthIn = Number(formData.get(`tier_${i}_length`));
    const widthIn = Number(formData.get(`tier_${i}_width`));
    const heightIn = Number(formData.get(`tier_${i}_height`));
    const maxWeightLb = Number(formData.get(`tier_${i}_maxWeight`));

    if (!label || isNaN(minQty) || isNaN(maxQty) || isNaN(lengthIn) || isNaN(widthIn) || isNaN(heightIn) || isNaN(maxWeightLb)) {
      return { status: "error", message: `Row ${i + 1}: all fields are required.` };
    }
    tiers.push({ minQty, maxQty, label, lengthIn, widthIn, heightIn, maxWeightLb });
  }

  // Replace all tiers
  await prisma.shippingPackageTier.deleteMany({ where: { shippingSettingsId: settings.id } });
  await prisma.shippingPackageTier.createMany({
    data: tiers.map((t, i) => ({ shippingSettingsId: settings.id, ...t, sortOrder: i })),
  });

  revalidatePath("/admin/settings/shipping");
  return { status: "idle", message: `Saved ${tiers.length} package tier${tiers.length === 1 ? "" : "s"}.` };
}

export async function updateWeightTable(
  _prevState: ShippingSettingsFormState,
  formData: FormData,
): Promise<ShippingSettingsFormState> {
  await verifyAdminSession();

  const settings = await prisma.shippingSettings.findFirst();
  if (!settings) {
    return { status: "error", message: "Save warehouse settings first." };
  }

  const count = Number(formData.get("weightCount") || 0);
  const entries: Array<{ qty: number; weightLb: number }> = [];

  for (let i = 0; i < count; i++) {
    const qty = Number(formData.get(`weight_${i}_qty`));
    const weightLb = Number(formData.get(`weight_${i}_weight`));
    if (isNaN(qty) || isNaN(weightLb) || qty < 1 || weightLb <= 0) {
      return { status: "error", message: `Row ${i + 1}: invalid quantity or weight.` };
    }
    entries.push({ qty, weightLb });
  }

  await prisma.shippingWeightEntry.deleteMany({ where: { shippingSettingsId: settings.id } });
  await prisma.shippingWeightEntry.createMany({
    data: entries.map((e) => ({ shippingSettingsId: settings.id, ...e })),
  });

  revalidatePath("/admin/settings/shipping");
  return { status: "idle", message: `Saved ${entries.length} weight entr${entries.length === 1 ? "y" : "ies"}.` };
}
