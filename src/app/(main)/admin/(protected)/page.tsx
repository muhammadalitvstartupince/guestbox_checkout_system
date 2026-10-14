import Link from "next/link";
import { DollarSign, ShoppingBag, Users } from "lucide-react";
import { verifySession } from "@/lib/auth/dal";
import { getDashboardStats } from "@/lib/admin/dashboard-stats";
import { StatCard } from "@/components/admin/StatCard";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";

function formatCents(cents: number | null) {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function AdminDashboardPage() {
  await verifySession();
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <StatCard
            label="Total Revenue"
            value={formatCents(stats.totalRevenueCents)}
            changePct={stats.revenueChangePct}
            icon={DollarSign}
            iconBg="bg-emerald-50 dark:bg-emerald-500/10"
            iconColor="text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            label="Orders"
            value={stats.totalOrders.toLocaleString()}
            changePct={stats.ordersChangePct}
            icon={ShoppingBag}
            iconBg="bg-blue-50 dark:bg-blue-500/10"
            iconColor="text-blue-600 dark:text-blue-400"
          />
          <StatCard
            label="Customers"
            value={stats.totalCustomers.toLocaleString()}
            changePct={stats.customersChangePct}
            icon={Users}
            iconBg="bg-amber-50 dark:bg-amber-500/10"
            iconColor="text-amber-600 dark:text-amber-400"
          />
        </div>

        <div className="lg:col-span-2">
          <RevenueChart data={stats.monthly} />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent Orders Activity</h2>
          <Link href="/admin/orders" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            View all
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/50"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium text-zinc-900 hover:text-indigo-600 dark:text-zinc-100 dark:hover:text-indigo-400"
                    >
                      {order.firstName} {order.lastName}
                    </Link>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{order.email}</div>
                  </td>
                  <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">{order.checkoutPageTitle}</td>
                  <td className="px-5 py-3 text-zinc-900 dark:text-zinc-100">{formatCents(order.amountCents)}</td>
                  <td className="px-5 py-3 text-zinc-500 dark:text-zinc-400">
                    {order.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="px-5 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                </tr>
              ))}
              {stats.recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-zinc-400 dark:text-zinc-500">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
