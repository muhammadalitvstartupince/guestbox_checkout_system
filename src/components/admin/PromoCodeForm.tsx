"use client";

import { useActionState } from "react";
import { createPromoCode } from "@/app/(main)/admin/(protected)/promo-codes/actions";
import { initialPromoCodeFormState } from "@/app/(main)/admin/(protected)/promo-codes/types";

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelClass = "mb-1 block text-xs text-zinc-500 dark:text-zinc-400";

export function PromoCodeForm({ checkoutPages }: { checkoutPages: { id: string; title: string }[] }) {
  const [state, formAction, pending] = useActionState(createPromoCode, initialPromoCodeFormState);

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

      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className={labelClass}>Code</label>
          <input name="code" required className={inputClass} placeholder="WELCOME10" />
          {state.fieldErrors?.code?.[0] && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.fieldErrors.code[0]}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Discount Type</label>
          <select name="discountType" defaultValue="percent" className={`${inputClass} bg-white dark:bg-zinc-800`}>
            <option value="percent">Percent</option>
            <option value="fixed">Fixed (USD)</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Value</label>
          <input name="discountValue" required className={inputClass} placeholder="10" />
        </div>
        <div>
          <label className={labelClass}>Applies To (optional)</label>
          <select name="appliesToCheckoutPageId" defaultValue="" className={`${inputClass} bg-white dark:bg-zinc-800`}>
            <option value="">All checkout pages</option>
            {checkoutPages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Max Redemptions (optional)</label>
          <input name="maxRedemptions" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Expires At (optional)</label>
          <input type="date" name="expiresAt" className={`${inputClass} dark:[color-scheme:dark]`} />
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
