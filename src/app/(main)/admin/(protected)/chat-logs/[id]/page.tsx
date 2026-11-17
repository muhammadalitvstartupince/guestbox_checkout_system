import { notFound } from "next/navigation";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";

export default async function ChatLogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyAdminSession();
  const { id } = await params;

  const conversation = await prisma.chatConversation.findUnique({
    where: { id },
    include: {
      checkoutPage: { select: { title: true, slug: true } },
      order: { select: { id: true, status: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conversation) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/chat-logs"
          className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          ← Back to Chat Logs
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Contact info sidebar */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Contact</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Name</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">{conversation.firstName} {conversation.lastName}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Email</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">{conversation.email}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Phone</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">{conversation.phone}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Checkout Page</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">{conversation.checkoutPage.title}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Status</dt>
              <dd className="text-zinc-900 dark:text-zinc-100 capitalize">{conversation.status}</dd>
            </div>
            {conversation.outcome && (
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">Outcome</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">{conversation.outcome.replace(/_/g, " ")}</dd>
              </div>
            )}
            {conversation.order && (
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">Order</dt>
                <dd>
                  <Link href={`/admin/orders/${conversation.order.id}`} className="text-indigo-600 hover:underline dark:text-indigo-400">
                    {conversation.order.status === "paid" ? "Paid" : conversation.order.status}
                  </Link>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Started</dt>
              <dd className="text-xs text-zinc-700 dark:text-zinc-300">{conversation.startedAt.toISOString().slice(0, 16).replace("T", " ")}</dd>
            </div>
            {conversation.abandonedAt && (
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">Abandoned</dt>
                <dd className="text-xs text-red-600 dark:text-red-400">{conversation.abandonedAt.toISOString().slice(0, 16).replace("T", " ")}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Chat transcript */}
        <div className="md:col-span-2 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Conversation ({conversation.messages.length} messages)
          </h2>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {conversation.messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-cyan-600 text-white"
                    : msg.role === "system"
                      ? "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400 italic"
                      : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                }`}>
                  <div className="mb-0.5 text-[10px] opacity-60">
                    {msg.role} — {msg.createdAt.toISOString().slice(11, 16)}
                  </div>
                  {msg.content}
                </div>
              </div>
            ))}
            {conversation.messages.length === 0 && (
              <p className="text-center text-sm text-zinc-400">No messages.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
