const EVENT_META: Record<string, { label: string; tone: "neutral" | "success" | "error" }> = {
  order_initiated: { label: "Checkout started", tone: "neutral" },
  billing_info_saved: { label: "Billing address saved", tone: "neutral" },
  payment_attempted: { label: "Payment attempted", tone: "neutral" },
  payment_succeeded: { label: "Payment succeeded", tone: "success" },
  payment_failed: { label: "Payment declined", tone: "error" },
  promo_applied: { label: "Promo code applied", tone: "neutral" },
  zoho_synced: { label: "Zoho invoice synced", tone: "success" },
  zoho_failed: { label: "Zoho invoice sync failed", tone: "error" },
  customer_email_sent: { label: "Confirmation email sent", tone: "success" },
  customer_email_failed: { label: "Confirmation email failed", tone: "error" },
  internal_email_sent: { label: "Internal notification sent", tone: "success" },
  internal_email_failed: { label: "Internal notification failed", tone: "error" },
  webhook_sent: { label: "Webhook sent", tone: "success" },
  webhook_failed: { label: "Webhook failed", tone: "error" },
  abandoned_notified: { label: "Abandoned checkout alert sent", tone: "neutral" },
};

const DOT_COLOR: Record<string, string> = {
  neutral: "bg-zinc-400 dark:bg-zinc-500",
  success: "bg-emerald-500 dark:bg-emerald-400",
  error: "bg-red-500 dark:bg-red-400",
};

export interface OrderEventView {
  id: string;
  type: string;
  message: string | null;
  createdAt: Date;
}

function formatTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function OrderTimeline({ events }: { events: OrderEventView[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No activity recorded yet.</p>;
  }

  return (
    <ol className="space-y-4">
      {events.map((event) => {
        const meta = EVENT_META[event.type] ?? { label: event.type, tone: "neutral" as const };
        return (
          <li key={event.id} className="flex gap-3">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT_COLOR[meta.tone]}`} />
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{meta.label}</p>
              {event.message && <p className="text-xs text-zinc-500 dark:text-zinc-400">{event.message}</p>}
              <p className="text-xs text-zinc-400 dark:text-zinc-500">{formatTimestamp(event.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
