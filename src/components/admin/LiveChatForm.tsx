"use client";

import { useActionState } from "react";
import { updateLiveChatSettings } from "@/app/(main)/admin/(protected)/settings/livechat/actions";
import { initialLiveChatFormState } from "@/app/(main)/admin/(protected)/settings/livechat/types";

export function LiveChatForm({ enabled }: { enabled: boolean }) {
  const [state, formAction, pending] = useActionState(updateLiveChatSettings, initialLiveChatFormState);

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

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div>
            <span className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">Live Chat Widget</span>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Show the Chatwoot live chat bubble on all checkout pages.
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={enabled}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-zinc-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-indigo-600 peer-checked:after:translate-x-full dark:bg-zinc-600 dark:peer-checked:bg-indigo-500" />
          </label>
        </div>
      </section>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
