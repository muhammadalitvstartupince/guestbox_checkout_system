"use client";

import { useActionState } from "react";
import {
  updateInvoiceSlackSettings,
  sendTestInvoiceSlack,
  runInvoicePaidScan,
} from "@/app/(main)/admin/(protected)/settings/invoice-alerts/actions";
import type { FormState, ActionState } from "@/app/(main)/admin/(protected)/settings/invoice-alerts/actions";

const inputClass = "w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelClass = "mb-1 block text-sm text-zinc-700 dark:text-zinc-300";
const sectionClass = "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";
const btnClass = "rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

function StatusMsg({ status, message }: { status: string; message?: string }) {
  if (status === "idle" || !message) return null;
  return (
    <p className={`mt-2 text-sm ${status === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
      {message}
    </p>
  );
}

const initialForm: FormState = { status: "idle" };
const initialAction: ActionState = { status: "idle" };

export function InvoiceSlackSettingsForm({ defaults }: { defaults: { enabled: boolean; slackWebhookUrl: string } }) {
  const [formState, formAction, formPending] = useActionState(updateInvoiceSlackSettings, initialForm);
  const [testState, testAction, testPending] = useActionState(sendTestInvoiceSlack, initialAction);
  const [scanState, scanAction, scanPending] = useActionState(runInvoicePaidScan, initialAction);

  return (
    <div className="space-y-6">
      {/* Settings form */}
      <form action={formAction} className="space-y-6">
        {formState.message && (
          <div className={`rounded-lg border p-3 text-sm ${formState.status === "error" ? "border-red-300 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400" : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"}`}>
            {formState.message}
          </div>
        )}

        <section className={sectionClass}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Invoice Paid — Slack Alerts</h2>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" name="enabled" defaultChecked={defaults.enabled} className="h-4 w-4 rounded accent-indigo-600" />
              Enable alerts
            </label>
          </div>
          <div>
            <label htmlFor="slackWebhookUrl" className={labelClass}>Slack Webhook URL</label>
            <input id="slackWebhookUrl" name="slackWebhookUrl" type="url" defaultValue={defaults.slackWebhookUrl} placeholder="https://hooks.slack.com/services/..." className={inputClass} />
            {formState.fieldErrors?.slackWebhookUrl?.[0] && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formState.fieldErrors.slackWebhookUrl[0]}</p>
            )}
          </div>
          <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">Runs every 2 minutes. Sends a Slack message for each newly paid invoice (once only).</p>
        </section>

        <button type="submit" disabled={formPending} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60">
          {formPending ? "Saving…" : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
