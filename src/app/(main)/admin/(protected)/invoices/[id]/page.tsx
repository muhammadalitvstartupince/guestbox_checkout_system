import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { voidInvoice, sendInvoiceEmail, retryInvoiceZohoSync } from "../actions";
import { revealInvoiceCard } from "./actions";
import { CopyPaymentLink } from "./CopyPaymentLink";
import { RevealCardPanel } from "@/components/admin/RevealCardPanel";

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  sent: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  expired: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  voided: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyAdminSession();
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
      createdBy: { select: { email: true } },
    },
  });

  if (!invoice) notFound();

  const paymentUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/c/invoice/${invoice.token}`;
  const canSend = invoice.status === "draft" || invoice.status === "sent";
  const canEdit = invoice.status === "draft" || invoice.status === "sent";
  const canVoid = invoice.status !== "paid" && invoice.status !== "voided";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{invoice.invoiceNumber}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            {invoice.firstName} {invoice.lastName} — {invoice.createdAt.toISOString().slice(0, 16).replace("T", " ")}
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[invoice.status] ?? ""}`}>
              {invoice.status}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Link
              href={`/admin/invoices/${invoice.id}/edit`}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Edit
            </Link>
          )}
          {canSend && (
            <form action={sendInvoiceEmail.bind(null, invoice.id)}>
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                {invoice.status === "sent" ? "Resend Email" : "Send Invoice"}
              </button>
            </form>
          )}
          {canVoid && (
            <form action={voidInvoice.bind(null, invoice.id)}>
              <button type="submit" className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-500/10">
                Void
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Payment Link */}
      <Card title="Payment Link">
        <CopyPaymentLink url={paymentUrl} />
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Customer */}
        <Card title="Customer">
          <dl className="space-y-1.5 text-sm">
            <Row label="Name" value={`${invoice.firstName} ${invoice.lastName}`} />
            <Row label="Email" value={invoice.email} />
            {invoice.phone && <Row label="Phone" value={invoice.phone} />}
            {invoice.addressLine1 && (
              <Row label="Shipping address" value={`${invoice.addressLine1}, ${invoice.city}, ${invoice.state} ${invoice.zip}, ${invoice.country}`} />
            )}
            {invoice.taxId && <Row label="Tax ID / RFC" value={invoice.taxId} />}
            <Row
              label="Billing address"
              value={
                invoice.shippingSameAsBilling
                  ? "Same as shipping"
                  : invoice.shippingAddressLine1
                    ? `${invoice.shippingAddressLine1}, ${invoice.shippingCity}, ${invoice.shippingState} ${invoice.shippingZip}, ${invoice.shippingCountry}`
                    : "Not provided"
              }
            />
          </dl>
        </Card>

        {/* Summary */}
        <Card title="Summary">
          <dl className="space-y-1.5 text-sm">
            <Row label="Subtotal" value={formatCents(invoice.subtotalCents)} />
            {invoice.listingQty > 1 && <Row label="Listings" value={String(invoice.listingQty)} />}
            {invoice.selectedPlanName && (
              <Row
                label="Billing plan"
                value={`${invoice.selectedPlanName} (${invoice.selectedPlanInterval})${invoice.selectedPlanInterval === "monthly" ? ` — ${formatCents(invoice.selectedPlanPriceCents ?? 0)}/mo, 1st month free` : ""}`}
              />
            )}
            {invoice.discountCents > 0 && (
              <Row label={`Discount${invoice.discountLabel ? ` (${invoice.discountLabel})` : ""}`} value={`−${formatCents(invoice.discountCents)}`} />
            )}
            {invoice.shippingCents > 0 && (
              <Row
                label="Shipping"
                value={`${formatCents(invoice.shippingCents)}${invoice.shippingCarrier ? ` — ${invoice.shippingCarrier} ${invoice.shippingService ?? ""}` : ""}${invoice.shippingEstDays ? ` (~${invoice.shippingEstDays} days)` : ""}`}
              />
            )}
            <Row label="Total" value={formatCents(invoice.totalCents)} />
            {invoice.expiresAt && <Row label="Expires" value={invoice.expiresAt.toISOString().slice(0, 10)} />}
            <Row label="Created by" value={invoice.createdBy.email} />
            {invoice.successRedirectUrl && <Row label="Redirect URL" value={invoice.successRedirectUrl} />}
            {invoice.webhookUrl && <Row label="Webhook URL" value={invoice.webhookUrl} />}
          </dl>
        </Card>

        {/* Payment info (if paid) */}
        {invoice.status === "paid" && (
          <Card title="Payment">
            <dl className="space-y-1.5 text-sm">
              <Row label="Paid at" value={invoice.paidAt?.toISOString().slice(0, 16).replace("T", " ") ?? "—"} />
              <Row label="Card" value={invoice.cardBrand ? `${invoice.cardBrand} ****${invoice.cardLast4}` : "—"} />
              <Row label="Auth code" value={invoice.authNetAuthCode ?? "—"} />
              <Row label="Transaction ID" value={invoice.authNetTransactionId ?? "—"} />
              <Row label="Message" value={invoice.authNetMessage ?? "—"} />
            </dl>
          </Card>
        )}

        {/* Zoho */}
        <Card
          title="Zoho"
          action={
            invoice.status === "paid" && !invoice.zohoSynced ? (
              <form action={retryInvoiceZohoSync.bind(null, invoice.id)}>
                <button type="submit" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                  Retry Sync
                </button>
              </form>
            ) : undefined
          }
        >
          <dl className="space-y-1.5 text-sm">
            <Row label="Synced" value={invoice.zohoSynced ? "Yes" : "No"} />
          </dl>
          {invoice.zohoPayload != null && (
            <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <dt className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{invoice.zohoSynced ? "Payload Sent" : "Attempted Payload"}</dt>
              <pre className="overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {JSON.stringify(invoice.zohoPayload, null, 2)}
              </pre>
            </div>
          )}
          {invoice.zohoResponse != null && (
            <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <dt className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Response</dt>
              <pre className="overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {JSON.stringify(invoice.zohoResponse, null, 2)}
              </pre>
            </div>
          )}
        </Card>

        {/* Webhook */}
        {invoice.webhookUrl && (
          <Card title="Marketing Webhook">
            <dl className="space-y-1.5 text-sm">
              <Row label="URL" value={invoice.webhookUrl} />
              <Row label="Status" value={invoice.webhookPayload ? (invoice.webhookResponse && typeof invoice.webhookResponse === "object" && "error" in (invoice.webhookResponse as Record<string, unknown>) ? "Failed" : "Sent") : "Not sent"} />
            </dl>
            {invoice.webhookPayload != null && (
              <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <dt className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Payload Sent</dt>
                <pre className="overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {JSON.stringify(invoice.webhookPayload, null, 2)}
                </pre>
              </div>
            )}
            {invoice.webhookResponse != null && (
              <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <dt className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Response</dt>
                <pre className="overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {JSON.stringify(invoice.webhookResponse, null, 2)}
                </pre>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Card Reveal */}
      {invoice.status === "paid" && invoice.cardLast4 && (
        <RevealCardPanel orderId={invoice.id} cardLast4={invoice.cardLast4} cardBrand={invoice.cardBrand} action={revealInvoiceCard} />
      )}

      {/* Line Items */}
      <Card title="Line Items">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="pb-2 text-left font-medium">Description</th>
                <th className="pb-2 text-center font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Unit Price</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((li) => (
                <tr key={li.id} className="border-b border-zinc-50 last:border-0 dark:border-zinc-800/60">
                  <td className="py-2 text-zinc-900 dark:text-zinc-100">{li.description}</td>
                  <td className="py-2 text-center text-zinc-600 dark:text-zinc-400">{li.quantity}</td>
                  <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">{formatCents(li.unitPriceCents)}</td>
                  <td className="py-2 text-right font-medium text-zinc-900 dark:text-zinc-100">{formatCents(li.totalCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-3 text-right text-zinc-500 dark:text-zinc-400">Subtotal</td>
                <td className="pt-3 text-right text-zinc-500 dark:text-zinc-400">{formatCents(invoice.subtotalCents)}</td>
              </tr>
              {invoice.discountCents > 0 && (
                <tr>
                  <td colSpan={3} className="pt-1 text-right text-emerald-600 dark:text-emerald-400">
                    Discount{invoice.discountLabel ? ` (${invoice.discountLabel})` : ""}
                  </td>
                  <td className="pt-1 text-right text-emerald-600 dark:text-emerald-400">−{formatCents(invoice.discountCents)}</td>
                </tr>
              )}
              {invoice.shippingCents > 0 && (
                <tr>
                  <td colSpan={3} className="pt-1 text-right text-zinc-500 dark:text-zinc-400">
                    Shipping{invoice.shippingCarrier ? ` (${invoice.shippingCarrier}${invoice.shippingEstDays ? ` ~${invoice.shippingEstDays} days` : ""})` : ""}
                  </td>
                  <td className="pt-1 text-right text-zinc-500 dark:text-zinc-400">+{formatCents(invoice.shippingCents)}</td>
                </tr>
              )}
              {invoice.selectedPlanName && (
                <tr>
                  <td colSpan={3} className="pt-1 text-right text-blue-500 dark:text-blue-400">
                    {invoice.selectedPlanName} ({invoice.selectedPlanInterval}) — {invoice.selectedPlanInterval === "monthly"
                      ? `${formatCents(invoice.selectedPlanPriceCents ?? 0)}/mo`
                      : `${formatCents(invoice.selectedPlanPriceCents ?? 0)}/yr`}
                  </td>
                  <td className="pt-1 text-right text-xs text-blue-500 dark:text-blue-400">
                    {invoice.selectedPlanInterval === "monthly" ? "recurring" : "included above"}
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan={3} className="border-t border-zinc-200 pt-3 text-right font-bold text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">Total Due</td>
                <td className="border-t border-zinc-200 pt-3 text-right text-lg font-bold text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">{formatCents(invoice.totalCents)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Notes */}
      {(invoice.adminNotes || invoice.customerNotes) && (
        <Card title="Notes">
          <dl className="space-y-1.5 text-sm">
            {invoice.adminNotes && <Row label="Admin notes" value={invoice.adminNotes} />}
            {invoice.customerNotes && <Row label="Customer notes" value={invoice.customerNotes} />}
          </dl>
        </Card>
      )}

      {/* Timeline */}
      <Card title="Timeline">
        {invoice.events.length === 0 ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">No events yet.</p>
        ) : (
          <ul className="space-y-2">
            {invoice.events.map((ev) => (
              <li key={ev.id} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{ev.type}</span>
                  {ev.message && <span className="ml-2 text-zinc-500 dark:text-zinc-400">— {ev.message}</span>}
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {ev.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
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
