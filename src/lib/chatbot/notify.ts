import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db/client";
import { getChatbotSettings } from "./settings";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export interface NotifyResult {
  found: number;
  notified: number;
}

export async function processAbandonedChats(): Promise<NotifyResult> {
  const settings = await getChatbotSettings();
  if (!settings.webhookChatAbandoned) return { found: 0, notified: 0 };

  const abandonedChats = await prisma.chatConversation.findMany({
    where: {
      status: "abandoned",
      abandonedNotifiedAt: null,
    },
    include: {
      checkoutPage: { select: { title: true, slug: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (abandonedChats.length === 0) return { found: 0, notified: 0 };

  let notified = 0;

  for (const conversation of abandonedChats) {
    // Generate AI summary
    let summary = "No messages in conversation.";
    if (conversation.messages.length > 0) {
      try {
        const anthropic = new Anthropic();
        const transcript = conversation.messages
          .map((m) => `${m.role === "user" ? "Customer" : "Bot"}: ${m.content}`)
          .join("\n");

        const res = await anthropic.messages.create({
          model: settings.summarizerModel,
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: `Summarize this abandoned checkout chat in 2-3 sentences. Focus on: what the customer wanted, how far they got in checkout, and why they may have left.\n\n${transcript}`,
            },
          ],
        });

        const textBlock = res.content.find((b) => b.type === "text");
        if (textBlock && textBlock.type === "text") summary = textBlock.text;
      } catch (err) {
        console.error(`AI summary failed for conversation ${conversation.id}:`, err);
        summary = `${conversation.messages.length} messages exchanged. Summary generation failed.`;
      }
    }

    const durationMin = conversation.abandonedAt
      ? Math.round((conversation.abandonedAt.getTime() - conversation.startedAt.getTime()) / 60000)
      : "?";

    // Send Slack message
    try {
      await fetch(settings.webhookChatAbandoned, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: [
            {
              type: "header",
              text: { type: "plain_text", text: "🔔 AI Chat Abandoned", emoji: true },
            },
            {
              type: "section",
              fields: [
                { type: "mrkdwn", text: `*Name:*\n${conversation.firstName} ${conversation.lastName}` },
                { type: "mrkdwn", text: `*Email:*\n${conversation.email}` },
                { type: "mrkdwn", text: `*Phone:*\n${conversation.phone}` },
                { type: "mrkdwn", text: `*Product:*\n${conversation.checkoutPage?.title ?? "N/A"}` },
                { type: "mrkdwn", text: `*Messages:*\n${conversation.messages.length}` },
                { type: "mrkdwn", text: `*Duration:*\n${durationMin}min` },
              ],
            },
            {
              type: "section",
              text: { type: "mrkdwn", text: `*AI Summary:*\n${summary}` },
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
                { type: "mrkdwn", text: `⏱️ Abandoned ${durationMin} min into chat | Started ${conversation.startedAt.toLocaleString("en-US", { timeZone: "America/New_York" })}` },
              ],
            },
          ],
        }),
      });
    } catch (err) {
      console.error(`Slack notification failed for conversation ${conversation.id}:`, err);
    }

    await prisma.chatConversation.update({
      where: { id: conversation.id },
      data: { abandonedNotifiedAt: new Date() },
    });
    notified++;
  }

  return { found: abandonedChats.length, notified };
}
