"use client";

import { useActionState } from "react";
import { updateAbandonedAlertSettings } from "@/app/(main)/admin/(protected)/settings/abandoned-alerts/actions";
import { initialAbandonedAlertSettingsFormState } from "@/app/(main)/admin/(protected)/settings/abandoned-alerts/types";

interface Defaults {
  enabled: boolean;
  slackWebhookUrl: string;
  timeoutMinutes: number;
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelClass = "mb-1 block text-sm text-zinc-700 dark:text-zinc-300";
const sectionClass = "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

export function AbandonedAlertSettingsForm({ defaults }: { defaults: Defaults }) {
  const [state, formAction, pending] = useActionState(updateAbandonedAlertSettings, initialAbandonedAlertSettingsFormState);

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

      <section className={sectionClass}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Abandoned Checkout Alerts</h2>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={defaults.enabled}
              className="h-4 w-4 rounded accent-indigo-600"
            />
            Enable alerts
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="slackWebhookUrl" className={labelClass}>
              Slack Webhook URL
            </label>
            <input
              id="slackWebhookUrl"
              name="slackWebhookUrl"
              type="url"
              defaultValue={defaults.slackWebhookUrl}
              placeholder="https://hooks.slack.com/services/..."
              className={inputClass}
            />
            {state.fieldErrors?.slackWebhookUrl?.[0] && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{state.fieldErrors.slackWebhookUrl[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="timeoutMinutes" className={labelClass}>
              Timeout (minutes) — how long before a pending order is considered abandoned
            </label>
            <input
              id="timeoutMinutes"
              name="timeoutMinutes"
              type="number"
              min={15}
              max={60}
              defaultValue={defaults.timeoutMinutes}
              className={`${inputClass} max-w-32`}
            />
            {state.fieldErrors?.timeoutMinutes?.[0] && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{state.fieldErrors.timeoutMinutes[0]}</p>
            )}
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save Settings"}
      </button>
    </form>
  );
}
