"use client";

import { useActionState, useState } from "react";
import { createPromoCode } from "@/app/(main)/admin/(protected)/promo-codes/actions";
import { initialPromoCodeFormState } from "@/app/(main)/admin/(protected)/promo-codes/types";

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelClass = "mb-1 block text-xs text-zinc-500 dark:text-zinc-400";
const selectClass = `${inputClass} bg-white dark:bg-zinc-800`;

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

function DiscountSlotRow({ prefix, label }: { prefix: string; label: string }) {
  const [type, setType] = useState("");
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className={labelClass}>{label} Type</label>
        <select
          name={`${prefix}DiscountType`}
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={selectClass}
        >
          <option value="">None</option>
          <option value="percent">Percent</option>
          <option value="fixed">Fixed (USD)</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>{label} Value</label>
        <input
          name={`${prefix}DiscountValue`}
          className={inputClass}
          placeholder={type === "percent" ? "e.g. 10" : type === "fixed" ? "e.g. 20.00" : "—"}
          disabled={!type}
        />
      </div>
    </div>
  );
}

export function PromoCodeForm({ checkoutPages }: { checkoutPages: { id: string; title: string }[] }) {
  const [state, formAction, pending] = useActionState(createPromoCode, initialPromoCodeFormState);
  const [mode, setMode] = useState<"single" | "split">("single");

  return (
    <form
      action={formAction}
      className="mb-8 space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
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

      <input type="hidden" name="discountMode" value={mode} />

      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className={labelClass}>Code</label>
          <input name="code" required className={inputClass} placeholder="WELCOME10" />
          {state.fieldErrors?.code?.[0] && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.fieldErrors.code[0]}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Discount Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "single" | "split")}
            className={selectClass}
          >
            <option value="single">Single</option>
            <option value="split">Split (Device / Monthly / Annual)</option>
          </select>
        </div>

        {mode === "single" && (
          <>
            <div>
              <label className={labelClass}>Discount Type</label>
              <select name="discountType" defaultValue="percent" className={selectClass}>
                <option value="percent">Percent</option>
                <option value="fixed">Fixed (USD)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Value</label>
              <input name="discountValue" required className={inputClass} placeholder="10" />
            </div>
          </>
        )}

        {mode === "split" && (
          <div className="col-span-2 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Leave a slot blank for no discount on that component</p>
            <DiscountSlotRow prefix="device" label="Device" />
            <DiscountSlotRow prefix="monthly" label="Monthly Plan" />
            <DiscountSlotRow prefix="annual" label="Annual Plan" />
            <label className="flex items-center gap-2 pt-1 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" name="perDevice" value="true" className="rounded border-zinc-300 dark:border-zinc-600" />
              Per device / Per plan
              <span className="text-xs text-zinc-400 dark:text-zinc-500">— fixed discount × quantity instead of flat total</span>
            </label>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3">
        {mode === "single" && (
          <div>
            <label className={labelClass}>Discount Target</label>
            <select name="appliesTo" defaultValue="device" className={selectClass}>
              <option value="device">Device only</option>
              <option value="monthly">Monthly plan only</option>
              <option value="annual">Annual plan only</option>
              <option value="device_monthly">Device + Monthly</option>
              <option value="device_annual">Device + Annual</option>
              <option value="monthly_annual">Monthly + Annual</option>
              <option value="all">All (Device + Plan)</option>
            </select>
          </div>
        )}
        {mode === "single" && (
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" name="perDevice" value="true" className="rounded border-zinc-300 dark:border-zinc-600" />
              Per device / Per plan
              <span className="text-xs text-zinc-400 dark:text-zinc-500">— fixed × qty</span>
            </label>
          </div>
        )}
        <div>
          <label className={labelClass}>Checkout Page (optional)</label>
          <select name="appliesToCheckoutPageId" defaultValue="" className={selectClass}>
            <option value="">All checkout pages</option>
            {checkoutPages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className={labelClass}>Max Redemptions (optional)</label>
          <input name="maxRedemptions" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Expires At (optional)</label>
          <input type="datetime-local" name="expiresAt" className={`${inputClass} dark:[color-scheme:dark]`} />
        </div>
        <div>
          <label className={labelClass}>Timezone</label>
          <select name="timezone" defaultValue="America/New_York" className={selectClass}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create Promo Code"}
          </button>
        </div>
      </div>
    </form>
  );
}
