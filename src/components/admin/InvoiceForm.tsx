"use client";

import { useActionState, useState, useEffect } from "react";
import { User, Home, Package, ShoppingCart, Tag, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { createInvoice, updateInvoice, fetchShippingRates } from "@/app/(main)/admin/(protected)/invoices/actions";
import type { InvoiceFormState } from "@/app/(main)/admin/(protected)/invoices/types";
import { AdminPhoneField } from "@/components/admin/AdminPhoneField";
import { AdminCountryField } from "@/components/admin/AdminCountryField";
import { COUNTRY_OPTIONS } from "@/lib/checkout/countries";

interface PriceTier { minQty: number; maxQty: number | null; priceCents: number; zohoItemId: string | null }
interface BillingPlan { label: string; interval: string; priceCents: number; zohoItemId: string | null }
interface PlanTierPrice { minQty: number; maxQty: number | null; monthlyPriceCents: number }
interface PlanTier { name: string; annualDiscountPercent: number; zohoMonthlyItemId: string | null; zohoAnnualItemId: string | null; prices: PlanTierPrice[] }
interface AddonOption { name: string; priceCents: number; zohoItemId: string | null }
interface PromotionInfo { name: string; code: string; autoApply: boolean; priceCents: number }

interface CheckoutPageOption {
  id: string; title: string; basePriceCents: number; zohoItemId: string | null;
  successRedirectUrl: string; webhookUrl: string | null;
  priceTiers: PriceTier[]; billingPlans: BillingPlan[]; planTiers: PlanTier[];
  addons: AddonOption[]; promotion: PromotionInfo | null;
}

export interface InvoiceData {
  id: string;
  firstName: string; lastName: string; email: string; phone: string | null;
  addressLine1: string | null; city: string | null; state: string | null; zip: string | null; country: string | null; taxId: string | null;
  shippingSameAsBilling: boolean;
  shippingAddressLine1: string | null; shippingCity: string | null; shippingState: string | null; shippingZip: string | null; shippingCountry: string | null;
  listingQty: number; selectedPlanName: string | null; selectedPlanInterval: string | null; selectedPlanPriceCents: number | null;
  discountCents: number; discountLabel: string | null;
  shippingCents: number; shippingCarrier: string | null; shippingService: string | null; shippingEstDays: number | null;
  expiresAt: string | null; successRedirectUrl: string | null; webhookUrl: string | null;
  adminNotes: string | null; customerNotes: string | null;
  lineItems: { description: string; quantity: number; unitPriceCents: number; checkoutPageId: string | null; zohoItemId: string | null }[];
}

interface LineItem {
  key: number; source: "custom" | "checkout"; checkoutPageId: string;
  description: string; unitPrice: string; quantity: string; zohoItemId: string;
}

function newLineItem(key: number): LineItem {
  return { key, source: "checkout", checkoutPageId: "", description: "", unitPrice: "", quantity: "1", zohoItemId: "" };
}

function fmt(cents: number) { return `$${(cents / 100).toFixed(2)}`; }

// ─── Shared styles ───────────────────────────────────────────────────────────
const inputCls = "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm transition placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20";
const selectCls = inputCls;
const labelCls = "mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400";
const tierBtnBase = "rounded-lg border px-3 py-1.5 text-xs font-medium transition";
const tierBtnDefault = `${tierBtnBase} border-zinc-200 text-zinc-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-indigo-500 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400`;
const tierBtnActive = `${tierBtnBase} border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-400`;
const tierBtnSave = `${tierBtnBase} border-emerald-200 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-500/10`;

export function InvoiceForm({ checkoutPages, invoice }: { checkoutPages: CheckoutPageOption[]; invoice?: InvoiceData }) {
  const router = useRouter();
  const isEdit = !!invoice;
  const action = isEdit ? updateInvoice.bind(null, invoice.id) : createInvoice;
  const [state, formAction, pending] = useActionState<InvoiceFormState, FormData>(action, { error: null });

  const initialLineItems: LineItem[] = invoice
    ? invoice.lineItems.map((li, i) => ({
        key: i,
        source: li.checkoutPageId ? "checkout" as const : "custom" as const,
        checkoutPageId: li.checkoutPageId ?? "",
        description: li.description,
        unitPrice: (li.unitPriceCents / 100).toFixed(2),
        quantity: String(li.quantity),
        zohoItemId: li.zohoItemId ?? "",
      }))
    : [newLineItem(0)];

  const [lineItems, setLineItems] = useState<LineItem[]>(initialLineItems);
  const [nextKey, setNextKey] = useState(initialLineItems.length);
  const [sameAsBilling, setSameAsBilling] = useState(invoice?.shippingSameAsBilling ?? true);
  const [discountAppliesTo, setDiscountAppliesTo] = useState<"none" | "device" | "monthly" | "annual" | "device_monthly" | "device_annual" | "monthly_annual" | "all">("none");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [discountValue, setDiscountValue] = useState("");
  const [selectedPageId, setSelectedPageId] = useState(() => {
    if (!invoice) return "";
    const cpItem = invoice.lineItems.find((li) => li.checkoutPageId);
    return cpItem?.checkoutPageId ?? "";
  });
  const [autoDiscountPerUnit, setAutoDiscountPerUnit] = useState(0);
  const [autoDiscountQty, setAutoDiscountQty] = useState(0);
  const [autoDiscountLabel, setAutoDiscountLabel] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<{ name: string; interval: string; priceCents: number } | null>(
    invoice?.selectedPlanName ? { name: invoice.selectedPlanName, interval: invoice.selectedPlanInterval ?? "monthly", priceCents: invoice.selectedPlanPriceCents ?? 0 } : null
  );
  const [listingQty, setListingQty] = useState(String(invoice?.listingQty ?? 1));
  const [shippingCost, setShippingCost] = useState(invoice?.shippingCents ? (invoice.shippingCents / 100).toFixed(2) : "");
  const [shippingMeta, setShippingMeta] = useState<{ carrier: string; service: string; estDays: number | null }>({ carrier: invoice?.shippingCarrier ?? "", service: invoice?.shippingService ?? "", estDays: invoice?.shippingEstDays ?? null });
  const [shippoRates, setShippoRates] = useState<{ carrier: string; service: string; amountCents: number; estimatedDays: number | null }[]>([]);
  const [shippoLoading, setShippoLoading] = useState(false);
  const [shippoError, setShippoError] = useState("");
  const [phoneCountry, setPhoneCountry] = useState(invoice?.country ?? "US");
  const [phoneNumber, setPhoneNumber] = useState(invoice?.phone ?? "");
  const [billingCountry, setBillingCountry] = useState(invoice?.country ?? "US");
  const [shippingCountry, setShippingCountry] = useState(invoice?.shippingCountry ?? "US");

  const selectedPage = checkoutPages.find((p) => p.id === selectedPageId);

  useEffect(() => {
    if (state.invoiceId) router.push(`/admin/invoices/${state.invoiceId}`);
  }, [state.invoiceId, router]);

  // Default to first plan tier (monthly) when checkout page changes (skip initial render in edit mode)
  const isFirstRender = useState(true);
  useEffect(() => {
    if (isFirstRender[0] && isEdit) { isFirstRender[1](false); return; }
    isFirstRender[1](false);
    if (selectedPage?.planTiers.length) {
      const first = selectedPage.planTiers[0];
      const price = first.prices[0]?.monthlyPriceCents ?? 0;
      setSelectedPlan({ name: first.name, interval: "monthly", priceCents: price });
    }
  }, [selectedPageId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Computed qty from checkout page line item (needed by shipping + discount)
  const cpLineItemQty = (() => { if (!selectedPageId) return 0; const li = lineItems.find((l) => l.checkoutPageId === selectedPageId); return parseInt(li?.quantity ?? "0") || 0; })();

  // Fetch Shippo rates — called manually or auto on country change
  async function doFetchRates() {
    setShippoLoading(true);
    setShippoError("");
    setShippoRates([]);
    const qty = cpLineItemQty || 1;
    const result = await fetchShippingRates({
      street1: (document.querySelector<HTMLInputElement>("[name=addressLine1]")?.value) || "",
      city: (document.querySelector<HTMLInputElement>("[name=city]")?.value) || "",
      state: (document.querySelector<HTMLInputElement>("[name=state]")?.value) || "",
      zip: (document.querySelector<HTMLInputElement>("[name=zip]")?.value) || "",
      country: billingCountry,
    }, qty);
    setShippoLoading(false);
    if (result.error) { setShippoError(result.error); return; }
    if (result.rates.length === 0) { setShippoError("No rates available for this address."); return; }
    setShippoRates(result.rates);
    // Auto-select cheapest
    const cheapest = result.rates.reduce((min, r) => r.amountCents < min.amountCents ? r : min, result.rates[0]);
    setShippingCost((cheapest.amountCents / 100).toFixed(2));
    setShippingMeta({ carrier: cheapest.carrier, service: cheapest.service, estDays: cheapest.estimatedDays });
  }

  // Auto-fetch when country changes to international and address has zip
  useEffect(() => {
    if (billingCountry === "US") { setShippoRates([]); setShippingCost(""); return; }
    // Small delay so user can finish typing zip
    const timer = setTimeout(() => {
      const zip = (document.querySelector<HTMLInputElement>("[name=zip]")?.value) || "";
      if (zip) doFetchRates();
    }, 500);
    return () => clearTimeout(timer);
  }, [billingCountry]); // eslint-disable-line react-hooks/exhaustive-deps

  function addLineItem() {
    setLineItems((prev) => [...prev, newLineItem(nextKey)]);
    setNextKey((k) => k + 1);
  }
  function addLineItemWith(desc: string, priceCents: number, zohoId: string | null) {
    setLineItems((prev) => [...prev, { key: nextKey, source: "custom" as const, checkoutPageId: "", description: desc, unitPrice: (priceCents / 100).toFixed(2), quantity: "1", zohoItemId: zohoId ?? "" }]);
    setNextKey((k) => k + 1);
  }
  function removeLineItem(key: number) {
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((li) => li.key !== key)));
  }
  function updateLineItem(key: number, field: keyof LineItem, value: string) {
    setLineItems((prev) =>
      prev.map((li) => {
        if (li.key !== key) return li;
        const updated = { ...li, [field]: value };
        if (field === "source" && value === "custom") { updated.checkoutPageId = ""; updated.description = ""; updated.unitPrice = ""; updated.zohoItemId = ""; }
        if (field === "checkoutPageId" && value) {
          const page = checkoutPages.find((p) => p.id === value);
          if (page) { updated.description = page.title; updated.unitPrice = (page.basePriceCents / 100).toFixed(2); updated.zohoItemId = page.zohoItemId ?? ""; setSelectedPageId(value); }
        }
        return updated;
      }),
    );
  }

  // ─── Computed values ─────────────────────────────────────────────────────────
  const subtotal = lineItems.reduce((s, li) => s + (parseFloat(li.unitPrice) || 0) * (parseInt(li.quantity) || 0), 0);
  const effectiveAutoQty = autoDiscountPerUnit > 0 ? cpLineItemQty : 0;
  const autoDiscountTotal = autoDiscountPerUnit * effectiveAutoQty;

  const discountVal = parseFloat(discountValue) || 0;
  const discountOnDevice = ["device", "device_monthly", "device_annual", "all"].includes(discountAppliesTo);
  const discountOnMonthly = ["monthly", "device_monthly", "monthly_annual", "all"].includes(discountAppliesTo);
  const discountOnAnnual = ["annual", "device_annual", "monthly_annual", "all"].includes(discountAppliesTo);
  let adminDeviceDiscount = 0;
  if (discountOnDevice && discountVal > 0) { adminDeviceDiscount = discountType === "percent" ? (subtotal - autoDiscountTotal) * (discountVal / 100) : discountVal; }
  const adminMonthlyLabel = discountOnMonthly && discountVal > 0 ? (discountType === "percent" ? `${discountVal}% off monthly` : `$${discountVal.toFixed(2)} off monthly`) : "";
  const adminAnnualLabel = discountOnAnnual && discountVal > 0 ? (discountType === "percent" ? `${discountVal}% off annual` : `$${discountVal.toFixed(2)} off annual`) : "";
  const adminDiscountLabel = [adminDeviceDiscount > 0 ? (discountType === "percent" ? `${discountVal}% off device` : `$${adminDeviceDiscount.toFixed(2)} off device`) : "", adminMonthlyLabel, adminAnnualLabel].filter(Boolean).join(", ");
  const shippingCents = Math.round((parseFloat(shippingCost) || 0) * 100);
  const isInternational = billingCountry !== "US";
  const totalDiscount = autoDiscountTotal + adminDeviceDiscount;
  const total = Math.max(0, subtotal - totalDiscount) + (isInternational ? shippingCents / 100 : 0);
  const combinedDiscountLabel = [autoDiscountLabel, adminDiscountLabel].filter(Boolean).join(" + ");

  // Helpers to wire saved values + errors into fields after validation failure
  // For edit mode, also fall back to invoice data
  const iv: Record<string, string> = {};
  if (invoice) {
    iv.firstName = invoice.firstName; iv.lastName = invoice.lastName; iv.email = invoice.email;
    iv.phone = invoice.phone ?? ""; iv.addressLine1 = invoice.addressLine1 ?? "";
    iv.city = invoice.city ?? ""; iv.state = invoice.state ?? ""; iv.zip = invoice.zip ?? "";
    iv.country = invoice.country ?? "US"; iv.taxId = invoice.taxId ?? "";
    iv.billingAddressLine1 = invoice.shippingAddressLine1 ?? "";
    iv.billingCity = invoice.shippingCity ?? ""; iv.billingState = invoice.shippingState ?? "";
    iv.billingZip = invoice.shippingZip ?? ""; iv.billingCountry = invoice.shippingCountry ?? "US";
    iv.successRedirectUrl = invoice.successRedirectUrl ?? "";
    iv.webhookUrl = invoice.webhookUrl ?? "";
    iv.adminNotes = invoice.adminNotes ?? ""; iv.customerNotes = invoice.customerNotes ?? "";
    iv.expiresAt = invoice.expiresAt ?? "";
  }
  const v = (name: string) => state.values?.[name] ?? iv[name] ?? "";
  const err = (name: string) => state.fieldErrors?.[name];

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <form action={formAction} className="space-y-8">
      {state.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-500/10">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">{state.error}</p>
          {state.fieldErrors && Object.keys(state.fieldErrors).length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-red-600 dark:text-red-400">
              {Object.entries(state.fieldErrors).map(([field, msg]) => (
                <li key={field}><strong>{field}</strong>: {msg}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Customer ────────────────────────────────────────────────────────── */}
      <Section title="Customer" icon={<User className="h-4 w-4" />}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field name="firstName" label="First Name" required error={err("firstName")} defaultValue={v("firstName")} />
          <Field name="lastName" label="Last Name" required error={err("lastName")} defaultValue={v("lastName")} />
          <Field name="email" label="Email" type="email" required error={err("email")} defaultValue={v("email")} />
          <AdminPhoneField country={phoneCountry} onCountryChange={setPhoneCountry} number={phoneNumber} onNumberChange={setPhoneNumber} />
        </div>
      </Section>

      {/* ── Addresses ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Shipping = primary address (where device ships) */}
        <Section title="Shipping Address" icon={<Package className="h-4 w-4" />} compact>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field name="addressLine1" label="Street Address" placeholder="123 Main St" defaultValue={v("addressLine1")} error={err("addressLine1")} /></div>
            <AdminCountryField name="country" label="Country" value={billingCountry} onChange={setBillingCountry} />
            <Field name="city" label="City" placeholder={billingCountry === "GB" ? "London" : "New York"} defaultValue={v("city")} error={err("city")} />
            <Field
              name="state"
              label={billingCountry === "CA" ? "Province" : billingCountry === "GB" ? "County (optional)" : "State / Province"}
              placeholder={billingCountry === "CA" ? "Ontario" : billingCountry === "US" ? "New York" : ""}
              defaultValue={v("state")} error={err("state")}
            />
            <Field
              name="zip"
              label={billingCountry === "GB" ? "Postcode" : billingCountry === "CA" ? "Postal Code" : "ZIP Code"}
              placeholder={billingCountry === "US" ? "10001" : billingCountry === "CA" ? "K1A 0B1" : billingCountry === "GB" ? "SW1A 1AA" : ""}
              defaultValue={v("zip")} error={err("zip")}
            />
          </div>
          {billingCountry === "MX" && (
            <div className="mt-4">
              <Field name="taxId" label="Tax ID / RFC (optional)" placeholder="XAXX010101000" defaultValue={v("taxId")} />
            </div>
          )}
        </Section>

        {/* Billing = same as shipping unless unchecked */}
        <Section title="Billing Address" icon={<Home className="h-4 w-4" />} compact>
          <label className="mb-4 flex items-center gap-2.5 text-sm text-zinc-600 dark:text-zinc-400">
            <input type="checkbox" checked={sameAsBilling} onChange={(e) => setSameAsBilling(e.target.checked)} className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600" />
            Same as shipping address
          </label>
          <input type="hidden" name="billingSameAsShipping" value={sameAsBilling ? "true" : "false"} />
          {!sameAsBilling && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field name="billingAddressLine1" label="Street Address" placeholder="456 Oak Ave" defaultValue={v("billingAddressLine1")} /></div>
              <AdminCountryField name="billingCountry" label="Country" value={shippingCountry} onChange={setShippingCountry} />
              <Field name="billingCity" label="City" placeholder={shippingCountry === "GB" ? "London" : "New York"} defaultValue={v("billingCity")} />
              <Field
                name="billingState"
                label={shippingCountry === "CA" ? "Province" : shippingCountry === "GB" ? "County (optional)" : "State / Province"}
                placeholder={shippingCountry === "CA" ? "Ontario" : shippingCountry === "US" ? "New York" : ""}
                defaultValue={v("billingState")}
              />
              <Field
                name="billingZip"
                label={shippingCountry === "GB" ? "Postcode" : shippingCountry === "CA" ? "Postal Code" : "ZIP Code"}
                placeholder={shippingCountry === "US" ? "10001" : shippingCountry === "CA" ? "K1A 0B1" : shippingCountry === "GB" ? "SW1A 1AA" : ""}
                defaultValue={v("billingZip")}
              />
            </div>
          )}
        </Section>
      </div>

      {/* ── Line Items ──────────────────────────────────────────────────────── */}
      <Section title="Line Items" icon={<ShoppingCart className="h-4 w-4" />}>
        <input type="hidden" name="lineItemCount" value={lineItems.length} />
        <div className="space-y-5">
          {lineItems.map((li, i) => (
            <div key={li.key} className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 dark:border-zinc-700 dark:bg-zinc-800/50">
              {lineItems.length > 1 && (
                <div className="mb-4 flex justify-end">
                  <button type="button" onClick={() => removeLineItem(li.key)} className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10">Remove</button>
                </div>
              )}

              {li.source === "checkout" && (
                <div className="mb-4">
                  <label className={labelCls}>Checkout Page</label>
                  <select value={li.checkoutPageId} onChange={(e) => updateLineItem(li.key, "checkoutPageId", e.target.value)} className={selectCls}>
                    <option value="">Select a page…</option>
                    {checkoutPages.map((p) => <option key={p.id} value={p.id}>{p.title} — {fmt(p.basePriceCents)}</option>)}
                  </select>
                  <input type="hidden" name={`lineItems.${i}.checkoutPageId`} value={li.checkoutPageId} />

                  {/* Price tiers + promo */}
                  {li.checkoutPageId && (() => {
                    const page = checkoutPages.find((p) => p.id === li.checkoutPageId);
                    if (!page) return null;
                    const promo = page.promotion;
                    const basePrice = page.basePriceCents;
                    return (
                      <div className="mt-4 space-y-3">
                        {page.priceTiers.length > 0 && (
                          <div>
                            <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Price Tiers</p>
                            <div className="flex flex-wrap gap-2">
                              {page.priceTiers.map((t, ti) => {
                                let effectivePrice = t.priceCents;
                                if (promo && promo.autoApply && promo.priceCents < t.priceCents) effectivePrice = promo.priceCents;
                                const saving = basePrice - effectivePrice;
                                return (
                                  <button key={ti} type="button"
                                    onClick={() => {
                                      updateLineItem(li.key, "quantity", String(t.minQty));
                                      if (t.zohoItemId) updateLineItem(li.key, "zohoItemId", t.zohoItemId);
                                      if (saving > 0) { setAutoDiscountPerUnit(saving / 100); setAutoDiscountQty(t.minQty); setAutoDiscountLabel(`Qty ${t.minQty}${t.maxQty ? `-${t.maxQty}` : "+"} tier: −${fmt(saving)}/ea`); }
                                      else { setAutoDiscountPerUnit(0); setAutoDiscountQty(0); setAutoDiscountLabel(""); }
                                    }}
                                    className={saving > 0 ? tierBtnSave : tierBtnDefault}
                                  >
                                    {t.minQty}{t.maxQty ? `–${t.maxQty}` : "+"} = {fmt(t.priceCents)}/ea{saving > 0 ? ` (save ${fmt(saving)})` : ""}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {promo && (
                          <div className="flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 dark:bg-amber-500/10">
                            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">Promo</span>
                            <span className="flex-1 text-xs text-amber-800 dark:text-amber-300">
                              {promo.name} — <strong>{promo.code}</strong> — {fmt(promo.priceCents)}/ea
                              {promo.autoApply && <span className="ml-1 opacity-70">(auto)</span>}
                            </span>
                            <button type="button"
                              onClick={() => { const saving = basePrice - promo.priceCents; if (saving > 0) { setAutoDiscountPerUnit(saving / 100); setAutoDiscountLabel(`Promo "${promo.code}": −${fmt(saving)}/ea`); } }}
                              className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-200 dark:border-amber-600 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30"
                            >
                              Apply
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Description</label>
                  <input name={`lineItems.${i}.description`} value={li.description} onChange={(e) => updateLineItem(li.key, "description", e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Unit Price ($)</label>
                  <input name={`lineItems.${i}.unitPrice`} value={li.unitPrice} onChange={(e) => updateLineItem(li.key, "unitPrice", e.target.value)} type="number" step="0.01" min="0" required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Qty</label>
                  <input name={`lineItems.${i}.quantity`} value={li.quantity} onChange={(e) => updateLineItem(li.key, "quantity", e.target.value)} type="number" min="1" required className={inputCls} />
                </div>
              </div>
              <input type="hidden" name={`lineItems.${i}.zohoItemId`} value={li.zohoItemId} />

              {/* Breakdown */}
              {(() => {
                const unitPrice = parseFloat(li.unitPrice) || 0;
                const qty = parseInt(li.quantity) || 0;
                const discPerUnit = autoDiscountPerUnit;
                const hasDisc = li.source === "checkout" && li.checkoutPageId && discPerUnit > 0;
                const effectiveUnit = hasDisc ? unitPrice - discPerUnit : unitPrice;
                const lineTotal = effectiveUnit * qty;
                if (unitPrice <= 0 || qty <= 0) return null;
                return (
                  <div className="mt-4 rounded-lg bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="text-zinc-500 dark:text-zinc-400">{fmt(unitPrice * 100)}</span>
                      {hasDisc && (
                        <>
                          <span className="text-zinc-300 dark:text-zinc-600">→</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">−${discPerUnit.toFixed(2)}/ea</span>
                          <span className="text-zinc-300 dark:text-zinc-600">→</span>
                          <span className="font-semibold text-zinc-700 dark:text-zinc-200">${effectiveUnit.toFixed(2)}/ea</span>
                        </>
                      )}
                      <span className="text-zinc-400 dark:text-zinc-500">× {qty}</span>
                      <span className="text-zinc-300 dark:text-zinc-600">=</span>
                      <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">${lineTotal.toFixed(2)}</span>
                      {hasDisc && <span className="ml-2 rounded-lg bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">saving ${(discPerUnit * qty).toFixed(2)}</span>}
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
        <button type="button" onClick={addLineItem} className="mt-4 rounded-lg border border-dashed border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:border-indigo-500 hover:bg-indigo-50 dark:border-indigo-600 dark:text-indigo-400 dark:hover:bg-indigo-500/10">
          + Add Line Item
        </button>

        {/* Quick Add panel */}
        {selectedPage && (selectedPage.planTiers.length > 0 || selectedPage.addons.length > 0) && (
          <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-5 dark:border-zinc-600 dark:bg-zinc-800/30">
            <p className="mb-4 text-xs font-bold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">Quick Add — {selectedPage.title}</p>

            {/* Tiered Plans */}
            {selectedPage.planTiers.length > 0 && (() => {
              const cpLi = lineItems.find((li) => li.checkoutPageId === selectedPage.id);
              const deviceQty = parseInt(cpLi?.quantity ?? "1") || 1;
              const listings = parseInt(listingQty) || 1;
              return (
                <div className="mb-5">
                  <div className="mb-4 flex flex-wrap items-end gap-5">
                    <div>
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Billing Plan</p>
                      <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">Devices: <strong className="text-zinc-600 dark:text-zinc-300">{deviceQty}</strong></p>
                    </div>
                    <div>
                      <label className={labelCls}>Listings (properties)</label>
                      <div className="flex items-center">
                        <button type="button" onClick={() => setListingQty(String(Math.max(1, (parseInt(listingQty) || 1) - 1)))} className="flex h-9 w-9 items-center justify-center rounded-l-lg border border-zinc-200 bg-zinc-50 text-sm font-bold text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700">−</button>
                        <span className="flex h-9 w-11 items-center justify-center border-y border-zinc-200 bg-white text-sm font-semibold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">{parseInt(listingQty) || 1}</span>
                        <button type="button" onClick={() => setListingQty(String((parseInt(listingQty) || 1) + 1))} className="flex h-9 w-9 items-center justify-center rounded-r-lg border border-zinc-200 bg-zinc-50 text-sm font-bold text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700">+</button>
                      </div>
                    </div>
                  </div>
                  <input type="hidden" name="listingQty" value={listingQty} />
                  <input type="hidden" name="selectedPlanName" value={selectedPlan?.name ?? ""} />
                  <input type="hidden" name="selectedPlanInterval" value={selectedPlan?.interval ?? ""} />
                  <input type="hidden" name="selectedPlanPriceCents" value={selectedPlan?.priceCents ?? ""} />
                  <div className="space-y-3">
                    {selectedPage.planTiers.map((pt, i) => {
                      const mp = pt.prices.find((p) => deviceQty >= p.minQty && (p.maxQty == null || deviceQty <= p.maxQty)) ?? pt.prices[0];
                      const monthlyPrice = mp?.monthlyPriceCents ?? 0;
                      const monthlyTotal = monthlyPrice * listings;
                      const annualPL = Math.round(monthlyPrice * 12 * (1 - pt.annualDiscountPercent / 100) / 100) * 100;
                      const annualTotal = annualPL * listings;
                      const isMo = selectedPlan?.name === pt.name && selectedPlan?.interval === "monthly";
                      const isAn = selectedPlan?.name === pt.name && selectedPlan?.interval === "annually";
                      return (
                        <div key={i} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
                          <p className="mb-3 text-sm font-bold text-zinc-800 dark:text-zinc-100">{pt.name}</p>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <button type="button" onClick={() => setSelectedPlan({ name: pt.name, interval: "monthly", priceCents: monthlyPrice })}
                              className={`flex flex-col rounded-xl border p-3 text-left transition ${isMo ? tierBtnActive : tierBtnDefault}`}>
                              <span className="text-sm font-semibold">Monthly</span>
                              <span className="mt-1 text-xs">{fmt(monthlyPrice)}/mo × {listings} {listings === 1 ? "listing" : "listings"} = <strong>{fmt(monthlyTotal)}/mo</strong></span>
                              <span className="mt-1 text-[11px] opacity-60">1st month free, recurring after</span>
                            </button>
                            <button type="button"
                              onClick={() => { setSelectedPlan({ name: pt.name, interval: "annually", priceCents: annualPL }); addLineItemWith(`${pt.name} Plan (annual) × ${listings} listings`, annualTotal, pt.zohoAnnualItemId); }}
                              className={`flex flex-col rounded-xl border p-3 text-left transition ${isAn ? tierBtnActive : tierBtnDefault}`}>
                              <span className="text-sm font-semibold">Annual{pt.annualDiscountPercent > 0 ? ` (${pt.annualDiscountPercent}% off)` : ""}</span>
                              <span className="mt-1 text-xs">{fmt(annualPL)}/yr × {listings} {listings === 1 ? "listing" : "listings"} = <strong>{fmt(annualTotal)}/yr</strong></span>
                              <span className="mt-1 text-[11px] opacity-60">Charged upfront — added to invoice</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {selectedPlan && (
                    <div className="mt-4 rounded-xl bg-indigo-50 px-4 py-3 dark:bg-indigo-500/10">
                      <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">
                        {selectedPlan.name} — {selectedPlan.interval === "monthly" ? "Monthly" : "Annual"}
                      </p>
                      <p className="mt-0.5 text-xs text-indigo-600 dark:text-indigo-300">
                        {selectedPlan.interval === "monthly"
                          ? `${fmt(selectedPlan.priceCents)}/mo × ${listings} listings = ${fmt(selectedPlan.priceCents * listings)}/mo — 1st month free`
                          : `${fmt(selectedPlan.priceCents)}/yr × ${listings} listings = ${fmt(selectedPlan.priceCents * listings)}/yr — upfront`}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Add-ons */}
            {selectedPage.addons.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Add-ons</p>
                <div className="flex flex-wrap gap-2">
                  {selectedPage.addons.map((a, i) => (
                    <button key={i} type="button" onClick={() => addLineItemWith(a.name, a.priceCents, a.zohoItemId)} className={tierBtnDefault}>
                      {a.name} — {fmt(a.priceCents)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ── Discount ────────────────────────────────────────────────────────── */}
      <Section title="Discount" icon={<Tag className="h-4 w-4" />}>
        {autoDiscountTotal > 0 && (
          <div className="mb-5 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-500/10">
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              {autoDiscountLabel} × {effectiveAutoQty} = <strong>−${autoDiscountTotal.toFixed(2)}</strong>
            </span>
            <button type="button" onClick={() => { setAutoDiscountPerUnit(0); setAutoDiscountQty(0); setAutoDiscountLabel(""); }} className="rounded-lg px-2 py-1 text-xs font-medium text-emerald-600 transition hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-500/20">Clear</button>
          </div>
        )}

        <p className="mb-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">Additional discount</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Applies to</label>
            <select value={discountAppliesTo} onChange={(e) => { setDiscountAppliesTo(e.target.value as typeof discountAppliesTo); setDiscountValue(""); }} className={selectCls}>
              <option value="none">No discount</option>
              <option value="device">Device</option>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
              <option value="device_monthly">Device + Monthly</option>
              <option value="device_annual">Device + Annual</option>
              <option value="monthly_annual">Monthly + Annual</option>
              <option value="all">All</option>
            </select>
          </div>
          {discountAppliesTo !== "none" && (
            <>
              <div>
                <label className={labelCls}>Type</label>
                <select value={discountType} onChange={(e) => setDiscountType(e.target.value as "fixed" | "percent")} className={selectCls}>
                  <option value="fixed">Fixed ($)</option>
                  <option value="percent">Percent (%)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>{discountType === "fixed" ? "Amount ($)" : "Percent (%)"}</label>
                <input type="number" step={discountType === "fixed" ? "0.01" : "1"} min="0" max={discountType === "percent" ? "100" : undefined} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className={inputCls} />
              </div>
            </>
          )}
        </div>
        {discountAppliesTo !== "none" && discountVal > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {discountOnDevice && adminDeviceDiscount > 0 && (
              <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                Device: −${adminDeviceDiscount.toFixed(2)} (on invoice)
              </span>
            )}
            {discountOnMonthly && (!selectedPlan || selectedPlan.interval === "monthly") && (
              <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                Monthly: {discountType === "percent" ? `${discountVal}%` : `$${discountVal.toFixed(2)}`} off (recurring)
              </span>
            )}
            {discountOnAnnual && (!selectedPlan || selectedPlan.interval === "annually") && (
              <span className="rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 dark:bg-violet-500/10 dark:text-violet-400">
                Annual: {discountType === "percent" ? `${discountVal}%` : `$${discountVal.toFixed(2)}`} off (recurring)
              </span>
            )}
          </div>
        )}
        <input type="hidden" name="discountCents" value={Math.round(totalDiscount * 100)} />
        <input type="hidden" name="discountLabel" value={combinedDiscountLabel} />
        <input type="hidden" name="discountAppliesTo" value={discountAppliesTo} />
      </Section>

      {/* ── Shipping (international only) ───────────────────────────────────── */}
      {isInternational && (
        <Section title="Shipping" icon={<Package className="h-4 w-4" />}>
          <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
            International shipping to <strong className="text-zinc-700 dark:text-zinc-200">{COUNTRY_OPTIONS.find((c) => c.code === billingCountry)?.name ?? billingCountry}</strong>
          </p>

          {shippoLoading && (
            <div className="mb-4 flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              Fetching Shippo rates…
            </div>
          )}
          {shippoError && <p className="mb-3 text-xs text-red-500">{shippoError}</p>}

          {shippoRates.length > 0 && (() => {
            const cheapestIdx = shippoRates.reduce((mi, r, i, a) => r.amountCents < a[mi].amountCents ? i : mi, 0);
            const fastestIdx = shippoRates.reduce((mi, r, i, a) => {
              if (r.estimatedDays == null) return mi;
              if (a[mi].estimatedDays == null) return i;
              return r.estimatedDays < a[mi].estimatedDays ? i : mi;
            }, 0);
            return (
              <div className="mb-4 space-y-2">
                {shippoRates.map((r, i) => {
                  const isSelected = shippingCost === (r.amountCents / 100).toFixed(2);
                  const isCheapest = i === cheapestIdx;
                  const isFastest = i === fastestIdx && fastestIdx !== cheapestIdx;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setShippingCost((r.amountCents / 100).toFixed(2)); setShippingMeta({ carrier: r.carrier, service: r.service, estDays: r.estimatedDays }); }}
                      className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition ${isSelected ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 dark:border-indigo-400 dark:bg-indigo-500/10" : "border-zinc-200 hover:border-indigo-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-indigo-600 dark:hover:bg-zinc-800"}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{r.carrier}</span>
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">{r.service}</span>
                        {r.estimatedDays != null && <span className="text-xs text-zinc-400 dark:text-zinc-500">~{r.estimatedDays} days</span>}
                        {isCheapest && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Cheapest</span>}
                        {isFastest && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Fastest</span>}
                      </div>
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">${(r.amountCents / 100).toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {!shippoLoading && shippoRates.length === 0 && !shippoError && (
            <button
              type="button"
              disabled={shippoLoading}
              onClick={() => doFetchRates()}
              className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20"
            >
              Get Shippo Rates
            </button>
          )}

          {shippoRates.length > 0 && (
            <button
              type="button"
              onClick={() => doFetchRates()}
              className="mb-4 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Refresh rates
            </button>
          )}

          <div className="flex items-end gap-4">
            <div className="max-w-xs flex-1">
              <label className={labelCls}>Shipping Cost ($) <span className="font-normal text-zinc-400">— or enter manually</span></label>
              <input
                name="shippingCost"
                type="number"
                step="0.01"
                min="0"
                value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
            {shippingCents > 0 && (
              <div className="mb-0.5 rounded-lg bg-blue-50 px-3 py-2.5 text-sm font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                +${(shippingCents / 100).toFixed(2)}
              </div>
            )}
          </div>
          <input type="hidden" name="shippingCents" value={shippingCents} />
          <input type="hidden" name="shippingCarrier" value={shippingMeta.carrier} />
          <input type="hidden" name="shippingService" value={shippingMeta.service} />
          <input type="hidden" name="shippingEstDays" value={shippingMeta.estDays ?? ""} />
        </Section>
      )}

      {/* ── Settings ────────────────────────────────────────────────────────── */}
      <Section title="Settings" icon={<Settings className="h-4 w-4" />}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Expiration</label>
            <select name="expiresAt" defaultValue={v("expiresAt")} className={selectCls}>
              <option value="">No expiration</option>
              {invoice?.expiresAt && <option value={invoice.expiresAt}>Current: {invoice.expiresAt.slice(0, 10)}</option>}
              {[7, 14, 30, 60, 90].map((days) => { const d = new Date(); d.setDate(d.getDate() + days); return <option key={days} value={d.toISOString()}>{days} days ({d.toISOString().slice(0, 10)})</option>; })}
            </select>
          </div>
          <div>
            <label className={labelCls}>Success Redirect URL</label>
            <input name="successRedirectUrl" type="url" placeholder="https://…" defaultValue={v("successRedirectUrl") || selectedPage?.successRedirectUrl || ""} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Marketing Webhook URL</label>
            <input name="webhookUrl" type="url" placeholder="https://…" defaultValue={v("webhookUrl") || selectedPage?.webhookUrl || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Admin Notes <span className="font-normal text-zinc-400">(internal)</span></label>
            <textarea name="adminNotes" rows={3} defaultValue={v("adminNotes")} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Customer Notes <span className="font-normal text-zinc-400">(on invoice)</span></label>
            <textarea name="customerNotes" rows={3} defaultValue={v("customerNotes")} className={inputCls} />
          </div>
        </div>
      </Section>

      {/* ── Summary ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-6 shadow-sm dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-900">
        <h2 className="mb-4 text-sm font-bold text-zinc-900 dark:text-zinc-100">Order Summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
            <span>Subtotal</span><span className="font-medium">${subtotal.toFixed(2)}</span>
          </div>
          {autoDiscountTotal > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>{autoDiscountLabel}</span><span className="font-medium">−${autoDiscountTotal.toFixed(2)}</span>
            </div>
          )}
          {adminDeviceDiscount > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Discount (device)</span><span className="font-medium">−${adminDeviceDiscount.toFixed(2)}</span>
            </div>
          )}
          {adminMonthlyLabel && (!selectedPlan || selectedPlan.interval === "monthly") && (
            <div className="flex justify-between text-blue-500 dark:text-blue-400">
              <span>{adminMonthlyLabel}</span><span className="text-xs font-medium">(recurring)</span>
            </div>
          )}
          {adminAnnualLabel && (!selectedPlan || selectedPlan.interval === "annually") && (
            <div className="flex justify-between text-violet-500 dark:text-violet-400">
              <span>{adminAnnualLabel}</span><span className="text-xs font-medium">(recurring)</span>
            </div>
          )}
          {isInternational && shippingCents > 0 && (
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>Shipping (international)</span><span className="font-medium">+${(shippingCents / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-zinc-200 pt-3 dark:border-zinc-700">
            <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">Total Due</span>
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">${total.toFixed(2)}</span>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button type="submit" disabled={pending}
            className="rounded-xl bg-indigo-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-700 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:shadow-none">
            {pending ? (isEdit ? "Updating…" : "Creating…") : (isEdit ? "Update Invoice" : "Create Invoice")}
          </button>
        </div>
      </div>
    </form>
  );
}

function Section({ title, icon, compact, children }: { title: string; icon?: React.ReactNode; compact?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className={`flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100 ${compact ? "mb-4 text-sm" : "mb-5 text-base"}`}>
        {icon && <span className="text-zinc-400 dark:text-zinc-500">{icon}</span>} {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ name, label, type = "text", required, error, placeholder, defaultValue }: { name: string; label: string; type?: string; required?: boolean; error?: string; placeholder?: string; defaultValue?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</label>
      <input name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue}
        className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm transition placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20 ${error ? "border-red-300 dark:border-red-500" : "border-zinc-200 dark:border-zinc-700"}`} />
      {error && <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}
