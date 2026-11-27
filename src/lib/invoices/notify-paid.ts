import { prisma } from "@/lib/db/client";
import { logInvoiceEvent } from "./log-event";

export async function processInvoicePaidSlack(): Promise<{ found: number; notified: number }> {
  const settings = await prisma.invoiceSlackSettings.findFirst();
  if (!settings?.enabled || !settings.slackWebhookUrl) return { found: 0, notified: 0 };
  const webhookUrl = settings.slackWebhookUrl;

  // Find paid invoices that haven't been Slack-notified yet
  // (no "slack_notified" event in their event log)
  const paidInvoices = await prisma.invoice.findMany({
    where: {
      status: "paid",
      events: { none: { type: "slack_notified" } },
    },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });

  if (paidInvoices.length === 0) return { found: 0, notified: 0 };

  let notified = 0;
  const f = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  for (const inv of paidInvoices) {
    const linesSummary = inv.lineItems.map((li) => `${li.description} ×${li.quantity} = ${f(li.totalCents)}`).join("\n");

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: [
            {
              type: "header",
              text: { type: "plain_text", text: "💰 Invoice Paid", emoji: true },
            },
            {
              type: "section",
              fields: [
                { type: "mrkdwn", text: `*Invoice:*\n${inv.invoiceNumber}` },
                { type: "mrkdwn", text: `*Total:*\n${f(inv.totalCents)}` },
                { type: "mrkdwn", text: `*Name:*\n${inv.firstName} ${inv.lastName}` },
                { type: "mrkdwn", text: `*Email:*\n${inv.email}` },
                { type: "mrkdwn", text: `*Phone:*\n${inv.phone ?? "—"}` },
                { type: "mrkdwn", text: `*Country:*\n${inv.country ?? "—"}` },
              ],
            },
            {
              type: "section",
              text: { type: "mrkdwn", text: `*Line Items:*\n${linesSummary}` },
            },
            ...(inv.selectedPlanName
              ? [{
                  type: "section" as const,
                  text: { type: "mrkdwn" as const, text: `*Plan:* ${inv.selectedPlanName} (${inv.selectedPlanInterval}) — ${f(inv.selectedPlanPriceCents ?? 0)}/listing × ${inv.listingQty}` },
                }]
              : []),
            {
              type: "context",
              elements: [
                { type: "mrkdwn", text: `Paid at ${inv.paidAt?.toISOString().slice(0, 16).replace("T", " ") ?? "—"} | Card: ${inv.cardBrand ?? ""} ****${inv.cardLast4 ?? ""}` },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(10_000),
      });

      await logInvoiceEvent(inv.id, "slack_notified", "Paid invoice Slack alert sent");
      notified++;
    } catch (err) {
      console.error(`Invoice paid Slack notification failed for ${inv.id}:`, err);
    }
  }

  return { found: paidInvoices.length, notified };
}
