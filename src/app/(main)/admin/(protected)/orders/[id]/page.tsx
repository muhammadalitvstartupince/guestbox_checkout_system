import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { RevealCardPanel } from "@/components/admin/RevealCardPanel";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { OrderTimeline } from "@/components/admin/OrderTimeline";
import { retryZohoSync, resendConfirmationEmail } from "./actions";

function formatCents(cents: number | null) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyAdminSession();
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      checkoutPage: { select: { title: true, type: true, upgradeTitle: true, webhookUrl: true, basePriceCents: true, priceTiers: { orderBy: { sortOrder: "asc" as const } } } },
      promoCode: { select: { code: true, discountType: true, discountValue: true } },
      orderAddons: { include: { addon: { select: { name: true } } } },
      cardAccessLogs: {
        orderBy: { viewedAt: "desc" },
        include: { adminUser: { select: { email: true } } },
      },
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!order) notFound();

  const billingPlan = order.selectedBillingPlanId
    ? await prisma.billingPlan.findUnique({ where: { id: order.selectedBillingPlanId }, select: { label: true, interval: true, priceCents: true } })
    : null;

  // Check if this order was placed during an active promotion
  const activePromo = await prisma.promotion.findFirst({
    where: {
      checkoutPages: { some: { checkoutPageId: order.checkoutPageId } },
      promoCodeId: order.promoCodeId ?? undefined,
    },
    include: {
      priceTier: { select: { priceCents: true } },
      promoCode: { select: { discountType: true, discountValue: true } },
    },
  });

  // Resolve per-unit device price — use promo price when a promotion was applied
  let unitPriceCents = order.checkoutPage.basePriceCents;
  let promoOriginalPriceCents: number | null = null;
  if (activePromo && order.promoCodeId === activePromo.promoCodeId) {
    // This order used the promotion — show promo price as the unit price
    const origPrice = activePromo.priceTier.priceCents;
    const disc = activePromo.promoCode.discountType === "percent"
      ? Math.round((origPrice * activePromo.promoCode.discountValue) / 100)
      : activePromo.promoCode.discountValue;
    unitPriceCents = Math.max(0, origPrice - disc);
    promoOriginalPriceCents = origPrice;
  } else if (order.checkoutPage.priceTiers.length > 0) {
    const matchedTier = order.checkoutPage.priceTiers.find(
      (t) => order.quantity >= t.minQty && (t.maxQty == null || order.quantity <= t.maxQty),
    );
    if (matchedTier) unitPriceCents = matchedTier.priceCents;
  }

  const productName = order.upgradeSelected && order.checkoutPage.upgradeTitle
    ? order.checkoutPage.upgradeTitle
    : order.checkoutPage.title;

  // Compute tier (bulk) discount for display
  const baseTier = order.checkoutPage.priceTiers.find((t) => t.isBase);
  const tierDiscountPerUnit = baseTier && !promoOriginalPriceCents
    ? Math.max(0, baseTier.priceCents - unitPriceCents)
    : 0;

  // Compute promo discount for display — skip when promotion handled it
  let promoDiscountLabel: string | null = null;
  if (order.promoCode && !promoOriginalPriceCents) {
    const p = order.promoCode;
    const addonsCents = order.orderAddons.reduce((sum, a) => sum + a.priceCents, 0);
    const subtotal = unitPriceCents * order.quantity + addonsCents;
    if (p.discountType === "percent") {
      const discountCents = Math.round((subtotal * p.discountValue) / 100);
      promoDiscountLabel = `${p.discountValue}% off (−${formatCents(discountCents)})`;
    } else {
      promoDiscountLabel = `−${formatCents(p.discountValue)}`;
    }
  }

  const billingAddress = order.addressLine1
    ? `${order.addressLine1}, ${order.city}, ${order.state} ${order.zip}, ${order.country}`
    : "Not provided yet — checkout in progress";

  const shippingAddress = order.shippingSameAsBilling
    ? null
    : order.shippingAddressLine1
      ? `${order.shippingAddressLine1}, ${order.shippingCity}, ${order.shippingState} ${order.shippingZip}, ${order.shippingCountry}`
      : null;

  const lastWebhookEvent = [...order.events].reverse().find((e) => e.type === "webhook_sent" || e.type === "webhook_failed");
  const webhookDataSent = !order.checkoutPage.webhookUrl
    ? "—"
    : lastWebhookEvent?.type === "webhook_sent"
      ? `Yes — ${lastWebhookEvent.createdAt.toISOString().slice(0, 16).replace("T", " ")}`
      : lastWebhookEvent?.type === "webhook_failed"
        ? `Failed — ${lastWebhookEvent.message ?? "Unknown error"}`
        : "Not sent yet";

  const lastConfirmationEmailEvent = [...order.events]
    .reverse()
    .find((e) => e.type === "customer_email_sent" || e.type === "customer_email_failed");
  const confirmationEmailStatus = !lastConfirmationEmailEvent
    ? "Not sent yet"
    : lastConfirmationEmailEvent.type === "customer_email_sent"
      ? `Sent — ${lastConfirmationEmailEvent.createdAt.toISOString().slice(0, 16).replace("T", " ")}`
      : `Failed — ${lastConfirmationEmailEvent.message ?? "Unknown error"}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {order.firstName} {order.lastName}
        </h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          {productName}
          {order.upgradeSelected && (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-500/10 dark:text-violet-400">
              Upgraded
            </span>
          )}
          — {order.createdAt.toISOString().slice(0, 16).replace("T", " ")}
          <OrderStatusBadge status={order.status} />
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card title="Customer">
          <dl className="space-y-1.5 text-sm">
            <Row label="Email" value={order.email} />
            <Row label="Phone" value={order.phone} />
            <Row label="Billing address" value={billingAddress} />
            <Row label="Shipping address" value={shippingAddress ?? "Same as billing"} />
          </dl>
          <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <dt className="text-sm text-zinc-500 dark:text-zinc-400">Landing page (source)</dt>
            <dd className="mt-0.5 text-xs break-all text-zinc-700 dark:text-zinc-300">
              {order.landingUrl ?? "Not recorded"}
            </dd>
          </div>
          <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <dt className="text-sm text-zinc-500 dark:text-zinc-400">IP address</dt>
            <dd className="mt-0.5 text-xs break-all text-zinc-700 dark:text-zinc-300">
              {order.ipAddress ?? "Not recorded"}
            </dd>
          </div>
          <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <dt className="text-sm text-zinc-500 dark:text-zinc-400">User agent</dt>
            <dd className="mt-0.5 text-xs break-all text-zinc-700 dark:text-zinc-300">
              {order.userAgent ?? "Not recorded"}
            </dd>
          </div>
        </Card>

        <Card title="Order">
          <dl className="space-y-1.5 text-sm">
            <Row label="Product" value={productName} />
            <Row label="Status" value={order.status} />
            <Row label="Quantity" value={String(order.quantity)} />
            <Row
              label="Unit price"
              value={
                promoOriginalPriceCents
                  ? `${formatCents(unitPriceCents)} × ${order.quantity} = ${formatCents(unitPriceCents * order.quantity)} (was ${formatCents(promoOriginalPriceCents)}/ea — promo)`
                  : `${formatCents(unitPriceCents)} × ${order.quantity} = ${formatCents(unitPriceCents * order.quantity)}`
              }
            />
            <Row label="Billing type" value={billingPlan ? `${billingPlan.label} (${billingPlan.interval})` : "—"} />
            {billingPlan && (() => {
              const isAnnual = billingPlan.interval === "annually";
              const listingCount = isAnnual
                ? (order.recurringAmountCents && billingPlan.priceCents > 0
                    ? Math.round(order.recurringAmountCents / billingPlan.priceCents)
                    : 1)
                : order.quantity;
              const intervalLabel = isAnnual ? "year" : "month";
              return (
                <Row label="Plan price" value={`${formatCents(billingPlan.priceCents)}/${intervalLabel} × ${listingCount} ${listingCount === 1 ? "listing" : "listings"}`} />
              );
            })()}
            <Row label="Recurring total" value={formatCents(order.recurringAmountCents)} />
            {order.orderAddons.length > 0 && (
              <Row
                label="Add-ons"
                value={order.orderAddons.map((a) => `${a.addon.name} (${formatCents(a.priceCents)})`).join(", ")}
              />
            )}
            {tierDiscountPerUnit > 0 && (
              <Row label="Bulk discount" value={`−${formatCents(tierDiscountPerUnit)}/ea × ${order.quantity} = −${formatCents(tierDiscountPerUnit * order.quantity)} (base ${formatCents(baseTier!.priceCents)}/ea)`} />
            )}
            <Row label="Promo code" value={order.promoCode?.code ?? "—"} />
            {promoOriginalPriceCents ? (
              <Row label="Discount" value={`Promotion: −${formatCents((promoOriginalPriceCents - unitPriceCents) * order.quantity)} (${formatCents(promoOriginalPriceCents - unitPriceCents)}/ea × ${order.quantity})`} />
            ) : promoDiscountLabel ? (
              <Row label="Discount" value={promoDiscountLabel} />
            ) : null}
          </dl>
          <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
            <div className="flex justify-between text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <span>Total charged</span>
              <span>{formatCents(order.amountCents)}</span>
            </div>
          </div>
        </Card>

        <Card title="Authorize.net">
          <dl className="space-y-1.5 text-sm">
            <Row label="Response code" value={order.authNetResponseCode ?? "—"} />
            <Row label="Auth code" value={order.authNetAuthCode ?? "—"} />
            <Row label="Transaction ID" value={order.authNetTransactionId ?? "—"} />
            <Row label="Message" value={order.authNetMessage ?? "—"} />
          </dl>
        </Card>

        <Card
          title="Zoho Invoice"
          action={
            order.status === "paid" &&
            !order.zohoSynced && (
              <form action={retryZohoSync.bind(null, order.id)}>
                <button
                  type="submit"
                  className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Retry Sync
                </button>
              </form>
            )
          }
        >
          <dl className="space-y-1.5 text-sm">
            <Row label="Synced" value={order.zohoSynced ? "Yes" : "No"} />
          </dl>
          {order.zohoPayload != null && (
            <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <dt className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Payload Sent</dt>
              <pre className="overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {JSON.stringify(order.zohoPayload, null, 2)}
              </pre>
            </div>
          )}
          {order.zohoResponse != null && (
            <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <dt className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Response</dt>
              <pre className="overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {JSON.stringify(order.zohoResponse, null, 2)}
              </pre>
            </div>
          )}
        </Card>

        <Card
          title="Confirmation Email"
          action={
            order.status === "paid" && (
              <form action={resendConfirmationEmail.bind(null, order.id)}>
                <button type="submit" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                  Resend
                </button>
              </form>
            )
          }
        >
          <dl className="space-y-1.5 text-sm">
            <Row label="Sent to" value={order.email} />
            <Row label="Status" value={confirmationEmailStatus} />
          </dl>
        </Card>

        <Card title="Marketing Webhook">
          <dl className="space-y-1.5 text-sm">
            <Row label="Marketing Webhook URL (optional)" value={order.checkoutPage.webhookUrl ?? "Not configured"} />
            <Row label="Data sent" value={webhookDataSent} />
          </dl>
        </Card>
      </div>

      <Card title="Timeline">
        <OrderTimeline events={order.events} />
      </Card>

      {order.cardLast4 ? (
        <RevealCardPanel orderId={order.id} cardLast4={order.cardLast4} cardBrand={order.cardBrand} />
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Card on File</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No card on file — this checkout hasn&rsquo;t reached the payment step yet.
          </p>
        </div>
      )}

      {order.cardAccessLogs.length > 0 && (
        <Card title="Card Access Log">
          <ul className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            {order.cardAccessLogs.map((log) => (
              <li key={log.id}>
                {log.viewedAt.toISOString().slice(0, 16).replace("T", " ")} — {log.adminUser.email}
                {log.ipAddress ? ` (${log.ipAddress})` : ""}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-right text-zinc-900 dark:text-zinc-100">{value}</dd>
    </div>
  );
}
