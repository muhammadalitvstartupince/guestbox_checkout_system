"use client";

import { useActionState } from "react";
import { sendTestEmail } from "@/app/(main)/admin/(protected)/settings/email/actions";
import { initialSendTestEmailState } from "@/app/(main)/admin/(protected)/settings/email/types";

export function TestEmailPanel({ defaultTo }: { defaultTo: string }) {
  const [state, formAction, pending] = useActionState(sendTestEmail, initialSendTestEmailState);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Test SendGrid Connection</h2>
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        Sends a real email using the currently <em>saved</em> API key and from-address — save your changes above first
        if you just updated them.
      </p>

      <form action={formAction} className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="testEmailTo" className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
            Send test to
          </label>
          <input
            id="testEmailTo"
            name="testEmailTo"
            type="email"
            required
            defaultValue={defaultTo}
            className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Sending…" : "Send Test Email"}
        </button>
      </form>

      {state.status !== "idle" && state.message && (
        <p
          className={`mt-2 text-sm ${
            state.status === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {state.message}
        </p>
      )}
    </section>
  );
}
