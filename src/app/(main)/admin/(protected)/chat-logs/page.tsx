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

export default async function AdminChatLogsPage() {
  await verifyAdminSession();

  const conversations = await prisma.chatConversation.findMany({
    orderBy: { startedAt: "desc" },
    take: 100,
    include: {
      checkoutPage: { select: { title: true } },
      order: { select: { id: true, status: true } },
      _count: { select: { messages: true } },
    },
  });

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Chat Logs</h1>

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
                  No chat conversations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
