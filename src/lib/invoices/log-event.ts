import { prisma } from "@/lib/db/client";

export type InvoiceEventType =
  | "created"
  | "sent"
  | "address_saved"
  | "payment_attempted"
  | "payment_succeeded"
  | "payment_failed"
  | "zoho_synced"
  | "zoho_failed"
  | "customer_email_sent"
  | "customer_email_failed"
  | "internal_email_sent"
  | "internal_email_failed"
  | "webhook_sent"
  | "webhook_failed"
  | "updated"
  | "voided"
  | "viewed"
  | "slack_notified";

export async function logInvoiceEvent(invoiceId: string, type: InvoiceEventType, message?: string): Promise<void> {
  try {
    await prisma.invoiceEvent.create({ data: { invoiceId, type, message } });
  } catch (err) {
    console.error("Failed to log invoice event", { invoiceId, type, err });
  }
}
