"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getChatbotSettings } from "@/lib/chatbot/settings";
import { AVAILABLE_MODELS } from "@/lib/chatbot/models";
import type { ChatbotSettingsFormState, TestWebhookState } from "./types";

const allowedModels: string[] = AVAILABLE_MODELS.map((m) => m.value);

const schema = z.object({
  systemPrompt: z.string().trim().min(1, "System prompt cannot be empty"),
  webhookChatStarted: z
    .string()
    .trim()
    .transform((v) => v || null)
    .pipe(z.string().url("Enter a valid URL").nullable()),
  webhookChatAbandoned: z
    .string()
    .trim()
    .transform((v) => v || null)
    .pipe(z.string().url("Enter a valid URL").nullable()),
  maxMessages: z.coerce.number().int().min(5, "Min 5 messages").max(200, "Max 200 messages"),
  chatModel: z.string().refine((v) => allowedModels.includes(v), "Invalid model"),
  summarizerModel: z.string().refine((v) => allowedModels.includes(v), "Invalid model"),
});

export async function updateChatbotSettings(
  _prevState: ChatbotSettingsFormState,
  formData: FormData,
): Promise<ChatbotSettingsFormState> {
  await verifyAdminSession();

  const parsed = schema.safeParse({
    systemPrompt: formData.get("systemPrompt"),
    webhookChatStarted: formData.get("webhookChatStarted"),
    webhookChatAbandoned: formData.get("webhookChatAbandoned"),
    maxMessages: formData.get("maxMessages"),
    chatModel: formData.get("chatModel"),
    summarizerModel: formData.get("summarizerModel"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { systemPrompt, webhookChatStarted, webhookChatAbandoned, maxMessages, chatModel, summarizerModel } = parsed.data;
  const existing = await prisma.chatbotSettings.findFirst();

  await prisma.chatbotSettings.upsert({
    where: { id: existing?.id ?? "00000000-0000-0000-0000-000000000000" },
    update: { systemPrompt, webhookChatStarted, webhookChatAbandoned, maxMessages, chatModel, summarizerModel },
    create: { systemPrompt, webhookChatStarted, webhookChatAbandoned, maxMessages, chatModel, summarizerModel },
  });

  revalidatePath("/admin/settings/chatbot");
  return { status: "idle", message: "Chatbot settings saved." };
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

async function sendSlackTest(url: string, blocks: unknown[]): Promise<{ ok: boolean; status?: number }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });
  return { ok: res.ok, status: res.status };
}

export async function testChatStartedWebhook(
  _prevState: TestWebhookState,
): Promise<TestWebhookState> {
  await verifyAdminSession();

  const settings = await getChatbotSettings();
  if (!settings.webhookChatStarted) {
    return { status: "error", message: "No Slack webhook URL saved for Chat Started. Save one below first." };
  }

  try {
    const res = await sendSlackTest(settings.webhookChatStarted, [
      {
        type: "header",
        text: { type: "plain_text", text: "💬 AI Chat Started (Test)", emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: "*Name:*\nJane Doe" },
          { type: "mrkdwn", text: "*Email:*\njane@example.com" },
          { type: "mrkdwn", text: "*Phone:*\n+1 555-000-1234" },
          { type: "mrkdwn", text: "*Product:*\nGuestBox Pro" },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Chat Log", emoji: true },
            url: `${APP_URL}/admin/chat-logs`,
          },
        ],
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: "🔔 This is a test message from GuestBox admin" },
        ],
      },
    ]);

    if (!res.ok) {
      return { status: "error", message: `Slack returned ${res.status}. Check your webhook URL.` };
    }

    return { status: "success", message: "Test Chat Started message sent to Slack." };
  } catch {
    return { status: "error", message: "Failed to reach Slack. Check your webhook URL." };
  }
}

export async function testChatAbandonedWebhook(
  _prevState: TestWebhookState,
): Promise<TestWebhookState> {
  await verifyAdminSession();

  const settings = await getChatbotSettings();
  if (!settings.webhookChatAbandoned) {
    return { status: "error", message: "No Slack webhook URL saved for Chat Abandoned. Save one below first." };
  }

  try {
    const res = await sendSlackTest(settings.webhookChatAbandoned, [
      {
        type: "header",
        text: { type: "plain_text", text: "🔔 AI Chat Abandoned (Test)", emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: "*Name:*\nJane Doe" },
          { type: "mrkdwn", text: "*Email:*\njane@example.com" },
          { type: "mrkdwn", text: "*Phone:*\n+1 555-000-1234" },
          { type: "mrkdwn", text: "*Product:*\nGuestBox Pro" },
          { type: "mrkdwn", text: "*Messages:*\n8" },
          { type: "mrkdwn", text: "*Duration:*\n12min" },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: "*AI Summary:*\nCustomer Jane Doe started a chat about ordering 3 GuestBox devices for her vacation rental properties. She completed the quantity selection and personal info steps but left before entering her shipping address. She seemed interested in the annual billing plan to save on costs." },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Chat Log", emoji: true },
            url: `${APP_URL}/admin/chat-logs`,
          },
        ],
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: "🔔 This is a test message from GuestBox admin" },
        ],
      },
    ]);

    if (!res.ok) {
      return { status: "error", message: `Slack returned ${res.status}. Check your webhook URL.` };
    }

    return { status: "success", message: "Test Chat Abandoned message sent to Slack (with dummy AI summary)." };
  } catch {
    return { status: "error", message: "Failed to reach Slack. Check your webhook URL." };
  }
}

export async function testLlmApiKey(
  _prevState: TestWebhookState,
): Promise<TestWebhookState> {
  await verifyAdminSession();

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { status: "error", message: "ANTHROPIC_API_KEY is not set in environment variables." };
  }

  try {
    const settings = await getChatbotSettings();
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: settings.chatModel,
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply with only: OK" }],
    });

    const text = res.content[0]?.type === "text" ? res.content[0].text : "";
    return { status: "success", message: `API key is valid. Model responded: "${text.trim()}"` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("401") || msg.includes("authentication") || msg.includes("invalid")) {
      return { status: "error", message: "API key is invalid or expired. Check your ANTHROPIC_API_KEY." };
    }
    return { status: "error", message: `API call failed: ${msg}` };
  }
}

export async function runAbandonedChatScan(
  _prevState: TestWebhookState,
): Promise<TestWebhookState> {
  await verifyAdminSession();

  const settings = await getChatbotSettings();
  if (!settings.webhookChatAbandoned) {
    return { status: "error", message: "No Slack webhook URL saved for Chat Abandoned. Save one below first." };
  }

  const { processAbandonedChats } = await import("@/lib/chatbot/notify");
  const result = await processAbandonedChats();

  if (result.notified === 0) {
    return { status: "success", message: "No abandoned chats found to notify." };
  }

  return { status: "success", message: `Notified ${result.notified} abandoned chat${result.notified === 1 ? "" : "s"} to Slack.` };
}
