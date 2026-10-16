import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/client";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { hasUpgradeOffer } from "@/lib/checkout/select-product";
import { calculateOrderPrice } from "@/lib/pricing/calculate";

type CheckoutRouteParams = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Cached so generateMetadata and the page component share one query instead
// of hitting the DB twice for the same request.
const getCheckoutPageBySlug = cache(async (slug: string) => {
  return prisma.checkoutPage.findUnique({
    where: { slug },
    include: {
      skin: true,
      addonLinks: {
        where: { addon: { isActive: true } },
        orderBy: { sortOrder: "asc" },
        include: { addon: true },
      },
      priceTiers: { orderBy: { sortOrder: "asc" } },
      billingPlans: { orderBy: { sortOrder: "asc" } },
    },
  });
});

export async function generateMetadata({ params }: CheckoutRouteParams): Promise<Metadata> {
  const { slug } = await params;
  const checkoutPage = await getCheckoutPageBySlug(slug);

  if (!checkoutPage || checkoutPage.status === "archived") {
    return { title: "Checkout" };
  }

  return {
    title: checkoutPage.title,
    description: checkoutPage.headline ?? checkoutPage.title,
  };
}

/** Full URL (scheme, host, path, query string) exactly as the customer's
 *  browser had it loaded — this is what gets stored on the order so support
 *  and marketing can tell which channel (an email link's ?utm_source=email,
 *  an ad, a direct visit, etc.) actually drove it. */
async function buildLandingUrl(slug: string, searchParams: Record<string, string | string[] | undefined>) {
  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const proto = headersList.get("x-forwarded-proto") ?? "https";

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const v of value) query.append(key, v);
    } else if (value != null) {
      query.append(key, value);
    }
  }
  const queryString = query.toString();

  return `${proto}://${host}/c/${slug}${queryString ? `?${queryString}` : ""}`;
}

export default async function CheckoutRoutePage({ params, searchParams }: CheckoutRouteParams) {
  const { slug } = await params;

  const [checkoutPage, resolvedSearchParams] = await Promise.all([getCheckoutPageBySlug(slug), searchParams]);

  if (!checkoutPage || checkoutPage.status === "archived") {
    notFound();
  }

  const landingUrl = await buildLandingUrl(slug, resolvedSearchParams);

  // Check for an active limited-time promotion on this checkout page
  const now = new Date();
  const activePromoRow = await prisma.promotion.findFirst({
    where: {
      isActive: true,
      checkoutPages: { some: { checkoutPageId: checkoutPage.id } },
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    include: {
      promoCode: { select: { code: true, discountType: true, discountValue: true } },
      priceTier: { select: { priceCents: true, zohoItemId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  let activePromotion: {
    name: string;
    originalPriceCents: number;
    promoPriceCents: number;
    promoCode: string;
    endsAt: string | null;
  } | null = null;

  if (activePromoRow) {
    const result = calculateOrderPrice({
      basePriceCents: activePromoRow.priceTier.priceCents,
      quantity: 1,
      promo: {
        type: activePromoRow.promoCode.discountType,
        value: activePromoRow.promoCode.discountValue,
      },
    });
    activePromotion = {
      name: activePromoRow.name,
      originalPriceCents: activePromoRow.priceTier.priceCents,
      promoPriceCents: result.totalCents,
      promoCode: activePromoRow.promoCode.code,
      endsAt: activePromoRow.endsAt ? activePromoRow.endsAt.toISOString() : null,
    };
  }

  return (
    <CheckoutForm
      landingUrl={landingUrl}
      activePromotion={activePromotion}
      checkoutPage={{
        slug: checkoutPage.slug,
        type: checkoutPage.type,
        title: checkoutPage.title,
        productName: checkoutPage.productName ?? checkoutPage.title,
        headline: checkoutPage.headline ?? checkoutPage.title,
        originalPriceCents: checkoutPage.originalPriceCents,
        heroHtml: checkoutPage.heroHtml,
        heroHtmlMobile: checkoutPage.heroHtmlMobile,
        mockupImageUrl: checkoutPage.mockupImageUrl,
        basePriceCents: checkoutPage.basePriceCents,
        recurringPriceCents: checkoutPage.recurringPriceCents,
        billingInterval: checkoutPage.billingInterval,
        showPromoCode: checkoutPage.showPromoCode,
        skinConfig: (checkoutPage.skin.config ?? {}) as {
          colors?: { primary?: string; accent?: string };
          font?: string;
          backgroundImageUrl?: string;
          logoUrl?: string;
        },
        addons: checkoutPage.addonLinks.map((link) => ({
          id: link.addon.id,
          name: link.addon.name,
          description: link.addon.description,
          imageUrl: link.addon.imageUrl,
          priceCents: link.addon.priceCents,
          originalPriceCents: link.addon.originalPriceCents,
        })),
        upgrade: hasUpgradeOffer(checkoutPage)
          ? {
              title: checkoutPage.upgradeTitle as string,
              description: checkoutPage.upgradeDescription,
              priceCents: checkoutPage.upgradePriceCents as number,
              recurringPriceCents: checkoutPage.upgradeRecurringPriceCents,
            }
          : null,
        priceTiers: checkoutPage.priceTiers.map((t) => ({
          minQty: t.minQty,
          maxQty: t.maxQty,
          priceCents: t.priceCents,
        })),
        billingPlans: checkoutPage.billingPlans.map((p) => ({
          id: p.id,
          interval: p.interval,
          label: p.label,
          priceCents: p.priceCents,
          chargeAtCheckout: p.chargeAtCheckout,
          isDefault: p.isDefault,
        })),
      }}
    />
  );
}
