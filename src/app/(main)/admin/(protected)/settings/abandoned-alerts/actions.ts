"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { verifyAdminSession } from "@/lib/auth/dal";
import { processAbandonedCheckouts } from "@/lib/abandoned-checkout/notify";
import type { AbandonedAlertSettingsFormState, TestSlackState, RunScanState } from "./types";

const schema = z.object({
  slackWebhookUrl: z
    .string()
    .trim()
    .transform((v) => v || null)
    .pipe(z.string().url("Enter a valid URL").nullable()),
  timeoutMinutes: z.coerce.number().int().min(15, "Min 15 minutes").max(60, "Max 60 minutes"),
});

export async function updateAbandonedAlertSettings(
  _prevState: AbandonedAlertSettingsFormState,
  formData: FormData,
): Promise<AbandonedAlertSettingsFormState> {
  await verifyAdminSession();

  const parsed = schema.safeParse({
    slackWebhookUrl: formData.get("slackWebhookUrl"),
    timeoutMinutes: formData.get("timeoutMinutes"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const enabled = formData.get("enabled") === "on";
  const { slackWebhookUrl, timeoutMinutes } = parsed.data;

  const existing = await prisma.abandonedCheckoutSettings.findFirst();

  await prisma.abandonedCheckoutSettings.upsert({
    where: { id: existing?.id ?? "00000000-0000-0000-0000-000000000000" },
    update: { enabled, slackWebhookUrl, timeoutMinutes },
    create: { enabled, slackWebhookUrl, timeoutMinutes },
  });

  revalidatePath("/admin/settings/abandoned-alerts");
  return { status: "idle", message: "Abandoned alert settings saved." };
}

export async function sendTestSlack(
  _prevState: TestSlackState,
): Promise<TestSlackState> {
  await verifyAdminSession();

  const settings = await prisma.abandonedCheckoutSettings.findFirst();
  if (!settings?.slackWebhookUrl) {
    return { status: "error", message: "No Slack webhook URL saved. Save one above first." };
  }

  try {
    const res = await fetch(settings.slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "🔔 Abandoned Checkout (Test)", emoji: true },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: "*Name:*\nJane Doe" },
              { type: "mrkdwn", text: "*Email:*\njane@example.com" },
              { type: "mrkdwn", text: "*Phone:*\n555-000-1234" },
              { type: "mrkdwn", text: "*Product:*\nGuestBox Pro" },
              { type: "mrkdwn", text: "*Qty:*\n2" },
              { type: "mrkdwn", text: "*Est. Total:*\n$298.00" },
            ],
          },
          {
            type: "context",
            elements: [
              { type: "mrkdwn", text: "🔔 This is a test message from GuestBox admin" },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      return { status: "error", message: `Slack returned ${res.status}. Check your webhook URL.` };
    }

    return { status: "success", message: "Test message sent to Slack." };
  } catch {
    return { status: "error", message: "Failed to reach Slack. Check your webhook URL." };
  }
}

export async function runAbandonedCheckoutScan(
  _prevState: RunScanState,
): Promise<RunScanState> {
  await verifyAdminSession();

  const settings = await prisma.abandonedCheckoutSettings.findFirst();
  if (!settings?.enabled) {
    return { status: "error", message: "Alerts are disabled. Enable them and save first." };
  }

  const result = await processAbandonedCheckouts();

  if (result.notified === 0) {
    return { status: "success", message: "No abandoned checkouts found." };
  }

  return { status: "success", message: `Notified ${result.notified} abandoned checkout${result.notified === 1 ? "" : "s"}.` };
}
