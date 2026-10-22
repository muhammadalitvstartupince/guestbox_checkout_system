"use client";

import { useActionState } from "react";
import { sendTestSlack, runAbandonedCheckoutScan } from "@/app/(main)/admin/(protected)/settings/abandoned-alerts/actions";
import { initialTestSlackState, initialRunScanState } from "@/app/(main)/admin/(protected)/settings/abandoned-alerts/types";

const sectionClass = "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";
const btnClass =
  "rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

function StatusMessage({ status, message }: { status: string; message?: string }) {
  if (status === "idle" || !message) return null;
  return (
    <p
      className={`mt-2 text-sm ${
        status === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
      }`}
    >
      {message}
    </p>
  );
}

export function TestSlackPanel() {
  const [testState, testAction, testPending] = useActionState(sendTestSlack, initialTestSlackState);
  const [scanState, scanAction, scanPending] = useActionState(runAbandonedCheckoutScan, initialRunScanState);

  return (
    <div className="space-y-4">
      <section className={sectionClass}>
        <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Test Slack Connection</h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Sends a sample message using the currently <em>saved</em> webhook URL — save your changes below first if you just updated it.
        </p>
        <form action={testAction}>
          <button type="submit" disabled={testPending} className={btnClass}>
            {testPending ? "Sending…" : "Send Test Message"}
          </button>
        </form>
        <StatusMessage status={testState.status} message={testState.message} />
      </section>

      <section className={sectionClass}>
        <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Run Scan Now</h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Manually scan for abandoned checkouts and send Slack alerts — same as the automatic cron job, but triggered immediately.
        </p>
        <form action={scanAction}>
          <button type="submit" disabled={scanPending} className={btnClass}>
            {scanPending ? "Scanning…" : "Run Abandoned Checkout Scan"}
          </button>
        </form>
        <StatusMessage status={scanState.status} message={scanState.message} />
      </section>
    </div>
  );
}
