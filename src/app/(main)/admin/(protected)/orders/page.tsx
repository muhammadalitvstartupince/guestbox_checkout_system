import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";

function formatCents(cents: number | null) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function AdminOrdersPage() {
  await verifyAdminSession();

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { checkoutPage: { select: { title: true } } },
  });

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-xs tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-5 py-3 font-medium">Product</th>
              <th className="px-5 py-3 font-medium">Amount</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Zoho</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.id}
                className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/50"
              >
                <td className="px-5 py-3 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                  {order.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </td>
                <td className="px-5 py-3">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {order.firstName} {order.lastName}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{order.email}</div>
                </td>
                <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">{order.checkoutPage.title}</td>
                <td className="px-5 py-3 text-zinc-900 dark:text-zinc-100">{formatCents(order.amountCents)}</td>
                <td className="px-5 py-3">
                  <OrderStatusBadge status={order.status} />
                </td>
                <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">{order.zohoSynced ? "✓" : "—"}</td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-zinc-400 dark:text-zinc-500">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
