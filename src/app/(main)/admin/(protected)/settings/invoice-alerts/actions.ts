"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { verifyAdminSession } from "@/lib/auth/dal";
import { processInvoicePaidSlack } from "@/lib/invoices/notify-paid";

export interface FormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}
export interface ActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

const schema = z.object({
  slackWebhookUrl: z
    .string()
    .trim()
    .transform((v) => v || null)
    .pipe(z.string().url("Enter a valid URL").nullable()),
});

export async function updateInvoiceSlackSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await verifyAdminSession();

  const parsed = schema.safeParse({ slackWebhookUrl: formData.get("slackWebhookUrl") });
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const enabled = formData.get("enabled") === "on";
  const { slackWebhookUrl } = parsed.data;
  const existing = await prisma.invoiceSlackSettings.findFirst();

  await prisma.invoiceSlackSettings.upsert({
    where: { id: existing?.id ?? "00000000-0000-0000-0000-000000000000" },
    update: { enabled, slackWebhookUrl },
    create: { enabled, slackWebhookUrl },
  });

  revalidatePath("/admin/settings/invoice-alerts");
  return { status: "idle", message: "Invoice alert settings saved." };
}

export async function sendTestInvoiceSlack(_prev: ActionState): Promise<ActionState> {
  await verifyAdminSession();

  const settings = await prisma.invoiceSlackSettings.findFirst();
  if (!settings?.slackWebhookUrl) {
    return { status: "error", message: "No Slack webhook URL saved. Save one first." };
  }

  try {
    const res = await fetch(settings.slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocks: [
          { type: "header", text: { type: "plain_text", text: "💰 Invoice Paid (Test)", emoji: true } },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: "*Invoice:*\nINV-0000" },
              { type: "mrkdwn", text: "*Total:*\n$149.00" },
              { type: "mrkdwn", text: "*Name:*\nJane Doe" },
              { type: "mrkdwn", text: "*Email:*\njane@example.com" },
              { type: "mrkdwn", text: "*Phone:*\n555-000-1234" },
              { type: "mrkdwn", text: "*Country:*\nUS" },
            ],
          },
          { type: "context", elements: [{ type: "mrkdwn", text: "🔔 This is a test message from GuestBox admin" }] },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return { status: "error", message: `Slack returned ${res.status}. Check your webhook URL.` };
    return { status: "success", message: "Test message sent to Slack." };
  } catch {
    return { status: "error", message: "Failed to reach Slack. Check your webhook URL." };
  }
}

export async function runInvoicePaidScan(_prev: ActionState): Promise<ActionState> {
  await verifyAdminSession();

  const settings = await prisma.invoiceSlackSettings.findFirst();
  if (!settings?.enabled) {
    return { status: "error", message: "Alerts are disabled. Enable and save first." };
  }

  const result = await processInvoicePaidSlack();

  if (result.notified === 0) {
    return { status: "success", message: "No new paid invoices to notify." };
  }

  return { status: "success", message: `Notified ${result.notified} paid invoice${result.notified === 1 ? "" : "s"}.` };
}
