"use client";

import { useActionState, useState, useEffect } from "react";
import { saveInvoiceAddress, payInvoice } from "./actions";
import { detectCardBrand } from "@/lib/payments/card-brand";
import { isValidLuhn } from "@/lib/payments/luhn";

function formatCardNumberInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function CardBrandIcon({ brand }: { brand: string | null }) {
  switch (brand) {
    case "visa":
      return <span className="text-xs font-black tracking-tight text-blue-800 italic">VISA</span>;
    case "mastercard":
      return (
        <span className="flex -space-x-2">
          <span className="h-4 w-4 rounded-full bg-red-500" />
          <span className="h-4 w-4 rounded-full bg-amber-400 opacity-90" />
        </span>
      );
    case "amex":
      return <span className="text-[10px] font-extrabold tracking-tight text-sky-700">AMEX</span>;
    case "discover":
      return <span className="text-[10px] font-extrabold tracking-tight text-orange-600">DISC</span>;
    default:
      return (
        <svg className="h-5 w-5 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      );
  }
}

interface Props {
  token: string;
  totalCents: number;
  hasAddress: boolean;
  defaultAddress: {
    addressLine1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  defaultShipping: {
    sameAsBilling: boolean;
    addressLine1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

export function InvoicePaymentForm({ token, totalCents, hasAddress, defaultAddress, defaultShipping }: Props) {
  const [step, setStep] = useState<"address" | "payment">(hasAddress ? "payment" : "address");
  const [sameAsBilling, setSameAsBilling] = useState(defaultShipping.sameAsBilling);
  const [cardNumber, setCardNumber] = useState("");
  const [cvv, setCvv] = useState("");
  const cardDigits = cardNumber.replace(/\D/g, "");
  const cardBrand = detectCardBrand(cardDigits);
  const cardLooksValid = cardDigits.length >= 13 && isValidLuhn(cardDigits);

  const [addressState, addressAction, addressPending] = useActionState(
    async (_prev: { error?: string | null }, fd: FormData) => {
      const result = await saveInvoiceAddress(token, _prev, fd);
      if (!result.error) setStep("payment");
      return result;
    },
    { error: null },
  );

  const [payState, payAction, payPending] = useActionState(
    payInvoice.bind(null, token),
    { status: "idle" } as { status: string; message?: string; redirectUrl?: string | null },
  );

  useEffect(() => {
    if (payState.status === "success" && payState.redirectUrl) {
      const timer = setTimeout(() => { window.location.href = payState.redirectUrl!; }, 2000);
      return () => clearTimeout(timer);
    }
  }, [payState]);

  if (payState.status === "success") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-xl font-bold text-zinc-900">Payment Successful!</h2>
        <p className="mt-2 text-sm text-zinc-600">Thank you. A confirmation email has been sent.</p>
        {payState.redirectUrl && <p className="mt-2 text-xs text-zinc-400">Redirecting…</p>}
      </div>
    );
  }

  return (
    <div>
      {/* Step indicators */}
      <div className="mb-6 flex items-center justify-center gap-4 text-sm">
        <span className={step === "address" ? "font-semibold text-indigo-600" : "text-zinc-400"}>1. Address</span>
        <span className="text-zinc-300">&rarr;</span>
        <span className={step === "payment" ? "font-semibold text-indigo-600" : "text-zinc-400"}>2. Payment</span>
      </div>

      {step === "address" && (
        <form action={addressAction} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900">Billing Address</h2>
          {addressState.error && (
            <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{addressState.error}</p>
          )}
          <Input name="addressLine1" label="Address" defaultValue={defaultAddress.addressLine1} required />
          <div className="grid grid-cols-2 gap-3">
            <Input name="city" label="City" defaultValue={defaultAddress.city} required />
            <Input name="state" label="State" defaultValue={defaultAddress.state} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input name="zip" label="ZIP Code" defaultValue={defaultAddress.zip} required />
            <Input name="country" label="Country" defaultValue={defaultAddress.country || "US"} required />
          </div>

          <div className="border-t border-zinc-100 pt-4">
            <label className="mb-3 flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={sameAsBilling}
                onChange={(e) => setSameAsBilling(e.target.checked)}
                className="accent-indigo-600"
              />
              Shipping address same as billing
            </label>
            <input type="hidden" name="shippingSameAsBilling" value={sameAsBilling ? "true" : "false"} />

            {!sameAsBilling && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-zinc-900">Shipping Address</h3>
                <Input name="shippingAddressLine1" label="Address" defaultValue={defaultShipping.addressLine1} required />
                <div className="grid grid-cols-2 gap-3">
                  <Input name="shippingCity" label="City" defaultValue={defaultShipping.city} required />
                  <Input name="shippingState" label="State" defaultValue={defaultShipping.state} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input name="shippingZip" label="ZIP Code" defaultValue={defaultShipping.zip} required />
                  <Input name="shippingCountry" label="Country" defaultValue={defaultShipping.country || "US"} required />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={addressPending}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {addressPending ? "Saving…" : "Continue to Payment"}
          </button>
        </form>
      )}

      {step === "payment" && (
        <form action={payAction} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900">Payment Details</h2>
          {payState.status === "error" && (
            <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{payState.message}</p>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Card Number</label>
            <div className="relative">
              <input
                name="cardNumber"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumberInput(e.target.value))}
                placeholder="1234 5678 9012 3456"
                required
                maxLength={23}
                inputMode="numeric"
                autoComplete="cc-number"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 pr-16 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                <CardBrandIcon brand={cardBrand} />
                {cardLooksValid && (
                  <svg className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Month</label>
              <select name="expMonth" required autoComplete="cc-exp-month" className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                <option value="">MM</option>
                {Array.from({ length: 12 }, (_, i) => { const m = String(i + 1).padStart(2, "0"); return <option key={m} value={m}>{m}</option>; })}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Year</label>
              <select name="expYear" required autoComplete="cc-exp-year" className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                <option value="">YYYY</option>
                {Array.from({ length: 12 }, (_, i) => { const y = String(new Date().getFullYear() + i); return <option key={y} value={y}>{y}</option>; })}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">CVV</label>
              <input
                name="cvv"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="123"
                required
                maxLength={4}
                inputMode="numeric"
                autoComplete="cc-csc"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep("address")}
            className="text-sm text-indigo-600 hover:underline"
          >
            &larr; Edit address
          </button>

          <button
            type="submit"
            disabled={payPending}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {payPending ? "Processing…" : `Pay $${(totalCents / 100).toFixed(2)}`}
          </button>
        </form>
      )}
    </div>
  );
}

function Input({
  name,
  label,
  defaultValue,
  placeholder,
  required,
  maxLength,
  autoComplete,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-500">{label}</label>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      />
    </div>
  );
}
