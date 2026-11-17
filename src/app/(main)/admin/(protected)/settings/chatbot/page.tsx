import { verifyAdminSession } from "@/lib/auth/dal";
import { ChatbotSettingsForm } from "@/components/admin/ChatbotSettingsForm";
import { TestChatWebhookPanel } from "@/components/admin/TestChatWebhookPanel";
import { getChatbotSettings } from "@/lib/chatbot/settings";

export default async function ChatbotSettingsPage() {
  await verifyAdminSession();
  const settings = await getChatbotSettings();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Configure chatbot webhooks and system prompt. Changes take effect immediately for new conversations.
        </p>
      </div>
      <TestChatWebhookPanel />
      <ChatbotSettingsForm
        defaults={{
          systemPrompt: settings.systemPrompt,
          webhookChatStarted: settings.webhookChatStarted ?? "",
          webhookChatAbandoned: settings.webhookChatAbandoned ?? "",
          maxMessages: settings.maxMessages,
          chatModel: settings.chatModel,
          summarizerModel: settings.summarizerModel,
        }}
      />
    </div>
  );
}
