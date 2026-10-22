import { prisma } from "@/lib/db/client";
import { logOrderEvent } from "@/lib/orders/log-event";

export interface NotifyResult {
  notified: number;
  found: number;
}

export async function processAbandonedCheckouts(): Promise<NotifyResult> {
  const settings = await prisma.abandonedCheckoutSettings.findFirst();
  if (!settings?.enabled) return { found: 0, notified: 0 };

  const cutoff = new Date(Date.now() - settings.timeoutMinutes * 60_000);

  const abandonedOrders = await prisma.order.findMany({
    where: {
      status: "pending",
      abandonedNotifiedAt: null,
      createdAt: { lt: cutoff },
    },
    include: {
      checkoutPage: { select: { title: true, productName: true } },
    },
  });

  if (abandonedOrders.length === 0) return { found: 0, notified: 0 };

  let notified = 0;

  for (const order of abandonedOrders) {
    if (settings.slackWebhookUrl) {
      const minutesAgo = Math.round((Date.now() - order.createdAt.getTime()) / 60_000);
      const productName = order.checkoutPage.productName || order.checkoutPage.title;
      const estTotal = order.amountCents != null ? `$${(order.amountCents / 100).toFixed(2)}` : "N/A";

      try {
        await fetch(settings.slackWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blocks: [
              {
                type: "header",
                text: { type: "plain_text", text: "🛒 Abandoned Checkout", emoji: true },
              },
              {
                type: "section",
                fields: [
                  { type: "mrkdwn", text: `*Name:*\n${order.firstName} ${order.lastName}` },
                  { type: "mrkdwn", text: `*Email:*\n${order.email}` },
                  { type: "mrkdwn", text: `*Phone:*\n${order.phone}` },
                  { type: "mrkdwn", text: `*Product:*\n${productName}` },
                  { type: "mrkdwn", text: `*Qty:*\n${order.quantity}` },
                  { type: "mrkdwn", text: `*Est. Total:*\n${estTotal}` },
                ],
              },
              {
                type: "context",
                elements: [
                  { type: "mrkdwn", text: `⏱️ Started checkout ${minutesAgo} min ago | Order ID: ${order.id}` },
                ],
              },
            ],
          }),
        });
      } catch (err) {
        console.error(`Slack notification failed for order ${order.id}:`, err);
      }
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { abandonedNotifiedAt: new Date() },
    });
    await logOrderEvent(order.id, "abandoned_notified", "Slack alert sent to sales team");
    notified++;
  }

  return { found: abandonedOrders.length, notified };
}
