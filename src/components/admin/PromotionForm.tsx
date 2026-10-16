"use client";

import { useActionState, useMemo, useState } from "react";
import { createPromotion, updatePromotion } from "@/app/(main)/admin/(protected)/promotions/actions";
import { initialPromotionFormState } from "@/app/(main)/admin/(protected)/promotions/types";
import { calculateOrderPrice } from "@/lib/pricing/calculate";

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelClass = "mb-1 block text-xs text-zinc-500 dark:text-zinc-400";

interface PromoCodeOption {
  id: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
}

interface PriceTierOption {
  id: string;
  checkoutPageId: string;
  minQty: number;
  maxQty: number | null;
  priceCents: number;
}

interface CheckoutPageOption {
  id: string;
  title: string;
}

export interface PromotionDefaults {
  id: string;
  name: string;
  promoCodeId: string;
  priceTierId: string;
  checkoutPageIds: string[];
  timezone: string;
  startsAt: string; // datetime-local string (in promotion's tz)
  endsAt: string;
}

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function tierLabel(t: PriceTierOption) {
  const range = t.maxQty ? `${t.minQty}-${t.maxQty}` : `${t.minQty}+`;
  return `Qty ${range} — ${formatCents(t.priceCents)}`;
}

export function PromotionForm({
  promoCodes,
  priceTiers,
  checkoutPages,
  defaults,
}: {
  promoCodes: PromoCodeOption[];
  priceTiers: PriceTierOption[];
  checkoutPages: CheckoutPageOption[];
  defaults?: PromotionDefaults;
}) {
  const isEdit = defaults != null;
  const boundAction = isEdit
    ? updatePromotion.bind(null, defaults.id)
    : createPromotion;
  const [state, formAction, pending] = useActionState(boundAction, initialPromotionFormState);

  const [selectedPromoCodeId, setSelectedPromoCodeId] = useState(defaults?.promoCodeId ?? "");
  const [selectedPriceTierId, setSelectedPriceTierId] = useState(defaults?.priceTierId ?? "");
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>(defaults?.checkoutPageIds ?? []);

  const selectedPromo = promoCodes.find((p) => p.id === selectedPromoCodeId);
  const selectedTier = priceTiers.find((t) => t.id === selectedPriceTierId);

  // Filter tiers to those belonging to selected checkout pages
  const availableTiers = useMemo(
    () =>
      selectedPageIds.length > 0
        ? priceTiers.filter((t) => selectedPageIds.includes(t.checkoutPageId))
        : priceTiers,
    [priceTiers, selectedPageIds],
  );

  // Reset tier selection if no longer in available list
  const effectiveTier =
    selectedTier && availableTiers.some((t) => t.id === selectedTier.id) ? selectedTier : null;

  // Price preview
  const preview = useMemo(() => {
    if (!selectedPromo || !effectiveTier) return null;
    const result = calculateOrderPrice({
      basePriceCents: effectiveTier.priceCents,
      quantity: 1,
      promo: { type: selectedPromo.discountType, value: selectedPromo.discountValue },
    });
    return result;
  }, [selectedPromo, effectiveTier]);

  function handlePageToggle(pageId: string) {
    setSelectedPageIds((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId],
    );
  }

  return (
    <form
      action={formAction}
      className="mb-8 space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {isEdit ? "Edit Promotion" : "Create Promotion"}
      </h3>

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

      {/* Row 1: Name + Promo Code */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Name</label>
          <input name="name" required className={inputClass} placeholder="Launch Week Sale" defaultValue={defaults?.name ?? ""} />
          {state.fieldErrors?.name?.[0] && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.fieldErrors.name[0]}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Promo Code (auto-applied)</label>
          <select
            name="promoCodeId"
            required
            value={selectedPromoCodeId}
            onChange={(e) => setSelectedPromoCodeId(e.target.value)}
            className={`${inputClass} bg-white dark:bg-zinc-800`}
          >
            <option value="">Select promo code…</option>
            {promoCodes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} ({p.discountType === "percent" ? `${p.discountValue}%` : formatCents(p.discountValue)})
              </option>
            ))}
          </select>
          {state.fieldErrors?.promoCodeId?.[0] && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.fieldErrors.promoCodeId[0]}</p>
          )}
        </div>
      </div>

      {/* Row 2: Checkout Pages (multi-select via checkboxes) */}
      <div>
        <label className={labelClass}>Target Checkout Pages</label>
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          {checkoutPages.map((page) => (
            <label key={page.id} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                name="checkoutPageIds"
                value={page.id}
                checked={selectedPageIds.includes(page.id)}
                onChange={() => handlePageToggle(page.id)}
                className="rounded border-zinc-300 dark:border-zinc-600"
              />
              {page.title}
            </label>
          ))}
          {checkoutPages.length === 0 && (
            <p className="text-xs text-zinc-400 col-span-2">No checkout pages found.</p>
          )}
        </div>
        {state.fieldErrors?.checkoutPageIds?.[0] && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.fieldErrors.checkoutPageIds[0]}</p>
        )}
      </div>

      {/* Row 3: Price Tier + Timezone */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Target Price Tier (original price)</label>
          <select
            name="priceTierId"
            required
            value={selectedPriceTierId}
            onChange={(e) => setSelectedPriceTierId(e.target.value)}
            className={`${inputClass} bg-white dark:bg-zinc-800`}
          >
            <option value="">Select price tier…</option>
            {availableTiers.map((t) => (
              <option key={t.id} value={t.id}>
                {tierLabel(t)}
              </option>
            ))}
          </select>
          {state.fieldErrors?.priceTierId?.[0] && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.fieldErrors.priceTierId[0]}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Timezone</label>
          <select name="timezone" defaultValue={defaults?.timezone ?? "America/New_York"} className={`${inputClass} bg-white dark:bg-zinc-800`}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 4: Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Starts At (optional)</label>
          <input type="datetime-local" name="startsAt" defaultValue={defaults?.startsAt ?? ""} className={`${inputClass} dark:[color-scheme:dark]`} />
        </div>
        <div>
          <label className={labelClass}>Ends At (optional)</label>
          <input type="datetime-local" name="endsAt" defaultValue={defaults?.endsAt ?? ""} className={`${inputClass} dark:[color-scheme:dark]`} />
        </div>
      </div>

      {/* Price Preview */}
      {preview && effectiveTier && selectedPromo && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <p className="mb-1 text-xs font-semibold text-indigo-700 uppercase dark:text-indigo-400">
            Price Preview
          </p>
          <div className="space-y-0.5 text-sm text-indigo-900 dark:text-indigo-200">
            <p>
              Original price: <span className="line-through">{formatCents(effectiveTier.priceCents)}</span>
            </p>
            <p>
              Discount: −{formatCents(preview.discountCents)}{" "}
              <span className="text-xs text-indigo-600 dark:text-indigo-400">
                ({selectedPromo.discountType === "percent" ? `${selectedPromo.discountValue}%` : "fixed"})
              </span>
            </p>
            <p className="font-bold">
              Final price: {formatCents(preview.totalCents)}
            </p>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Create Promotion")}
      </button>
    </form>
  );
}
