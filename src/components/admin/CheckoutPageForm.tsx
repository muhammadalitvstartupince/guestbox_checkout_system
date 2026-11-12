"use client";

import { useActionState, useState, useEffect } from "react";
import { initialCheckoutPageFormState, type CheckoutPageFormState } from "@/app/(main)/admin/(protected)/checkout-pages/types";
import { ResponsiveRichTextEditor } from "@/components/admin/ResponsiveRichTextEditor";

export interface PriceTierDefault {
  minQty: string;
  maxQty: string;
  priceCents: string;
  zohoItemId: string;
  isBase: boolean;
}

export interface BillingPlanDefault {
  interval: "monthly" | "annually";
  label: string;
  priceCents: string;
  zohoItemId: string;
  chargeAtCheckout: boolean;
  isDefault: boolean;
}

export interface PlanTierPriceDefault {
  minQty: string;
  maxQty: string;
  monthlyPriceCents: string;
}

export interface PlanTierDefault {
  name: string;
  annualDiscountPercent: string;
  zohoMonthlyItemId: string;
  zohoAnnualItemId: string;
  chargeAtCheckout: boolean;
  isDefault: boolean;
  prices: PlanTierPriceDefault[];
}

export interface CheckoutPageFormDefaults {
  slug: string;
  type: "normal" | "sales";
  title: string;
  productName: string;
  heroHtml: string;
  heroHtmlMobile: string;
  mockupImageUrl: string;
  skinId: string;
  zohoItemId: string;
  zohoRecurringItemId: string;
  basePrice: string;
  recurringPrice: string;
  billingInterval: "monthly" | "annually" | "none";
  showPromoCode: boolean;
  successRedirectUrl: string;
  failRedirectUrl: string;
  webhookUrl: string;
  status: "draft" | "live" | "archived";
  upgradeTitle: string;
  upgradeDescription: string;
  upgradePrice: string;
  upgradeRecurringPrice: string;
  upgradeZohoItemId: string;
  upgradeZohoRecurringItemId: string;
  priceTiers: PriceTierDefault[];
  billingPlans: BillingPlanDefault[];
  tieredPlansEnabled: boolean;
  planTiers: PlanTierDefault[];
}

export const emptyCheckoutPageDefaults: CheckoutPageFormDefaults = {
  slug: "",
  type: "normal",
  title: "",
  productName: "",
  heroHtml: "",
  heroHtmlMobile: "",
  mockupImageUrl: "",
  skinId: "",
  zohoItemId: "",
  zohoRecurringItemId: "",
  basePrice: "",
  recurringPrice: "",
  billingInterval: "none",
  showPromoCode: false,
  successRedirectUrl: "",
  failRedirectUrl: "",
  webhookUrl: "",
  status: "draft",
  upgradeTitle: "",
  upgradeDescription: "",
  upgradePrice: "",
  upgradeRecurringPrice: "",
  upgradeZohoItemId: "",
  upgradeZohoRecurringItemId: "",
  priceTiers: [],
  billingPlans: [],
  tieredPlansEnabled: false,
  planTiers: [],
};

type BoundAction = (state: CheckoutPageFormState, formData: FormData) => Promise<CheckoutPageFormState>;

export interface SelectableAddon {
  id: string;
  name: string;
  priceCents: number;
}

function toSlug(text: string) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function CheckoutPageForm({
  action,
  defaults,
  skins,
  submitLabel,
  availableAddons,
  checkoutPageId,
}: {
  action: BoundAction;
  defaults: CheckoutPageFormDefaults;
  skins: { id: string; name: string }[];
  submitLabel: string;
  /** Pass this only on the "new" form — lets the admin pick add-ons at
   *  creation time. Omit on the edit form, which has its own dedicated
   *  attach/detach/reorder panel instead. */
  availableAddons?: SelectableAddon[];
  /** Pass on edit forms so slug availability check excludes the current page. */
  checkoutPageId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialCheckoutPageFormState);

  const [priceTiers, setPriceTiers] = useState<PriceTierDefault[]>(defaults.priceTiers ?? []);
  const [billingPlans, setBillingPlans] = useState<BillingPlanDefault[]>(defaults.billingPlans ?? []);
  const [tieredPlansEnabled, setTieredPlansEnabled] = useState(defaults.tieredPlansEnabled ?? false);
  const [planTiers, setPlanTiers] = useState<PlanTierDefault[]>(defaults.planTiers ?? []);

  const isNew = !defaults.slug;
  const [slug, setSlug] = useState(defaults.slug ?? "");
  const [slugManual, setSlugManual] = useState(!isNew);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

  useEffect(() => {
    if (!slug) { setSlugStatus("idle"); return; }
    setSlugStatus("checking");
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ slug });
      if (checkoutPageId) params.set("exclude", checkoutPageId);
      try {
        const res = await fetch(`/api/admin/check-slug?${params}`);
        const data = await res.json();
        setSlugStatus(data.available ? "available" : "taken");
      } catch {
        setSlugStatus("idle");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [slug, checkoutPageId]);

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            state.status === "error"
              ? "border-red-300 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
              : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
          }`}
        >
          {state.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="title" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
            Title (internal — orders, Zoho, emails)
          </label>
          <input
            id="title"
            name="title"
            defaultValue={defaults.title}
            onChange={(e) => { if (!slugManual) setSlug(toSlug(e.target.value)); }}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          {state.fieldErrors?.title?.[0] && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{state.fieldErrors.title[0]}</p>}
        </div>
        <div>
          <label htmlFor="slug" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
            Slug (URL: /c/…)
          </label>
          <input
            id="slug"
            name="slug"
            value={slug}
            onChange={(e) => { const v = toSlug(e.target.value); setSlug(v); setSlugManual(!!v); }}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          {state.fieldErrors?.slug?.[0] && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{state.fieldErrors.slug[0]}</p>}
          {slugStatus === "checking" && <p className="mt-1 text-xs text-zinc-400">Checking…</p>}
          {slugStatus === "available" && <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">Available</p>}
          {slugStatus === "taken" && <p className="mt-1 text-xs text-red-600 dark:text-red-400">Already in use</p>}
        </div>
      </div>

      <Field
        name="productName"
        label="Product Name (customer-facing — shown in order summary, e.g. &quot;GuestBox&quot;)"
        defaultValue={defaults.productName}
        errors={state.fieldErrors?.productName}
      />

      <fieldset className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <legend className="px-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">Checkout Page Content</legend>
        <p className="-mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          What the customer actually sees, front and center on the checkout page. Design it however you like —
          headline, waived fee, price today, whatever wording and styling you want.
        </p>
        <ResponsiveRichTextEditor
          name="heroHtml"
          mobileName="heroHtmlMobile"
          label="Hero Text"
          defaultValue={defaults.heroHtml}
          mobileDefaultValue={defaults.heroHtmlMobile}
          errors={state.fieldErrors?.heroHtml}
        />
        <Field
          name="mockupImageUrl"
          label="Footer Mockup Image Path (optional)"
          defaultValue={defaults.mockupImageUrl}
        />
      </fieldset>

      <div className="grid grid-cols-3 gap-4">
        <Select
          name="type"
          label="Page Type"
          defaultValue={defaults.type}
          options={[
            { value: "normal", label: "Normal" },
            { value: "sales", label: "Sales" },
          ]}
        />
        <Select
          name="skinId"
          label="Skin"
          defaultValue={defaults.skinId}
          options={skins.map((s) => ({ value: s.id, label: s.name }))}
          errors={state.fieldErrors?.skinId}
        />
        <Select
          name="status"
          label="Status"
          defaultValue={defaults.status}
          options={[
            { value: "draft", label: "Draft" },
            { value: "live", label: "Live" },
            { value: "archived", label: "Archived" },
          ]}
        />
      </div>

      {/* Legacy fields — hidden, kept for server-action validation */}
      <input type="hidden" name="basePrice" value={defaults.basePrice || "0"} />
      <input type="hidden" name="recurringPrice" value={defaults.recurringPrice || ""} />
      <input type="hidden" name="billingInterval" value={defaults.billingInterval || "none"} />
      <input type="hidden" name="zohoItemId" value={defaults.zohoItemId || ""} />
      <input type="hidden" name="zohoRecurringItemId" value={defaults.zohoRecurringItemId || ""} />

      {/* Price Tiers */}
      <fieldset className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <legend className="px-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Price Tiers (optional)
        </legend>
        <p className="-mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Quantity-based pricing — e.g. 1-4 = $149, 5-9 = $139, 10+ = $129. Leave empty to use the base price for all quantities.
        </p>
        {priceTiers.map((tier, i) => (
          <div key={i} className={`grid grid-cols-[1fr_1fr_1fr_1fr_auto_auto] items-end gap-2 rounded-lg p-2 ${tier.isBase ? "bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-500/10 dark:ring-indigo-500/30" : ""}`}>
            <div>
              <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Min Qty</label>
              <input
                name={`priceTier_${i}_minQty`}
                value={tier.minQty}
                onChange={(e) => {
                  const next = [...priceTiers];
                  next[i] = { ...next[i], minQty: e.target.value };
                  setPriceTiers(next);
                }}
                className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Max Qty (blank = unlimited)</label>
              <input
                name={`priceTier_${i}_maxQty`}
                value={tier.maxQty}
                onChange={(e) => {
                  const next = [...priceTiers];
                  next[i] = { ...next[i], maxQty: e.target.value };
                  setPriceTiers(next);
                }}
                className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Price (USD)</label>
              <input
                name={`priceTier_${i}_price`}
                value={tier.priceCents}
                onChange={(e) => {
                  const next = [...priceTiers];
                  next[i] = { ...next[i], priceCents: e.target.value };
                  setPriceTiers(next);
                }}
                className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Zoho Item ID</label>
              <input
                name={`priceTier_${i}_zohoItemId`}
                value={tier.zohoItemId}
                onChange={(e) => {
                  const next = [...priceTiers];
                  next[i] = { ...next[i], zohoItemId: e.target.value };
                  setPriceTiers(next);
                }}
                className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Base</label>
              <label className="flex items-center gap-1.5 py-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="radio"
                  name="baseTierIndex"
                  checked={tier.isBase}
                  onChange={() => {
                    setPriceTiers((prev) => prev.map((t, j) => ({ ...t, isBase: j === i })));
                  }}
                />
                Base
              </label>
            </div>
            <button
              type="button"
              onClick={() => setPriceTiers((t) => {
                const next = t.filter((_, j) => j !== i);
                // If we removed the base tier, auto-mark the first one
                if (tier.isBase && next.length > 0 && !next.some((n) => n.isBase)) {
                  next[0] = { ...next[0], isBase: true };
                }
                return next;
              })}
              className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              Remove
            </button>
          </div>
        ))}
        <input type="hidden" name="priceTiersJson" value={JSON.stringify(priceTiers)} />
        <button
          type="button"
          onClick={() => setPriceTiers((t) => [...t, { minQty: "", maxQty: "", priceCents: "", zohoItemId: "", isBase: t.length === 0 }])}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          + Add Tier
        </button>
      </fieldset>

      {/* Billing Plans — hidden when tiered plans is enabled */}
      <fieldset className={`space-y-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-700${tieredPlansEnabled ? " hidden" : ""}`}>
        <legend className="px-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Billing Plans (optional)
        </legend>
        <p className="-mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Recurring billing options — e.g. Monthly $24/mo, Annual $249/yr. Leave empty to use the recurring price above.
        </p>
        <div className="space-y-3">
          {billingPlans.map((plan, i) => (
            <div key={i} className="rounded-xl border border-zinc-200 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-800/40">
              {/* Plan header bar */}
              <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-700">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                    plan.interval === "annually"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400"
                  }`}>
                    {plan.interval === "annually" ? "Annual" : "Monthly"}
                  </span>
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{plan.label || "Untitled Plan"}</span>
                  {plan.priceCents && <span className="text-xs text-zinc-500 dark:text-zinc-400">${plan.priceCents}/{plan.interval === "annually" ? "yr" : "mo"}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {plan.isDefault && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400">DEFAULT</span>}
                  {plan.chargeAtCheckout && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">CHARGE NOW</span>}
                  <button
                    type="button"
                    onClick={() => setBillingPlans((p) => p.filter((_, j) => j !== i))}
                    className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    title="Remove plan"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
              {/* Plan fields */}
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Interval</label>
                  <select
                    name={`billingPlan_${i}_interval`}
                    value={plan.interval}
                    onChange={(e) => {
                      const next = [...billingPlans];
                      next[i] = { ...next[i], interval: e.target.value as "monthly" | "annually" };
                      setBillingPlans(next);
                    }}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annually">Annually</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Label</label>
                  <input
                    name={`billingPlan_${i}_label`}
                    value={plan.label}
                    onChange={(e) => {
                      const next = [...billingPlans];
                      next[i] = { ...next[i], label: e.target.value };
                      setBillingPlans(next);
                    }}
                    className="w-full rounded-lg border border-zinc-300 px-2.5 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Price (USD)</label>
                  <input
                    name={`billingPlan_${i}_price`}
                    value={plan.priceCents}
                    onChange={(e) => {
                      const next = [...billingPlans];
                      next[i] = { ...next[i], priceCents: e.target.value };
                      setBillingPlans(next);
                    }}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-zinc-300 px-2.5 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Zoho Item ID</label>
                  <input
                    name={`billingPlan_${i}_zohoItemId`}
                    value={plan.zohoItemId}
                    onChange={(e) => {
                      const next = [...billingPlans];
                      next[i] = { ...next[i], zohoItemId: e.target.value };
                      setBillingPlans(next);
                    }}
                    className="w-full rounded-lg border border-zinc-300 px-2.5 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>
              {/* Toggles row */}
              <div className="flex items-center gap-5 border-t border-zinc-200 px-4 py-2.5 dark:border-zinc-700">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={plan.isDefault}
                    onChange={(e) => {
                      const next = [...billingPlans];
                      next[i] = { ...next[i], isDefault: e.target.checked };
                      setBillingPlans(next);
                    }}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
                  />
                  Default plan
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={plan.chargeAtCheckout}
                    onChange={(e) => {
                      const next = [...billingPlans];
                      next[i] = { ...next[i], chargeAtCheckout: e.target.checked };
                      setBillingPlans(next);
                    }}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
                  />
                  Charge at checkout
                </label>
              </div>
            </div>
          ))}
        </div>
        <input type="hidden" name="billingPlansJson" value={JSON.stringify(billingPlans)} />
        <button
          type="button"
          onClick={() => setBillingPlans((p) => [...p, { interval: "monthly", label: "Monthly Plan", priceCents: "", zohoItemId: "", chargeAtCheckout: false, isDefault: p.length === 0 }])}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Add Plan
        </button>
      </fieldset>

      {/* Tiered Plans */}
      <fieldset className="space-y-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-700">
        <legend className="px-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Billing Tiered Plans (optional)
        </legend>

        {/* Toggle switch */}
        <div className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3.5 dark:border-zinc-700 dark:bg-zinc-800/40">
          <button
            type="button"
            role="switch"
            aria-checked={tieredPlansEnabled}
            onClick={() => setTieredPlansEnabled(!tieredPlansEnabled)}
            className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
              tieredPlansEnabled ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-600"
            }`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
              tieredPlansEnabled ? "translate-x-[18px]" : "translate-x-[3px]"
            }`} />
          </button>
          <input type="hidden" name="tieredPlansEnabled" value={tieredPlansEnabled ? "on" : ""} />
          <div>
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Enable tiered plans (GOLD / PLATINUM / DIAMOND style)</p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Customers choose a plan tier at checkout. Each tier has qty-based monthly pricing. Annual = monthly × 12 minus the discount %. Overrides simple billing plans above.
            </p>
          </div>
        </div>

        {tieredPlansEnabled && (
          <div className="space-y-4">
            {planTiers.map((tier, ti) => {
              const tierColors = [
                { bg: "bg-amber-50 dark:bg-amber-500/5", border: "border-amber-200 dark:border-amber-500/20", badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400", accent: "border-amber-300 dark:border-amber-500/30" },
                { bg: "bg-sky-50 dark:bg-sky-500/5", border: "border-sky-200 dark:border-sky-500/20", badge: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-400", accent: "border-sky-300 dark:border-sky-500/30" },
                { bg: "bg-violet-50 dark:bg-violet-500/5", border: "border-violet-200 dark:border-violet-500/20", badge: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-400", accent: "border-violet-300 dark:border-violet-500/30" },
                { bg: "bg-rose-50 dark:bg-rose-500/5", border: "border-rose-200 dark:border-rose-500/20", badge: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-400", accent: "border-rose-300 dark:border-rose-500/30" },
              ];
              const c = tierColors[ti % tierColors.length];
              return (
                <div key={ti} className={`overflow-hidden rounded-xl border ${c.border}`}>
                  {/* Tier header */}
                  <div className={`flex items-center justify-between px-4 py-3 ${c.bg}`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${c.badge}`}>
                        {tier.name || `Tier ${ti + 1}`}
                      </span>
                      {tier.isDefault && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400">DEFAULT</span>}
                      {tier.annualDiscountPercent && Number(tier.annualDiscountPercent) > 0 && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">{tier.annualDiscountPercent}% annual discount</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPlanTiers((t) => t.filter((_, j) => j !== ti))}
                      className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                      title="Remove tier"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                    </button>
                  </div>

                  {/* Tier config fields */}
                  <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Tier Name</label>
                      <input
                        value={tier.name}
                        onChange={(e) => {
                          const next = [...planTiers];
                          next[ti] = { ...next[ti], name: e.target.value };
                          setPlanTiers(next);
                        }}
                        placeholder="GOLD"
                        className="w-full rounded-lg border border-zinc-300 px-2.5 py-2 text-sm font-medium text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Annual Discount %</label>
                      <input
                        value={tier.annualDiscountPercent}
                        onChange={(e) => {
                          const next = [...planTiers];
                          next[ti] = { ...next[ti], annualDiscountPercent: e.target.value };
                          setPlanTiers(next);
                        }}
                        placeholder="0"
                        className="w-full rounded-lg border border-zinc-300 px-2.5 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Zoho Monthly ID</label>
                      <input
                        value={tier.zohoMonthlyItemId}
                        onChange={(e) => {
                          const next = [...planTiers];
                          next[ti] = { ...next[ti], zohoMonthlyItemId: e.target.value };
                          setPlanTiers(next);
                        }}
                        className="w-full rounded-lg border border-zinc-300 px-2.5 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Zoho Annual ID</label>
                      <input
                        value={tier.zohoAnnualItemId}
                        onChange={(e) => {
                          const next = [...planTiers];
                          next[ti] = { ...next[ti], zohoAnnualItemId: e.target.value };
                          setPlanTiers(next);
                        }}
                        className="w-full rounded-lg border border-zinc-300 px-2.5 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                    <div className="flex items-end gap-4 pb-0.5">
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={tier.isDefault}
                          onChange={(e) => {
                            const next = planTiers.map((t, j) => ({ ...t, isDefault: j === ti ? e.target.checked : false }));
                            setPlanTiers(next);
                          }}
                          className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
                        />
                        Default
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={tier.chargeAtCheckout}
                          onChange={(e) => {
                            const next = [...planTiers];
                            next[ti] = { ...next[ti], chargeAtCheckout: e.target.checked };
                            setPlanTiers(next);
                          }}
                          className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
                        />
                        Charge&nbsp;now
                      </label>
                    </div>
                  </div>

                  {/* Qty-based price rows */}
                  <div className={`border-t ${c.accent} bg-white/50 px-4 py-3 dark:bg-zinc-900/30`}>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Qty-based monthly prices</p>
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...planTiers];
                          next[ti] = { ...next[ti], prices: [...next[ti].prices, { minQty: "", maxQty: "", monthlyPriceCents: "" }] };
                          setPlanTiers(next);
                        }}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                        Add Row
                      </button>
                    </div>
                    {tier.prices.length > 0 && (
                      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-zinc-100/80 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/80 dark:text-zinc-400">
                              <th className="px-3 py-2">Min Qty</th>
                              <th className="px-3 py-2">Max Qty</th>
                              <th className="px-3 py-2">Monthly (USD)</th>
                              <th className="w-10 px-3 py-2"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                            {tier.prices.map((row, ri) => (
                              <tr key={ri} className="group">
                                <td className="px-2 py-1.5">
                                  <input
                                    value={row.minQty}
                                    onChange={(e) => {
                                      const next = [...planTiers];
                                      const prices = [...next[ti].prices];
                                      prices[ri] = { ...prices[ri], minQty: e.target.value };
                                      next[ti] = { ...next[ti], prices };
                                      setPlanTiers(next);
                                    }}
                                    placeholder="1"
                                    className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-zinc-900 transition focus:border-zinc-300 focus:bg-white dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:bg-zinc-800"
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    value={row.maxQty}
                                    onChange={(e) => {
                                      const next = [...planTiers];
                                      const prices = [...next[ti].prices];
                                      prices[ri] = { ...prices[ri], maxQty: e.target.value };
                                      next[ti] = { ...next[ti], prices };
                                      setPlanTiers(next);
                                    }}
                                    placeholder="∞"
                                    className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-zinc-900 transition focus:border-zinc-300 focus:bg-white dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:bg-zinc-800"
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    value={row.monthlyPriceCents}
                                    onChange={(e) => {
                                      const next = [...planTiers];
                                      const prices = [...next[ti].prices];
                                      prices[ri] = { ...prices[ri], monthlyPriceCents: e.target.value };
                                      next[ti] = { ...next[ti], prices };
                                      setPlanTiers(next);
                                    }}
                                    placeholder="20.00"
                                    className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm font-medium text-zinc-900 transition focus:border-zinc-300 focus:bg-white dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:bg-zinc-800"
                                  />
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [...planTiers];
                                      next[ti] = { ...next[ti], prices: next[ti].prices.filter((_, j) => j !== ri) };
                                      setPlanTiers(next);
                                    }}
                                    className="rounded p-1 text-zinc-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                                    title="Remove row"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {tier.prices.length === 0 && (
                      <p className="py-3 text-center text-xs text-zinc-400 dark:text-zinc-500">No price rows yet — add one above.</p>
                    )}
                  </div>
                </div>
              );
            })}
            <input type="hidden" name="planTiersJson" value={JSON.stringify(planTiers)} />
            <button
              type="button"
              onClick={() => setPlanTiers((t) => [...t, { name: "", annualDiscountPercent: "0", zohoMonthlyItemId: "", zohoAnnualItemId: "", chargeAtCheckout: false, isDefault: t.length === 0, prices: [{ minQty: "1", maxQty: "", monthlyPriceCents: "" }] }])}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-4 py-2.5 text-sm text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Add Tier
            </button>
          </div>
        )}
      </fieldset>

      {/* Upgrade offer hidden fields — preserved for backward compat */}
      <input type="hidden" name="upgradeTitle" value={defaults.upgradeTitle || ""} />
      <input type="hidden" name="upgradePrice" value={defaults.upgradePrice || ""} />
      <input type="hidden" name="upgradeDescription" value={defaults.upgradeDescription || ""} />
      <input type="hidden" name="upgradeRecurringPrice" value={defaults.upgradeRecurringPrice || ""} />
      <input type="hidden" name="upgradeZohoItemId" value={defaults.upgradeZohoItemId || ""} />
      <input type="hidden" name="upgradeZohoRecurringItemId" value={defaults.upgradeZohoRecurringItemId || ""} />

      <div className="grid grid-cols-2 gap-4">
        <Field
          name="successRedirectUrl"
          label="Success Redirect URL"
          defaultValue={defaults.successRedirectUrl}
          errors={state.fieldErrors?.successRedirectUrl}
        />
        <Field
          name="failRedirectUrl"
          label="Fail Redirect URL"
          defaultValue={defaults.failRedirectUrl}
          errors={state.fieldErrors?.failRedirectUrl}
        />
      </div>

      <Field name="webhookUrl" label="Marketing Webhook URL (optional)" defaultValue={defaults.webhookUrl} />

      {availableAddons && (
        <div>
          <label className="mb-2 block text-sm text-zinc-700 dark:text-zinc-300">
            Add-ons (optional — available for normal and sales pages alike; reorder them after creating the page)
          </label>
          {availableAddons.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No add-ons exist yet — create some first.</p>
          ) : (
            <div className="space-y-2">
              {availableAddons.map((addon) => (
                <label
                  key={addon.id}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200 p-2.5 text-sm dark:border-zinc-700"
                >
                  <input type="checkbox" name="addonIds" value={addon.id} />
                  <span className="text-zinc-900 dark:text-zinc-100">
                    {addon.name} — ${(addon.priceCents / 100).toFixed(2)}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" name="showPromoCode" defaultChecked={defaults.showPromoCode} />
        Show promo code field at checkout
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  errors,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  errors?: string[];
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <input
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      />
      {errors?.[0] && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors[0]}</p>}
    </div>
  );
}

function Select({
  name,
  label,
  defaultValue,
  options,
  errors,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  errors?: string[];
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {errors?.[0] && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors[0]}</p>}
    </div>
  );
}
