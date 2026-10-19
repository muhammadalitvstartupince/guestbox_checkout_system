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

      {/* Billing Plans */}
      <fieldset className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <legend className="px-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Billing Plans (optional)
        </legend>
        <p className="-mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Recurring billing options — e.g. Monthly $24/mo, Annual $249/yr. Leave empty to use the recurring price above.
        </p>
        {billingPlans.map((plan, i) => (
          <div key={i} className="grid grid-cols-7 items-end gap-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Interval</label>
              <select
                name={`billingPlan_${i}_interval`}
                value={plan.interval}
                onChange={(e) => {
                  const next = [...billingPlans];
                  next[i] = { ...next[i], interval: e.target.value as "monthly" | "annually" };
                  setBillingPlans(next);
                }}
                className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="monthly">Monthly</option>
                <option value="annually">Annually</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Label</label>
              <input
                name={`billingPlan_${i}_label`}
                value={plan.label}
                onChange={(e) => {
                  const next = [...billingPlans];
                  next[i] = { ...next[i], label: e.target.value };
                  setBillingPlans(next);
                }}
                className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Price (USD)</label>
              <input
                name={`billingPlan_${i}_price`}
                value={plan.priceCents}
                onChange={(e) => {
                  const next = [...billingPlans];
                  next[i] = { ...next[i], priceCents: e.target.value };
                  setBillingPlans(next);
                }}
                className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Zoho Item ID</label>
              <input
                name={`billingPlan_${i}_zohoItemId`}
                value={plan.zohoItemId}
                onChange={(e) => {
                  const next = [...billingPlans];
                  next[i] = { ...next[i], zohoItemId: e.target.value };
                  setBillingPlans(next);
                }}
                className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Default?</label>
              <label className="flex items-center gap-1.5 py-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={plan.isDefault}
                  onChange={(e) => {
                    const next = [...billingPlans];
                    next[i] = { ...next[i], isDefault: e.target.checked };
                    setBillingPlans(next);
                  }}
                />
                Default
              </label>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Charge now?</label>
              <label className="flex items-center gap-1.5 py-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={plan.chargeAtCheckout}
                  onChange={(e) => {
                    const next = [...billingPlans];
                    next[i] = { ...next[i], chargeAtCheckout: e.target.checked };
                    setBillingPlans(next);
                  }}
                />
                At checkout
              </label>
            </div>
            <button
              type="button"
              onClick={() => setBillingPlans((p) => p.filter((_, j) => j !== i))}
              className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              Remove
            </button>
          </div>
        ))}
        <input type="hidden" name="billingPlansJson" value={JSON.stringify(billingPlans)} />
        <button
          type="button"
          onClick={() => setBillingPlans((p) => [...p, { interval: "monthly", label: "Monthly Plan", priceCents: "", zohoItemId: "", chargeAtCheckout: false, isDefault: p.length === 0 }])}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          + Add Plan
        </button>
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
