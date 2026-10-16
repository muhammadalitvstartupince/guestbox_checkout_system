import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { PromotionForm } from "@/components/admin/PromotionForm";
import type { PromotionDefaults } from "@/components/admin/PromotionForm";
import Link from "next/link";

/** Convert a UTC Date to a datetime-local string in the given IANA timezone. */
function utcToLocalDatetimeString(utc: Date, timezone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(utc).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export default async function EditPromotionPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyAdminSession();
  const { id } = await params;

  const [promotion, promoCodes, checkoutPages, priceTiers] = await Promise.all([
    prisma.promotion.findUnique({
      where: { id },
      include: { checkoutPages: { select: { checkoutPageId: true } } },
    }),
    prisma.promoCode.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, discountType: true, discountValue: true },
    }),
    prisma.checkoutPage.findMany({
      where: { status: { not: "archived" } },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    prisma.priceTier.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, checkoutPageId: true, minQty: true, maxQty: true, priceCents: true },
    }),
  ]);

  if (!promotion) notFound();

  const defaults: PromotionDefaults = {
    id: promotion.id,
    name: promotion.name,
    promoCodeId: promotion.promoCodeId,
    priceTierId: promotion.priceTierId,
    checkoutPageIds: promotion.checkoutPages.map((cp) => cp.checkoutPageId),
    timezone: promotion.timezone,
    startsAt: promotion.startsAt ? utcToLocalDatetimeString(promotion.startsAt, promotion.timezone) : "",
    endsAt: promotion.endsAt ? utcToLocalDatetimeString(promotion.endsAt, promotion.timezone) : "",
  };

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/admin/promotions"
          className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          ← Back to Promotions
        </Link>
      </div>
      <PromotionForm
        promoCodes={promoCodes}
        priceTiers={priceTiers}
        checkoutPages={checkoutPages}
        defaults={defaults}
      />
    </div>
  );
}
