"use client";

import { useActionState } from "react";
import { revealCard } from "@/app/(main)/admin/(protected)/orders/[id]/actions";
import { initialRevealCardState } from "@/app/(main)/admin/(protected)/orders/[id]/types";

export function RevealCardPanel({ orderId, cardLast4, cardBrand }: { orderId: string; cardLast4: string; cardBrand: string | null }) {
  const boundAction = revealCard.bind(null, orderId);
  const [state, formAction, pending] = useActionState(boundAction, initialRevealCardState);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Card on File</h2>
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
        {cardBrand ? `${cardBrand} ` : ""}ending in {cardLast4}
      </p>

      {state.status === "revealed" ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="text-zinc-900 dark:text-zinc-100">
            Card number: <span className="font-mono font-semibold">{state.cardNumber}</span>
          </div>
          <div className="text-zinc-900 dark:text-zinc-100">
            CVV: <span className="font-mono font-semibold">{state.cvv}</span>
          </div>
          <div className="text-zinc-900 dark:text-zinc-100">
            Expires: <span className="font-mono font-semibold">{state.expiry ?? "not on file for this order"}</span>
          </div>
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            This reveal has been logged. Refresh the page to hide these values again.
          </p>
        </div>
      ) : (
        <form action={formAction} className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="hashKey" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
              Reveal key
            </label>
            <input
              id="hashKey"
              name="hashKey"
              type="text"
              required
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {pending ? "Checking…" : "Reveal"}
          </button>
        </form>
      )}
      {state.status === "error" && state.message && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </div>
  );
}
