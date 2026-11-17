import { getChatbotSettings } from "./settings";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

interface ConversationInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  checkoutPage?: { title: string; slug: string } | null;
}

export async function fireChatStartedWebhook(conversation: ConversationInfo) {
  const settings = await getChatbotSettings();
  if (!settings.webhookChatStarted) return;

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "💬 AI Chat Started", emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Name:*\n${conversation.firstName} ${conversation.lastName}` },
        { type: "mrkdwn", text: `*Email:*\n${conversation.email}` },
        { type: "mrkdwn", text: `*Phone:*\n${conversation.phone}` },
        { type: "mrkdwn", text: `*Product:*\n${conversation.checkoutPage?.title ?? "N/A"}` },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View Chat Log", emoji: true },
          url: `${APP_URL}/admin/chat-logs/${conversation.id}`,
        },
      ],
    },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: `🕐 ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}` },
      ],
    },
  ];

  try {
    await fetch(settings.webhookChatStarted, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });
  } catch (err) {
    console.error("Chat started Slack webhook failed:", err);
  }
}
