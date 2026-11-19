import { verifyAdminSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { LiveChatForm } from "@/components/admin/LiveChatForm";

export default async function LiveChatSettingsPage() {
  await verifyAdminSession();
  const settings = await prisma.liveChatSettings.findFirst();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Enable or disable the Chatwoot live chat widget on all checkout pages. Changes take effect immediately.
        </p>
      </div>
      <LiveChatForm enabled={settings?.enabled ?? true} />
    </div>
  );
}
