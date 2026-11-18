"use client";

import { useActionState } from "react";
import { updateChatbotSettings } from "@/app/(main)/admin/(protected)/settings/chatbot/actions";
import { initialChatbotSettingsFormState } from "@/app/(main)/admin/(protected)/settings/chatbot/types";
import { AVAILABLE_MODELS } from "@/lib/chatbot/models";

interface Defaults {
  systemPrompt: string;
  webhookChatStarted: string;
  webhookChatAbandoned: string;
  maxMessages: number;
  chatModel: string;
  summarizerModel: string;
  leadGateEnabled: boolean;
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelClass = "mb-1 block text-sm text-zinc-700 dark:text-zinc-300";
const sectionClass = "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

export function ChatbotSettingsForm({ defaults }: { defaults: Defaults }) {
  const [state, formAction, pending] = useActionState(updateChatbotSettings, initialChatbotSettingsFormState);

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

      {/* Webhooks */}
      <section className={sectionClass}>
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Slack Notifications</h2>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          Add Slack webhook URLs to receive notifications when chat events occur. Leave empty to disable.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="webhookChatStarted" className={labelClass}>
              AI Chat Started — Slack Webhook URL
            </label>
            <input
              id="webhookChatStarted"
              name="webhookChatStarted"
              type="url"
              defaultValue={defaults.webhookChatStarted}
              placeholder="https://hooks.slack.com/services/..."
              className={inputClass}
            />
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Posts to Slack when a customer starts a chat. Includes name, email, phone, and a link to the chat log.
            </p>
            {state.fieldErrors?.webhookChatStarted?.[0] && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{state.fieldErrors.webhookChatStarted[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="webhookChatAbandoned" className={labelClass}>
              AI Chat Abandoned — Slack Webhook URL
            </label>
            <input
              id="webhookChatAbandoned"
              name="webhookChatAbandoned"
              type="url"
              defaultValue={defaults.webhookChatAbandoned}
              placeholder="https://hooks.slack.com/services/..."
              className={inputClass}
            />
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Posts to Slack when a chat is abandoned. Includes an AI-generated conversation summary and a link to the full chat log.
            </p>
            {state.fieldErrors?.webhookChatAbandoned?.[0] && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{state.fieldErrors.webhookChatAbandoned[0]}</p>
            )}
          </div>
        </div>
      </section>

      {/* General */}
      <section className={sectionClass}>
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">General</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className={labelClass}>Lead Form</span>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                When enabled, visitors must enter their name, email, and phone before chatting. When disabled, the chat starts immediately.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input type="hidden" name="leadGateEnabled" value="false" />
              <input
                type="checkbox"
                name="leadGateEnabled"
                value="true"
                defaultChecked={defaults.leadGateEnabled}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-zinc-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-indigo-600 peer-checked:after:translate-x-full dark:bg-zinc-600 dark:peer-checked:bg-indigo-500" />
            </label>
          </div>

          <div>
            <label htmlFor="maxMessages" className={labelClass}>
              Max Messages Per Conversation
            </label>
            <input
              id="maxMessages"
              name="maxMessages"
              type="number"
              min={5}
              max={200}
              defaultValue={defaults.maxMessages}
              className={`${inputClass} max-w-32`}
            />
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Maximum number of user messages allowed per chat session (5–200). After this limit the bot stops responding.
            </p>
            {state.fieldErrors?.maxMessages?.[0] && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{state.fieldErrors.maxMessages[0]}</p>
            )}
          </div>
        </div>
      </section>

      {/* AI Models */}
      <section className={sectionClass}>
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">AI Models</h2>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          Choose which Claude model powers each function. Faster models cost less but may be less capable.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="chatModel" className={labelClass}>
              Customer Chat Model
            </label>
            <select
              id="chatModel"
              name="chatModel"
              defaultValue={defaults.chatModel}
              className={`${inputClass} max-w-sm`}
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Used for real-time customer chat on checkout pages.
            </p>
            {state.fieldErrors?.chatModel?.[0] && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{state.fieldErrors.chatModel[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="summarizerModel" className={labelClass}>
              Summarizer Model
            </label>
            <select
              id="summarizerModel"
              name="summarizerModel"
              defaultValue={defaults.summarizerModel}
              className={`${inputClass} max-w-sm`}
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Used for generating AI summaries of abandoned chats in Slack notifications.
            </p>
            {state.fieldErrors?.summarizerModel?.[0] && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{state.fieldErrors.summarizerModel[0]}</p>
            )}
          </div>
        </div>
      </section>

      {/* System Prompt */}
      <section className={sectionClass}>
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">System Prompt</h2>

        <div>
          <label htmlFor="systemPrompt" className={labelClass}>
            This prompt defines the chatbot&apos;s personality, product knowledge, and checkout guidance behavior.
          </label>
          <textarea
            id="systemPrompt"
            name="systemPrompt"
            rows={24}
            defaultValue={defaults.systemPrompt}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          {state.fieldErrors?.systemPrompt?.[0] && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{state.fieldErrors.systemPrompt[0]}</p>
          )}
        </div>
      </section>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
}
