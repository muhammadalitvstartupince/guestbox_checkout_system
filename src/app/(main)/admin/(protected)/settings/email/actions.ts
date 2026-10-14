"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getEmailSettings } from "@/lib/email/settings";
import { sendEmail } from "@/lib/email/send";
import type { EmailSettingsFormState, SendTestEmailState } from "./types";

const emailSettingsSchema = z.object({
  emailFrom: z.email("Enter a valid from address"),
  customerConfirmationSubject: z.string().trim().min(1, "Required"),
  customerConfirmationHtml: z.string().trim().min(1, "Required"),
  internalNotifySubject: z.string().trim().min(1, "Required"),
  internalNotifyHtml: z.string().trim().min(1, "Required"),
});

function parseEmailList(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,\n]/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export async function updateEmailSettings(
  _prevState: EmailSettingsFormState,
  formData: FormData,
): Promise<EmailSettingsFormState> {
  await verifyAdminSession();

  const parsed = emailSettingsSchema.safeParse({
    emailFrom: formData.get("emailFrom"),
    customerConfirmationSubject: formData.get("customerConfirmationSubject"),
    customerConfirmationHtml: formData.get("customerConfirmationHtml"),
    internalNotifySubject: formData.get("internalNotifySubject"),
    internalNotifyHtml: formData.get("internalNotifyHtml"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const internalNotifyEmailsRaw = formData.get("internalNotifyEmails")?.toString() ?? "";
  const invalidEmails = parseEmailList(internalNotifyEmailsRaw).filter((e) => !z.email().safeParse(e).success);
  if (invalidEmails.length) {
    return {
      status: "error",
      message: "One or more internal notify addresses are invalid.",
      fieldErrors: { internalNotifyEmails: [`Invalid: ${invalidEmails.join(", ")}`] },
    };
  }

  // Blank API key input means "leave unchanged" — never overwrite a saved
  // secret with an accidental empty submit.
  const customerConfirmationEnabled = formData.get("customerConfirmationEnabled") === "on";
  const apiKeyInput = formData.get("sendgridApiKey")?.toString().trim();

  const existing = await prisma.emailSettings.findFirst();

  await prisma.emailSettings.upsert({
    where: { id: existing?.id ?? "00000000-0000-0000-0000-000000000000" },
    update: {
      ...(apiKeyInput ? { sendgridApiKey: apiKeyInput } : {}),
      emailFrom: data.emailFrom,
      internalNotifyEmails: parseEmailList(internalNotifyEmailsRaw),
      customerConfirmationEnabled,
      customerConfirmationSubject: data.customerConfirmationSubject,
      customerConfirmationHtml: data.customerConfirmationHtml,
      internalNotifySubject: data.internalNotifySubject,
      internalNotifyHtml: data.internalNotifyHtml,
    },
    create: {
      sendgridApiKey: apiKeyInput || null,
      emailFrom: data.emailFrom,
      internalNotifyEmails: parseEmailList(internalNotifyEmailsRaw),
      customerConfirmationEnabled,
      customerConfirmationSubject: data.customerConfirmationSubject,
      customerConfirmationHtml: data.customerConfirmationHtml,
      internalNotifySubject: data.internalNotifySubject,
      internalNotifyHtml: data.internalNotifyHtml,
    },
  });

  return { status: "idle", message: "Email settings saved." };
}

export async function sendTestEmail(
  _prevState: SendTestEmailState,
  formData: FormData,
): Promise<SendTestEmailState> {
  await verifyAdminSession();

  const parsed = z.email("Enter a valid email address").safeParse(formData.get("testEmailTo")?.toString().trim());
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  }

  // Uses whatever is currently saved in the DB, not unsaved form input — the
  // API key field never round-trips its real value to the client, so there's
  // nothing else to test against. Save changes first, then test.
  const settings = await getEmailSettings();
  if (!settings.sendgridApiKey) {
    return { status: "error", message: "No SendGrid API key is saved yet. Save one above first." };
  }

  const result = await sendEmail({
    to: parsed.data,
    subject: "GuestBox Admin — Test Email",
    html: "<p>This is a test email sent from the GuestBox admin panel to verify your SendGrid configuration is working.</p>",
    apiKey: settings.sendgridApiKey,
    from: settings.emailFrom,
  });

  if (!result.success) {
    return { status: "error", message: result.error ?? "Failed to send test email." };
  }

  return { status: "success", message: `Test email sent to ${parsed.data}.` };
}
