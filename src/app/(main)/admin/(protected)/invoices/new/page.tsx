import { verifyAdminSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { InvoiceForm } from "@/components/admin/InvoiceForm";

export default async function NewInvoicePage() {
  await verifyAdminSession();

  const now = new Date();

  const [rawPages, activePromotions] = await Promise.all([
    prisma.checkoutPage.findMany({
      where: { status: "live" },
      select: {
        id: true,
        title: true,
        basePriceCents: true,
        zohoItemId: true,
        successRedirectUrl: true,
        webhookUrl: true,
        priceTiers: { orderBy: { sortOrder: "asc" }, select: { id: true, minQty: true, maxQty: true, priceCents: true, zohoItemId: true, isBase: true } },
        billingPlans: { orderBy: { sortOrder: "asc" }, select: { id: true, label: true, interval: true, priceCents: true, zohoItemId: true } },
        planTiers: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, annualDiscountPercent: true, zohoMonthlyItemId: true, zohoAnnualItemId: true, prices: { orderBy: { sortOrder: "asc" }, select: { minQty: true, maxQty: true, monthlyPriceCents: true } } } },
        addonLinks: { orderBy: { sortOrder: "asc" }, include: { addon: { select: { id: true, name: true, priceCents: true, zohoItemId: true, isActive: true } } } },
      },
      orderBy: { title: "asc" },
    }),
    // Query active promotions the same way the checkout page does
    prisma.promotion.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      include: {
        promoCode: { select: { code: true, discountType: true, discountValue: true } },
        priceTier: { select: { priceCents: true } },
        checkoutPages: { select: { checkoutPageId: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Index promotions by checkout page ID
  const promoByPage = new Map<string, typeof activePromotions[number]>();
  for (const promo of activePromotions) {
    for (const link of promo.checkoutPages) {
      if (!promoByPage.has(link.checkoutPageId)) {
        promoByPage.set(link.checkoutPageId, promo);
      }
    }
  }

  const checkoutPages = rawPages.map((p) => {
    const basePrice = p.basePriceCents || p.priceTiers.find((t) => t.isBase)?.priceCents || p.priceTiers[0]?.priceCents || 0;

    const activePromo = promoByPage.get(p.id);
    let promotion: { name: string; code: string; autoApply: boolean; priceCents: number } | null = null;
    if (activePromo) {
      const origPrice = activePromo.priceTier.priceCents;
      const disc = activePromo.promoCode.discountType === "percent"
        ? Math.round((origPrice * activePromo.promoCode.discountValue) / 100)
        : activePromo.promoCode.discountValue;
      promotion = {
        name: activePromo.name,
        code: activePromo.promoCode.code,
        autoApply: activePromo.autoApply,
        priceCents: Math.max(0, origPrice - disc),
      };
    }

    return {
      id: p.id,
      title: p.title,
      basePriceCents: basePrice,
      zohoItemId: p.zohoItemId,
      successRedirectUrl: p.successRedirectUrl,
      webhookUrl: p.webhookUrl,
      priceTiers: p.priceTiers.map((t) => ({ minQty: t.minQty, maxQty: t.maxQty, priceCents: t.priceCents, zohoItemId: t.zohoItemId })),
      billingPlans: p.billingPlans.map((bp) => ({ label: bp.label, interval: bp.interval, priceCents: bp.priceCents, zohoItemId: bp.zohoItemId })),
      planTiers: p.planTiers.map((pt) => ({
        name: pt.name,
        annualDiscountPercent: pt.annualDiscountPercent,
        zohoMonthlyItemId: pt.zohoMonthlyItemId,
        zohoAnnualItemId: pt.zohoAnnualItemId,
        prices: pt.prices.map((pp) => ({ minQty: pp.minQty, maxQty: pp.maxQty, monthlyPriceCents: pp.monthlyPriceCents })),
      })),
      addons: p.addonLinks.filter((al) => al.addon.isActive).map((al) => ({ name: al.addon.name, priceCents: al.addon.priceCents, zohoItemId: al.addon.zohoItemId })),
      promotion,
    };
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-100">Create Invoice</h1>
      <InvoiceForm checkoutPages={checkoutPages} />
    </div>
  );
}
