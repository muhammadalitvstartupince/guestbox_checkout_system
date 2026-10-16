import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { PromotionForm } from "@/components/admin/PromotionForm";
import { togglePromotion } from "./actions";

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function utcToLocal(utc: Date, timezone: string): string {
  return utc.toLocaleString("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function promoStatus(promo: { isActive: boolean; startsAt: Date | null; endsAt: Date | null }) {
  const now = new Date();
  if (!promo.isActive) return { label: "Inactive", color: "text-zinc-500" };
  if (promo.endsAt && promo.endsAt < now) return { label: "Expired", color: "text-red-600 dark:text-red-400" };
  if (promo.startsAt && promo.startsAt > now) return { label: "Scheduled", color: "text-amber-600 dark:text-amber-400" };
  return { label: "Active", color: "text-emerald-600 dark:text-emerald-400" };
}

export default async function AdminPromotionsPage() {
  await verifyAdminSession();

  const [promotions, promoCodes, checkoutPages, priceTiers] = await Promise.all([
    prisma.promotion.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        promoCode: { select: { code: true, discountType: true, discountValue: true } },
        priceTier: { select: { priceCents: true, minQty: true, maxQty: true } },
        checkoutPages: { include: { checkoutPage: { select: { title: true } } } },
      },
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

  return (
    <div>
      <PromotionForm
        promoCodes={promoCodes}
        priceTiers={priceTiers}
        checkoutPages={checkoutPages}
      />

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-xs tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Promo Code</th>
              <th className="px-5 py-3 font-medium">Original → Final</th>
              <th className="px-5 py-3 font-medium">Pages</th>
              <th className="px-5 py-3 font-medium">Starts</th>
              <th className="px-5 py-3 font-medium">Ends</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {promotions.map((promo) => {
              const status = promoStatus(promo);
              const discount =
                promo.promoCode.discountType === "percent"
                  ? Math.round((promo.priceTier.priceCents * promo.promoCode.discountValue) / 100)
                  : promo.promoCode.discountValue;
              const finalPrice = Math.max(0, promo.priceTier.priceCents - discount);

              return (
                <tr
                  key={promo.id}
                  className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/50"
                >
                  <td className="px-5 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {promo.name}
                  </td>
                  <td className={`px-5 py-3 font-medium ${status.color}`}>{status.label}</td>
                  <td className="px-5 py-3 font-mono text-zinc-900 dark:text-zinc-100">
                    {promo.promoCode.code}
                  </td>
                  <td className="px-5 py-3 text-zinc-700 dark:text-zinc-300">
                    <span className="line-through text-zinc-400">{formatCents(promo.priceTier.priceCents)}</span>
                    {" → "}
                    <span className="font-semibold">{formatCents(finalPrice)}</span>
                  </td>
                  <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">
                    {promo.checkoutPages.map((cp) => cp.checkoutPage.title).join(", ")}
                  </td>
                  <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">
                    {promo.startsAt ? utcToLocal(promo.startsAt, promo.timezone) : "—"}
                  </td>
                  <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">
                    {promo.endsAt ? utcToLocal(promo.endsAt, promo.timezone) : "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/admin/promotions/${promo.id}`}
                        className="text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-400"
                      >
                        Edit
                      </Link>
                      <form action={togglePromotion.bind(null, promo.id)}>
                        <button
                          type="submit"
                          className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          {promo.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {promotions.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-zinc-400 dark:text-zinc-500">
                  No promotions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
