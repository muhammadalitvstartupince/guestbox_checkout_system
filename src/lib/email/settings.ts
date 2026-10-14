import { prisma } from "@/lib/db/client";

export interface EmailSettingsData {
  sendgridApiKey: string | null;
  emailFrom: string;
  internalNotifyEmails: string[];
  customerConfirmationEnabled: boolean;
  customerConfirmationSubject: string;
  customerConfirmationHtml: string;
  internalNotifySubject: string;
  internalNotifyHtml: string;
}

// Fallback used only if the admin hasn't saved settings yet (e.g. before
// the first `db seed` on a fresh environment) — mirrors the original
// hardcoded copy so behavior doesn't change until an admin edits it.
export const DEFAULT_EMAIL_SETTINGS: EmailSettingsData = {
  sendgridApiKey: null,
  emailFrom: "support@guestbox.com",
  internalNotifyEmails: [],
  customerConfirmationEnabled: true,
  customerConfirmationSubject: "Your Order Was Received - GuestBox",
  customerConfirmationHtml:
    "<p>Hi,</p><p>Thank you for placing your order for <strong>{{productName}}</strong> with us. Please note that orders are processed on a first-come, first-serve basis.</p><p>Next, expect to receive a call from an onboarding specialist from our team soon.</p><p>Best regards,<br/>GuestBox</p>",
  internalNotifySubject: "New online order received [{{productName}}]",
  internalNotifyHtml:
    "<p>New order <strong>{{orderId}}</strong> from <strong>{{firstName}} {{lastName}}</strong></p>{{orderBreakdown}}",
};

export async function getEmailSettings(): Promise<EmailSettingsData> {
  const row = await prisma.emailSettings.findFirst();
  if (!row) return DEFAULT_EMAIL_SETTINGS;

  return {
    sendgridApiKey: row.sendgridApiKey,
    emailFrom: row.emailFrom,
    internalNotifyEmails: row.internalNotifyEmails,
    customerConfirmationEnabled: row.customerConfirmationEnabled,
    customerConfirmationSubject: row.customerConfirmationSubject,
    customerConfirmationHtml: row.customerConfirmationHtml,
    internalNotifySubject: row.internalNotifySubject,
    internalNotifyHtml: row.internalNotifyHtml,
  };
}
