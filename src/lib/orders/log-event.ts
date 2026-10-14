import { prisma } from "@/lib/db/client";

/**
 * Fixed vocabulary of order lifecycle events, shown as a timeline on the
 * admin order detail page. Keep this in sync with ORDER_EVENT_LABELS in
 * components/admin/OrderTimeline.tsx.
 */
export type OrderEventType =
  | "order_initiated"
  | "billing_info_saved"
  | "payment_attempted"
  | "payment_succeeded"
  | "payment_failed"
  | "promo_applied"
  | "zoho_synced"
  | "zoho_failed"
  | "customer_email_sent"
  | "customer_email_failed"
  | "internal_email_sent"
  | "internal_email_failed"
  | "webhook_sent"
  | "webhook_failed";

/**
 * Records a timeline entry. Never throws — a logging failure must not be
 * able to break checkout or any admin action that calls it.
 */
export async function logOrderEvent(orderId: string, type: OrderEventType, message?: string): Promise<void> {
  try {
    await prisma.orderEvent.create({ data: { orderId, type, message } });
  } catch (err) {
    console.error("Failed to log order event", { orderId, type, err });
  }
}
