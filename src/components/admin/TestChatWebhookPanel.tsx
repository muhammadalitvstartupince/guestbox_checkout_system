"use client";

import { useActionState } from "react";
import { testChatStartedWebhook, testChatAbandonedWebhook, runAbandonedChatScan, testLlmApiKey } from "@/app/(main)/admin/(protected)/settings/chatbot/actions";
import { initialTestWebhookState } from "@/app/(main)/admin/(protected)/settings/chatbot/types";

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

export function TestChatWebhookPanel() {
  const [startedState, startedAction, startedPending] = useActionState(testChatStartedWebhook, initialTestWebhookState);
  const [abandonedState, abandonedAction, abandonedPending] = useActionState(testChatAbandonedWebhook, initialTestWebhookState);
  const [scanState, scanAction, scanPending] = useActionState(runAbandonedChatScan, initialTestWebhookState);
  const [llmState, llmAction, llmPending] = useActionState(testLlmApiKey, initialTestWebhookState);

  return (
    <div className="space-y-4">
      <section className={sectionClass}>
        <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">LLM API Key</h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Send a tiny test message to Claude to verify the Anthropic API key is valid and working.
        </p>
        <form action={llmAction}>
          <button type="submit" disabled={llmPending} className={btnClass}>
            {llmPending ? "Testing..." : "Test API Key"}
          </button>
        </form>
        <StatusMessage status={llmState.status} message={llmState.message} />
      </section>

      <section className={sectionClass}>
        <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Test Slack Notifications</h2>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          Send test Slack messages with dummy data using the currently <em>saved</em> webhook URLs — save your changes below first if you just updated them.
        </p>

        <div className="flex flex-wrap gap-3">
          <div>
            <form action={startedAction}>
              <button type="submit" disabled={startedPending} className={btnClass}>
                {startedPending ? "Sending..." : "Test Chat Started"}
              </button>
            </form>
            <StatusMessage status={startedState.status} message={startedState.message} />
          </div>

          <div>
            <form action={abandonedAction}>
              <button type="submit" disabled={abandonedPending} className={btnClass}>
                {abandonedPending ? "Sending..." : "Test Chat Abandoned"}
              </button>
            </form>
            <StatusMessage status={abandonedState.status} message={abandonedState.message} />
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Run Abandoned Chat Scan</h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Manually scan for abandoned chats and send Slack alerts with AI summaries — same as the automatic cron job, but triggered immediately.
        </p>
        <form action={scanAction}>
          <button type="submit" disabled={scanPending} className={btnClass}>
            {scanPending ? "Scanning..." : "Run Abandoned Chat Scan"}
          </button>
        </form>
        <StatusMessage status={scanState.status} message={scanState.message} />
      </section>
    </div>
  );
}
