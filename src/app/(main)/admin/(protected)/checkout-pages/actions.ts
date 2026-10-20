"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { verifySession } from "@/lib/auth/dal";
import type { CheckoutPageFormState } from "./types";
import { logCheckoutPageEvent } from "@/lib/checkout-pages/log-event";

const dollarsToCents = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

interface RawPriceTier {
  minQty: string;
  maxQty: string;
  priceCents: string;
  zohoItemId: string;
  isBase: boolean;
}

interface RawBillingPlan {
  interval: "monthly" | "annually";
  label: string;
  priceCents: string;
  zohoItemId: string;
  chargeAtCheckout: boolean;
  isDefault: boolean;
}

function parseTiersAndPlans(formData: FormData) {
  let priceTiers: { minQty: number; maxQty: number | null; priceCents: number; zohoItemId: string | null; isBase: boolean }[] = [];
  let billingPlans: { interval: "monthly" | "annually"; label: string; priceCents: number; zohoItemId: string | null; chargeAtCheckout: boolean; isDefault: boolean }[] = [];

  try {
    const tiersJson = formData.get("priceTiersJson")?.toString();
    if (tiersJson) {
      const raw: RawPriceTier[] = JSON.parse(tiersJson);
      priceTiers = raw
        .filter((t) => t.minQty && t.priceCents)
        .map((t) => ({
          minQty: parseInt(t.minQty, 10),
          maxQty: t.maxQty ? parseInt(t.maxQty, 10) : null,
          priceCents: dollarsToCents(t.priceCents),
          zohoItemId: t.zohoItemId || null,
          isBase: !!t.isBase,
        }));
      // Enforce exactly one base tier
      if (priceTiers.length > 0 && !priceTiers.some((t) => t.isBase)) {
        priceTiers[0].isBase = true;
      }
    }
  } catch { /* ignore malformed JSON */ }

  try {
    const plansJson = formData.get("billingPlansJson")?.toString();
    if (plansJson) {
      const raw: RawBillingPlan[] = JSON.parse(plansJson);
      billingPlans = raw
        .filter((p) => p.label && p.priceCents)
        .map((p) => ({
          interval: p.interval,
          label: p.label,
          priceCents: dollarsToCents(p.priceCents),
          zohoItemId: p.zohoItemId || null,
          chargeAtCheckout: p.chargeAtCheckout ?? false,
          isDefault: p.isDefault,
        }));
    }
  } catch { /* ignore malformed JSON */ }

  return { priceTiers, billingPlans };
}

const checkoutPageSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  type: z.enum(["normal", "sales"]),
  title: z.string().trim().min(1, "Title is required"),
  productName: z.string().trim().optional(),
  heroHtml: z.string().trim().optional(),
  heroHtmlMobile: z.string().trim().optional(),
  mockupImageUrl: z.string().trim().optional(),
  skinId: z.string().uuid("Select a skin"),
  zohoItemId: z.string().trim().optional(),
  zohoRecurringItemId: z.string().trim().optional(),
  basePriceCents: z.number().int().min(0, "Base price must be 0 or more"),
  recurringPriceCents: z.number().int().min(0).nullable(),
  billingInterval: z.enum(["monthly", "annually", "none"]),
  showPromoCode: z.boolean(),
  successRedirectUrl: z.url("Enter a valid URL").or(z.literal("")),
  failRedirectUrl: z.url("Enter a valid URL").or(z.literal("")),
  webhookUrl: z.string().trim().optional(),
  status: z.enum(["draft", "live", "archived"]),
  upgradeTitle: z.string().trim().optional(),
  upgradeDescription: z.string().trim().optional(),
  upgradePriceCents: z.number().int().min(0).nullable(),
  upgradeRecurringPriceCents: z.number().int().min(0).nullable(),
  upgradeZohoItemId: z.string().trim().optional(),
  upgradeZohoRecurringItemId: z.string().trim().optional(),
});

function parseCheckoutPageForm(formData: FormData) {
  const recurringPriceRaw = formData.get("recurringPrice")?.toString().trim();
  const upgradePriceRaw = formData.get("upgradePrice")?.toString().trim();
  const upgradeRecurringPriceRaw = formData.get("upgradeRecurringPrice")?.toString().trim();

  return checkoutPageSchema.safeParse({
    slug: formData.get("slug"),
    type: formData.get("type"),
    title: formData.get("title"),
    productName: formData.get("productName") ?? undefined,
    heroHtml: formData.get("heroHtml") ?? undefined,
    heroHtmlMobile: formData.get("heroHtmlMobile") ?? undefined,
    mockupImageUrl: formData.get("mockupImageUrl") ?? undefined,
    skinId: formData.get("skinId"),
    zohoItemId: formData.get("zohoItemId") ?? undefined,
    zohoRecurringItemId: formData.get("zohoRecurringItemId") ?? undefined,
    basePriceCents: dollarsToCents(formData.get("basePrice")),
    recurringPriceCents: recurringPriceRaw ? dollarsToCents(recurringPriceRaw) : null,
    billingInterval: formData.get("billingInterval"),
    showPromoCode: formData.get("showPromoCode") === "on",
    successRedirectUrl: formData.get("successRedirectUrl"),
    failRedirectUrl: formData.get("failRedirectUrl"),
    webhookUrl: formData.get("webhookUrl") ?? undefined,
    status: formData.get("status"),
    upgradeTitle: formData.get("upgradeTitle") ?? undefined,
    upgradeDescription: formData.get("upgradeDescription") ?? undefined,
    upgradePriceCents: upgradePriceRaw ? dollarsToCents(upgradePriceRaw) : null,
    upgradeRecurringPriceCents: upgradeRecurringPriceRaw ? dollarsToCents(upgradeRecurringPriceRaw) : null,
    upgradeZohoItemId: formData.get("upgradeZohoItemId") ?? undefined,
    upgradeZohoRecurringItemId: formData.get("upgradeZohoRecurringItemId") ?? undefined,
  });
}

/** An upgrade offer needs both a title and a price to be meaningful — treat
 *  a half-filled-out upgrade as "no upgrade" rather than persisting a
 *  broken one. */
function validateUpgradeFields(data: {
  upgradeTitle?: string;
  upgradePriceCents: number | null;
}): { fieldErrors: Record<string, string[]> } | null {
  const hasTitle = !!data.upgradeTitle;
  const hasPrice = data.upgradePriceCents != null;
  if (hasTitle !== hasPrice) {
    return {
      fieldErrors: {
        upgradeTitle: hasTitle ? [] : ["Required if an upgrade price is set"],
        upgradePrice: hasPrice ? [] : ["Required if an upgrade title is set"],
      },
    };
  }
  return null;
}

export async function createCheckoutPage(
  _prevState: CheckoutPageFormState,
  formData: FormData,
): Promise<CheckoutPageFormState> {
  await verifySession();

  const parsed = parseCheckoutPageForm(formData);
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const upgradeError = validateUpgradeFields(data);
  if (upgradeError) {
    return { status: "error", message: "An upgrade offer needs both a title and a price.", fieldErrors: upgradeError.fieldErrors };
  }

  const existing = await prisma.checkoutPage.findUnique({ where: { slug: data.slug } });
  if (existing) {
    return { status: "error", message: "That slug is already in use.", fieldErrors: { slug: ["Already in use"] } };
  }

  const session = await verifySession();
  const admin = await prisma.adminUser.findUnique({ where: { id: session.adminUserId as string } });
  if (!admin) {
    return { status: "error", message: "Your session is stale — please log out and log back in." };
  }

  const selectedAddonIds = formData.getAll("addonIds").map((v) => v.toString());
  const { priceTiers, billingPlans } = parseTiersAndPlans(formData);

  const page = await prisma.checkoutPage.create({
    data: {
      slug: data.slug,
      type: data.type,
      title: data.title,
      productName: data.productName || null,
      heroHtml: data.heroHtml || null,
      heroHtmlMobile: data.heroHtmlMobile || null,
      mockupImageUrl: data.mockupImageUrl || null,
      skinId: data.skinId,
      zohoItemId: data.zohoItemId || null,
      zohoRecurringItemId: data.zohoRecurringItemId || null,
      basePriceCents: data.basePriceCents,
      recurringPriceCents: data.recurringPriceCents,
      billingInterval: data.billingInterval,
      showPromoCode: data.showPromoCode,
      successRedirectUrl: data.successRedirectUrl,
      failRedirectUrl: data.failRedirectUrl,
      webhookUrl: data.webhookUrl || null,
      status: data.status,
      upgradeTitle: data.upgradeTitle || null,
      upgradeDescription: data.upgradeDescription || null,
      upgradePriceCents: data.upgradePriceCents,
      upgradeRecurringPriceCents: data.upgradeRecurringPriceCents,
      upgradeZohoItemId: data.upgradeZohoItemId || null,
      upgradeZohoRecurringItemId: data.upgradeZohoRecurringItemId || null,
      createdById: session.adminUserId as string,
      addonLinks: {
        create: selectedAddonIds.map((addonId, index) => ({ addonId, sortOrder: index })),
      },
      priceTiers: {
        create: priceTiers.map((t, i) => ({ ...t, sortOrder: i })),
      },
      billingPlans: {
        create: billingPlans.map((p, i) => ({ ...p, sortOrder: i })),
      },
    },
  });

  await logCheckoutPageEvent(page.id, session.adminUserId as string, "created", `Created "${data.title}" (/c/${data.slug})`);

  redirect(`/admin/checkout-pages/${page.id}`);
}

export async function updateCheckoutPage(
  checkoutPageId: string,
  _prevState: CheckoutPageFormState,
  formData: FormData,
): Promise<CheckoutPageFormState> {
  const session = await verifySession();

  const parsed = parseCheckoutPageForm(formData);
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const upgradeError = validateUpgradeFields(data);
  if (upgradeError) {
    return { status: "error", message: "An upgrade offer needs both a title and a price.", fieldErrors: upgradeError.fieldErrors };
  }

  const existing = await prisma.checkoutPage.findUnique({ where: { slug: data.slug } });
  if (existing && existing.id !== checkoutPageId) {
    return { status: "error", message: "That slug is already in use.", fieldErrors: { slug: ["Already in use"] } };
  }

  const { priceTiers, billingPlans } = parseTiersAndPlans(formData);

  // Find tiers that have promotions linked — these can't be deleted (FK constraint).
  // Match them to incoming tiers by sortOrder position and update in place.
  const tiersWithPromotions = await prisma.priceTier.findMany({
    where: { checkoutPageId, promotions: { some: {} } },
    select: { id: true, sortOrder: true },
  });
  const protectedTierIds = new Set(tiersWithPromotions.map((t) => t.id));

  // Build tier operations: update protected tiers in place, delete the rest, create new ones
  const tierUpdateOps = tiersWithPromotions
    .filter((existing) => existing.sortOrder < priceTiers.length)
    .map((existing) => {
      const incoming = priceTiers[existing.sortOrder]!;
      return prisma.priceTier.update({
        where: { id: existing.id },
        data: { ...incoming, sortOrder: existing.sortOrder },
      });
    });
  const tierCreateStartIndex = tiersWithPromotions.length;
  const tierCreateOps = priceTiers.slice(tierCreateStartIndex).map((t, i) =>
    prisma.priceTier.create({ data: { checkoutPageId, ...t, sortOrder: tierCreateStartIndex + i } }),
  );

  await prisma.$transaction([
    prisma.checkoutPage.update({
      where: { id: checkoutPageId },
      data: {
        slug: data.slug,
        type: data.type,
        title: data.title,
        productName: data.productName || null,
        heroHtml: data.heroHtml || null,
        heroHtmlMobile: data.heroHtmlMobile || null,
        mockupImageUrl: data.mockupImageUrl || null,
        skinId: data.skinId,
        zohoItemId: data.zohoItemId || null,
        zohoRecurringItemId: data.zohoRecurringItemId || null,
        basePriceCents: data.basePriceCents,
        recurringPriceCents: data.recurringPriceCents,
        billingInterval: data.billingInterval,
        showPromoCode: data.showPromoCode,
        successRedirectUrl: data.successRedirectUrl,
        failRedirectUrl: data.failRedirectUrl,
        webhookUrl: data.webhookUrl || null,
        status: data.status,
        upgradeTitle: data.upgradeTitle || null,
        upgradeDescription: data.upgradeDescription || null,
        upgradePriceCents: data.upgradePriceCents,
        upgradeRecurringPriceCents: data.upgradeRecurringPriceCents,
        upgradeZohoItemId: data.upgradeZohoItemId || null,
        upgradeZohoRecurringItemId: data.upgradeZohoRecurringItemId || null,
      },
    }),
    // Delete only tiers that have no promotions; update protected ones in place
    prisma.priceTier.deleteMany({ where: { checkoutPageId, id: { notIn: [...protectedTierIds] } } }),
    ...tierUpdateOps,
    ...tierCreateOps,
    prisma.billingPlan.deleteMany({ where: { checkoutPageId } }),
    ...billingPlans.map((p, i) =>
      prisma.billingPlan.create({ data: { checkoutPageId, ...p, sortOrder: i } }),
    ),
  ]);

  await logCheckoutPageEvent(checkoutPageId, session.adminUserId as string, "updated", `Updated settings for "${data.title}"`);

  revalidatePath(`/admin/checkout-pages/${checkoutPageId}`);
  return { status: "idle", message: "Saved." };
}

/** Generates "<slug>-copy", "<slug>-copy-2", etc. — whichever is free. */
async function uniqueCopySlug(sourceSlug: string): Promise<string> {
  const base = `${sourceSlug}-copy`;
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const existing = await prisma.checkoutPage.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
  }
}

export async function duplicateCheckoutPage(checkoutPageId: string): Promise<void> {
  const session = await verifySession();

  const source = await prisma.checkoutPage.findUnique({
    where: { id: checkoutPageId },
    include: { addonLinks: true, priceTiers: { orderBy: { sortOrder: "asc" } }, billingPlans: { orderBy: { sortOrder: "asc" } } },
  });
  if (!source) return;

  const slug = await uniqueCopySlug(source.slug);

  const clone = await prisma.checkoutPage.create({
    data: {
      slug,
      type: source.type,
      title: `${source.title} (Copy)`,
      productName: source.productName,
      skinId: source.skinId,
      zohoItemId: source.zohoItemId,
      zohoRecurringItemId: source.zohoRecurringItemId,
      basePriceCents: source.basePriceCents,
      recurringPriceCents: source.recurringPriceCents,
      billingInterval: source.billingInterval,
      headline: source.headline,
      originalPriceCents: source.originalPriceCents,
      mockupImageUrl: source.mockupImageUrl,
      heroHtml: source.heroHtml,
      heroHtmlMobile: source.heroHtmlMobile,
      upgradeTitle: source.upgradeTitle,
      upgradeDescription: source.upgradeDescription,
      upgradePriceCents: source.upgradePriceCents,
      upgradeRecurringPriceCents: source.upgradeRecurringPriceCents,
      upgradeZohoItemId: source.upgradeZohoItemId,
      upgradeZohoRecurringItemId: source.upgradeZohoRecurringItemId,
      showPromoCode: source.showPromoCode,
      successRedirectUrl: source.successRedirectUrl,
      failRedirectUrl: source.failRedirectUrl,
      webhookUrl: source.webhookUrl,
      // Always land as a draft, regardless of the source page's status, so a
      // clone never goes live before the admin has reviewed/edited it.
      status: "draft",
      createdById: session.adminUserId as string,
      addonLinks: {
        create: source.addonLinks.map((link) => ({ addonId: link.addonId, sortOrder: link.sortOrder })),
      },
      priceTiers: {
        create: source.priceTiers.map((t) => ({ minQty: t.minQty, maxQty: t.maxQty, priceCents: t.priceCents, zohoItemId: t.zohoItemId, isBase: t.isBase, sortOrder: t.sortOrder })),
      },
      billingPlans: {
        create: source.billingPlans.map((p) => ({ interval: p.interval, label: p.label, priceCents: p.priceCents, zohoItemId: p.zohoItemId, chargeAtCheckout: p.chargeAtCheckout, isDefault: p.isDefault, sortOrder: p.sortOrder })),
      },
    },
  });

  await logCheckoutPageEvent(clone.id, session.adminUserId as string, "duplicated", `Duplicated from "${source.title}" (/c/${source.slug})`);

  redirect(`/admin/checkout-pages/${clone.id}`);
}

export async function deleteCheckoutPage(checkoutPageId: string): Promise<void> {
  const session = await verifySession();
  const page = await prisma.checkoutPage.findUnique({ where: { id: checkoutPageId }, select: { title: true, slug: true } });
  try {
    await prisma.checkoutPage.delete({ where: { id: checkoutPageId } });
  } catch {
    // Foreign key restrict: this page has orders and can't be hard-deleted.
    // Archiving it (status: "archived") is the intended path instead.
    if (page) {
      await logCheckoutPageEvent(checkoutPageId, session.adminUserId as string, "archived", `Attempted delete of "${page.title}" — has orders, consider archiving`);
    }
  }
}

export async function attachAddonToPage(checkoutPageId: string, formData: FormData): Promise<void> {
  const session = await verifySession();

  const addonId = formData.get("addonId")?.toString();
  if (!addonId) return;

  const maxSortOrder = await prisma.checkoutPageAddon.aggregate({
    where: { checkoutPageId },
    _max: { sortOrder: true },
  });

  // upsert: attaching an addon that's already on this page is a harmless no-op.
  await prisma.checkoutPageAddon.upsert({
    where: { checkoutPageId_addonId: { checkoutPageId, addonId } },
    update: {},
    create: { checkoutPageId, addonId, sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1 },
  });

  const addon = await prisma.addon.findUnique({ where: { id: addonId }, select: { name: true } });
  await logCheckoutPageEvent(checkoutPageId, session.adminUserId as string, "addon_attached", `Attached add-on "${addon?.name ?? addonId}"`);
}

export async function detachAddonFromPage(checkoutPageAddonId: string): Promise<void> {
  const session = await verifySession();
  const link = await prisma.checkoutPageAddon.findUnique({ where: { id: checkoutPageAddonId }, include: { addon: { select: { name: true } } } });
  await prisma.checkoutPageAddon.delete({ where: { id: checkoutPageAddonId } });
  if (link) {
    await logCheckoutPageEvent(link.checkoutPageId, session.adminUserId as string, "addon_detached", `Removed add-on "${link.addon.name}"`);
  }
}

export async function moveCheckoutPageAddon(checkoutPageAddonId: string, direction: "up" | "down"): Promise<void> {
  await verifySession();

  const current = await prisma.checkoutPageAddon.findUnique({ where: { id: checkoutPageAddonId } });
  if (!current) return;

  const links = await prisma.checkoutPageAddon.findMany({
    where: { checkoutPageId: current.checkoutPageId },
    orderBy: { sortOrder: "asc" },
  });
  const index = links.findIndex((l) => l.id === checkoutPageAddonId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= links.length) return;

  const a = links[index];
  const b = links[swapIndex];

  await prisma.$transaction([
    prisma.checkoutPageAddon.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.checkoutPageAddon.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);
}
