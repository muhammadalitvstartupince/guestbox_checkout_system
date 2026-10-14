import { verifyAdminSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { PromoCodeForm } from "@/components/admin/PromoCodeForm";
import { togglePromoCode } from "./actions";

function formatDiscount(type: string, value: number) {
  return type === "percent" ? `${value}%` : `$${(value / 100).toFixed(2)}`;
}

export default async function AdminPromoCodesPage() {
  await verifyAdminSession();

  const [promoCodes, checkoutPages] = await Promise.all([
    prisma.promoCode.findMany({
      orderBy: { createdAt: "desc" },
      include: { appliesToCheckoutPage: { select: { title: true } } },
    }),
    prisma.checkoutPage.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);

  return (
    <div>
      <PromoCodeForm checkoutPages={checkoutPages} />

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-xs tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-5 py-3 font-medium">Code</th>
              <th className="px-5 py-3 font-medium">Discount</th>
              <th className="px-5 py-3 font-medium">Applies To</th>
              <th className="px-5 py-3 font-medium">Redemptions</th>
              <th className="px-5 py-3 font-medium">Expires</th>
              <th className="px-5 py-3 font-medium">Active</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {promoCodes.map((promo) => (
              <tr
                key={promo.id}
                className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/50"
              >
                <td className="px-5 py-3 font-mono text-zinc-900 dark:text-zinc-100">{promo.code}</td>
                <td className="px-5 py-3 text-zinc-900 dark:text-zinc-100">
                  {formatDiscount(promo.discountType, promo.discountValue)}
                </td>
                <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">
                  {promo.appliesToCheckoutPage?.title ?? "All pages"}
                </td>
                <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">
                  {promo.timesRedeemed}
                  {promo.maxRedemptions != null ? ` / ${promo.maxRedemptions}` : ""}
                </td>
                <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">
                  {promo.expiresAt ? promo.expiresAt.toISOString().slice(0, 10) : "—"}
                </td>
                <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">{promo.isActive ? "Yes" : "No"}</td>
                <td className="px-5 py-3 text-right">
                  <form action={togglePromoCode.bind(null, promo.id)}>
                    <button
                      type="submit"
                      className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {promo.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {promoCodes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-zinc-400 dark:text-zinc-500">
                  No promo codes yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
