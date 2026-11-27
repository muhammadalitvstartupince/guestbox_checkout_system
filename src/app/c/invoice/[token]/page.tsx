import Image from "next/image";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { logInvoiceEvent } from "@/lib/invoices/log-event";
import { getClientIp, getUserAgent } from "@/lib/http/client-info";
import { InvoicePaymentForm } from "./InvoicePaymentForm";

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function InvoicePaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { token },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });

  if (!invoice) notFound();

  // Log view with IP + user agent
  const h = await headers();
  const ip = getClientIp(h);
  const ua = getUserAgent(h);
  await logInvoiceEvent(invoice.id, "viewed", [ip && `IP: ${ip}`, ua && `UA: ${ua}`].filter(Boolean).join(" | ") || undefined);

  const isExpired = invoice.status === "expired" || (invoice.expiresAt && invoice.expiresAt < new Date());
  if (isExpired && invoice.status !== "expired") {
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "expired" } });
  }

  const logo = <Image src="/pages_Images/GuestBox-Logo-5v2.png" alt="GuestBox" width={160} height={45} className="mx-auto h-10 w-auto" />;
  const footer = <><Image src="/pages_Images/GuestBox-Logo-5v2.png" alt="GuestBox" width={100} height={28} className="mx-auto mb-2 h-6 w-auto opacity-60" /><p className="text-[10px] text-zinc-400">&copy; 2026 GuestBox Inc. All rights reserved.</p></>;

  if (invoice.status === "paid") {
    return (
      <Wrapper header={logo} footer={footer}>
        <StatusCard icon="✓" bg="bg-emerald-100" color="text-emerald-600" title="Payment Complete" subtitle={`Invoice ${invoice.invoiceNumber} has been paid. Thank you!`} />
      </Wrapper>
    );
  }
  if (invoice.status === "voided") {
    return <Wrapper header={logo} footer={footer}><StatusCard icon="✕" bg="bg-red-100" color="text-red-600" title="Invoice Voided" subtitle="This invoice has been cancelled." /></Wrapper>;
  }
  if (isExpired) {
    return <Wrapper header={logo} footer={footer}><StatusCard icon="⏰" bg="bg-amber-100" color="text-amber-600" title="Invoice Expired" subtitle={`This invoice expired on ${invoice.expiresAt?.toISOString().slice(0, 10)}. Please contact us for a new invoice.`} /></Wrapper>;
  }

  return (
    <Wrapper header={logo} footer={footer}>
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-zinc-900">Invoice {invoice.invoiceNumber}</h1>
        <p className="mt-1 text-sm text-zinc-500">From GuestBox</p>
      </div>

      {/* Line Items Summary */}
      <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-xs uppercase tracking-wider text-zinc-400">
              <th className="pb-2 text-left font-medium">Item</th>
              <th className="pb-2 text-center font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((li) => (
              <tr key={li.id} className="border-b border-zinc-50 last:border-0">
                <td className="py-3 text-zinc-800">{li.description}</td>
                <td className="py-3 text-center text-zinc-600">{li.quantity}</td>
                <td className="py-3 text-right font-medium text-zinc-800">{formatCents(li.totalCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {(invoice.discountCents > 0 || invoice.shippingCents > 0) && (
              <>
                <tr>
                  <td colSpan={2} className="pt-3 text-right text-zinc-500">Subtotal</td>
                  <td className="pt-3 text-right text-zinc-500">{formatCents(invoice.subtotalCents)}</td>
                </tr>
                {invoice.discountCents > 0 && (
                  <tr>
                    <td colSpan={2} className="pt-1 text-right text-emerald-600">Discount</td>
                    <td className="pt-1 text-right text-emerald-600">−{formatCents(invoice.discountCents)}</td>
                  </tr>
                )}
                {invoice.shippingCents > 0 && (
                  <tr>
                    <td colSpan={2} className="pt-1 text-right text-zinc-500">
                      Shipping{invoice.shippingCarrier ? ` (${invoice.shippingCarrier}${invoice.shippingEstDays ? ` ~${invoice.shippingEstDays} days` : ""})` : ""}
                    </td>
                    <td className="pt-1 text-right text-zinc-500">+{formatCents(invoice.shippingCents)}</td>
                  </tr>
                )}
              </>
            )}
            <tr>
              <td colSpan={2} className="border-t border-zinc-200 pt-3 text-right text-base font-bold text-zinc-900">Total Due</td>
              <td className="border-t border-zinc-200 pt-3 text-right text-lg font-bold text-zinc-900">{formatCents(invoice.totalCents)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Plan info */}
      {invoice.selectedPlanName && (
        <div className={`mb-6 rounded-xl border-l-4 p-4 ${invoice.selectedPlanInterval === "monthly" ? "border-blue-500 bg-blue-50" : "border-violet-500 bg-violet-50"}`}>
          <p className={`text-sm font-semibold ${invoice.selectedPlanInterval === "monthly" ? "text-blue-800" : "text-violet-800"}`}>
            Billing Plan: {invoice.selectedPlanName} ({invoice.selectedPlanInterval === "monthly" ? "Monthly" : "Annual"})
          </p>
          <p className={`mt-0.5 text-xs ${invoice.selectedPlanInterval === "monthly" ? "text-blue-700" : "text-violet-700"}`}>
            {invoice.selectedPlanInterval === "monthly"
              ? `${formatCents(invoice.selectedPlanPriceCents ?? 0)}/mo per listing — 1st month free, billing starts after first month.`
              : `${formatCents(invoice.selectedPlanPriceCents ?? 0)}/yr per listing — included in total above.`}
          </p>
        </div>
      )}

      {invoice.customerNotes && (
        <p className="mb-6 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">{invoice.customerNotes}</p>
      )}

      {invoice.expiresAt && (
        <p className="mb-6 text-center text-xs text-zinc-400">Expires {invoice.expiresAt.toISOString().slice(0, 10)}</p>
      )}

      {/* Payment form */}
      <InvoicePaymentForm
        token={invoice.token}
        totalCents={invoice.totalCents}
        hasAddress={!!(invoice.addressLine1 && invoice.city && invoice.state && invoice.zip && invoice.country)}
        defaultAddress={{
          addressLine1: invoice.addressLine1 ?? "",
          city: invoice.city ?? "",
          state: invoice.state ?? "",
          zip: invoice.zip ?? "",
          country: invoice.country ?? "",
        }}
        defaultShipping={{
          sameAsBilling: invoice.shippingSameAsBilling,
          addressLine1: invoice.shippingAddressLine1 ?? "",
          city: invoice.shippingCity ?? "",
          state: invoice.shippingState ?? "",
          zip: invoice.shippingZip ?? "",
          country: invoice.shippingCountry ?? "",
        }}
      />

      {/* Trust badges */}
      <div className="mt-8 flex items-center justify-center gap-6 text-zinc-400">
        <div className="flex items-center gap-1.5">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          <div className="text-left leading-tight">
            <p className="text-[10px] font-semibold text-zinc-500">Secure Payment</p>
            <p className="text-[9px] text-zinc-400">256-bit encryption</p>
          </div>
        </div>
        <div className="h-6 w-px bg-zinc-200" />
        <div className="flex items-center gap-1.5">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          <div className="text-left leading-tight">
            <p className="text-[10px] font-semibold text-zinc-500">Protected</p>
            <p className="text-[9px] text-zinc-400">Your data is safe</p>
          </div>
        </div>
        <div className="h-6 w-px bg-zinc-200" />
        <div className="flex items-center gap-1.5">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
          <div className="text-left leading-tight">
            <p className="text-[10px] font-semibold text-zinc-500">Major Cards</p>
            <p className="text-[9px] text-zinc-400">Visa, MC, Amex</p>
          </div>
        </div>
      </div>

    </Wrapper>
  );
}

function Wrapper({ children, header, footer }: { children: React.ReactNode; header?: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center px-4 py-8">
      <div className="absolute inset-0 -z-20" style={{ background: "radial-gradient(ellipse at center, #05AEEF, #000000)" }} />
      <div className="absolute inset-0 -z-10 bg-black/75" />
      {header && <div className="mb-6 text-center">{header}</div>}
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8">{children}</div>
      {footer && <div className="mt-6 text-center">{footer}</div>}
    </div>
  );
}

function StatusCard({ icon, bg, color, title, subtitle }: { icon: string; bg: string; color: string; title: string; subtitle: string }) {
  return (
    <div className="text-center">
      <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${bg}`}>
        <span className={`text-2xl ${color}`}>{icon}</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
      <p className="mt-2 text-zinc-600">{subtitle}</p>
    </div>
  );
}
