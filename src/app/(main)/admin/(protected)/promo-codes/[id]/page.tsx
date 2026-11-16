import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { PromoCodeForm } from "@/components/admin/PromoCodeForm";
import type { PromoCodeDefaults } from "@/components/admin/PromoCodeForm";
import Link from "next/link";

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

function centsToStr(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

export default async function EditPromoCodePage({ params }: { params: Promise<{ id: string }> }) {
  await verifyAdminSession();
  const { id } = await params;

  const [promo, allPages] = await Promise.all([
    prisma.promoCode.findUnique({ where: { id } }),
    prisma.checkoutPage.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);

  if (!promo) notFound();

  const defaults: PromoCodeDefaults = {
    id: promo.id,
    code: promo.code,
    discountMode: promo.discountMode as "single" | "split",
    discountType: promo.discountType,
    discountValue: promo.discountType === "fixed" ? centsToStr(promo.discountValue) : String(promo.discountValue),
    appliesTo: promo.appliesTo,
    perDevice: promo.perDevice,
    appliesToCheckoutPageId: promo.appliesToCheckoutPageId ?? "",
    maxRedemptions: promo.maxRedemptions != null ? String(promo.maxRedemptions) : "",
    expiresAt: promo.expiresAt ? utcToLocalDatetimeString(promo.expiresAt, promo.timezone) : "",
    timezone: promo.timezone,
    deviceDiscountType: promo.deviceDiscountType ?? "",
    deviceDiscountValue: promo.deviceDiscountValue != null ? centsToStr(promo.deviceDiscountValue) : "",
    monthlyDiscountType: promo.monthlyDiscountType ?? "",
    monthlyDiscountValue: promo.monthlyDiscountValue != null ? centsToStr(promo.monthlyDiscountValue) : "",
    annualDiscountType: promo.annualDiscountType ?? "",
    annualDiscountValue: promo.annualDiscountValue != null ? centsToStr(promo.annualDiscountValue) : "",
  };

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/admin/promo-codes"
          className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          ← Back to Promo Codes
        </Link>
      </div>
      <PromoCodeForm checkoutPages={allPages} defaults={defaults} />
    </div>
  );
}
