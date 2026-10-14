"use client";

import { useActionState } from "react";
import { updateEmailSettings } from "@/app/(main)/admin/(protected)/settings/email/actions";
import { initialEmailSettingsFormState } from "@/app/(main)/admin/(protected)/settings/email/types";

export interface EmailSettingsFormDefaults {
  hasSendgridApiKey: boolean;
  emailFrom: string;
  internalNotifyEmails: string;
  customerConfirmationEnabled: boolean;
  customerConfirmationSubject: string;
  customerConfirmationHtml: string;
  internalNotifySubject: string;
  internalNotifyHtml: string;
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelClass = "mb-1 block text-sm text-zinc-700 dark:text-zinc-300";
const sectionClass = "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

export function EmailSettingsForm({ defaults }: { defaults: EmailSettingsFormDefaults }) {
  const [state, formAction, pending] = useActionState(updateEmailSettings, initialEmailSettingsFormState);

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
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">SendGrid</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="sendgridApiKey" className={labelClass}>
              API Key{" "}
              {defaults.hasSendgridApiKey && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">(saved — leave blank to keep)</span>
              )}
            </label>
            <input
              id="sendgridApiKey"
              name="sendgridApiKey"
              type="password"
              placeholder={defaults.hasSendgridApiKey ? "•••••••••••••••• (unchanged)" : "SG.xxxxxxxx"}
              autoComplete="off"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="emailFrom" className={labelClass}>
              From Address
            </label>
            <input id="emailFrom" name="emailFrom" defaultValue={defaults.emailFrom} className={inputClass} />
            {state.fieldErrors?.emailFrom?.[0] && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{state.fieldErrors.emailFrom[0]}</p>
            )}
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="internalNotifyEmails" className={labelClass}>
            Internal Notify Addresses (comma or newline separated)
          </label>
          <textarea
            id="internalNotifyEmails"
            name="internalNotifyEmails"
            defaultValue={defaults.internalNotifyEmails}
            rows={2}
            className={`${inputClass} font-mono text-sm`}
          />
          {state.fieldErrors?.internalNotifyEmails?.[0] && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{state.fieldErrors.internalNotifyEmails[0]}</p>
          )}
        </div>
      </section>

      <section className={sectionClass}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Customer Confirmation Email</h2>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              name="customerConfirmationEnabled"
              defaultChecked={defaults.customerConfirmationEnabled}
              className="h-4 w-4 rounded accent-indigo-600"
            />
            Send confirmation email
          </label>
        </div>
        <div className="mb-3 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
          <p className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">Available tokens:</p>
          <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {`{{firstName}}  {{lastName}}  {{email}}  {{phone}}  {{productName}}  {{amount}}  {{orderId}}  {{quantity}}  {{unitPrice}}  {{billingType}}  {{billingAddress}}  {{shippingAddress}}`}
          </p>
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="customerConfirmationSubject" className={labelClass}>
              Subject
            </label>
            <input
              id="customerConfirmationSubject"
              name="customerConfirmationSubject"
              defaultValue={defaults.customerConfirmationSubject}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="customerConfirmationHtml" className={labelClass}>
              Body (HTML)
            </label>
            <textarea
              id="customerConfirmationHtml"
              name="customerConfirmationHtml"
              defaultValue={defaults.customerConfirmationHtml}
              rows={6}
              className={`${inputClass} font-mono text-sm`}
            />
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Internal Order Notification Email</h2>
        <div className="mb-3 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
          <p className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">Available tokens:</p>
          <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {`{{orderBreakdown}} — full HTML order summary table`}
            <br />
            {`{{orderId}}  {{productName}}  {{firstName}}  {{lastName}}  {{email}}  {{phone}}  {{amount}}  {{quantity}}  {{unitPrice}}  {{billingType}}  {{planPrice}}  {{recurringTotal}}  {{addons}}  {{promoCode}}  {{discount}}  {{billingAddress}}  {{shippingAddress}}  {{cardHashKey}}`}
          </p>
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="internalNotifySubject" className={labelClass}>
              Subject
            </label>
            <input
              id="internalNotifySubject"
              name="internalNotifySubject"
              defaultValue={defaults.internalNotifySubject}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="internalNotifyHtml" className={labelClass}>
              Body (HTML)
            </label>
            <textarea
              id="internalNotifyHtml"
              name="internalNotifyHtml"
              defaultValue={defaults.internalNotifyHtml}
              rows={6}
              className={`${inputClass} font-mono text-sm`}
            />
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save Email Settings"}
      </button>
    </form>
  );
}
