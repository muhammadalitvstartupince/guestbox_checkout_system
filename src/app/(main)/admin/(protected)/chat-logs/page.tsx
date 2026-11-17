import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";

function statusBadge(status: string) {
  switch (status) {
    case "completed": return { label: "Completed", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400" };
    case "abandoned": return { label: "Abandoned", cls: "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400" };
    default: return { label: "Active", cls: "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400" };
  }
}

export default async function AdminChatLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await verifyAdminSession();
  const params = await searchParams;
  const filter = (params.filter as string) ?? "all";

  const where = filter === "abandoned"
    ? { status: "abandoned" as const }
    : filter === "completed"
      ? { status: "completed" as const }
      : filter === "active"
        ? { status: "active" as const }
        : {};

  const [conversations, stats] = await Promise.all([
    prisma.chatConversation.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: 100,
      include: {
        checkoutPage: { select: { title: true } },
        order: { select: { id: true, status: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.$transaction([
      prisma.chatConversation.count(),
      prisma.chatConversation.count({ where: { status: "completed" } }),
      prisma.chatConversation.count({ where: { status: "abandoned" } }),
      prisma.chatConversation.count({ where: { status: "active" } }),
      prisma.chatConversation.count({ where: { orderId: { not: null } } }),
    ]),
  ]);

  const [totalCount, completedCount, abandonedCount, activeCount, withOrderCount] = stats;
  const completionRate = totalCount > 0 ? Math.round((withOrderCount / totalCount) * 100) : 0;

  const filters = [
    { key: "all", label: "All", count: totalCount },
    { key: "active", label: "Active", count: activeCount },
    { key: "abandoned", label: "Abandoned", count: abandonedCount },
    { key: "completed", label: "Completed", count: completedCount },
  ];

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Chat Logs</h1>

      {/* Stats cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Conversations" value={totalCount} />
        <StatCard label="Completed Orders" value={withOrderCount} />
        <StatCard label="Abandoned" value={abandonedCount} accent="text-red-600 dark:text-red-400" />
        <StatCard label="Completion Rate" value={`${completionRate}%`} accent="text-emerald-600 dark:text-emerald-400" />
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800/50">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/admin/chat-logs" : `/admin/chat-logs?filter=${f.key}`}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              filter === f.key
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {f.label} ({f.count})
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-xs tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-5 py-3 font-medium">Contact</th>
              <th className="px-5 py-3 font-medium">Checkout Page</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Messages</th>
              <th className="px-5 py-3 font-medium">Order</th>
              <th className="px-5 py-3 font-medium">Started</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {conversations.map((conv) => {
              const badge = statusBadge(conv.status);
              return (
                <tr
                  key={conv.id}
                  className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/50"
                >
                  <td className="px-5 py-3">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{conv.firstName} {conv.lastName}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{conv.email}</div>
                    <div className="text-xs text-zinc-400 dark:text-zinc-500">{conv.phone}</div>
                  </td>
                  <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">{conv.checkoutPage.title}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                  </td>
                  <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">{conv._count.messages}</td>
                  <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">
                    {conv.order ? (
                      <Link href={`/admin/orders/${conv.order.id}`} className="text-indigo-600 hover:underline dark:text-indigo-400">
                        {conv.order.status === "paid" ? "Paid" : conv.order.status}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-5 py-3 text-zinc-500 dark:text-zinc-400 text-xs">
                    {conv.startedAt.toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/admin/chat-logs/${conv.id}`}
                      className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
            {conversations.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-zinc-400 dark:text-zinc-500">
                  No conversations match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ?? "text-zinc-900 dark:text-zinc-100"}`}>{value}</div>
    </div>
  );
}
