"use client";

import { useActionState } from "react";
import { createAdminUser } from "@/app/(main)/admin/(protected)/admin-users/actions";
import { initialAdminUserFormState } from "@/app/(main)/admin/(protected)/admin-users/types";

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelClass = "mb-1 block text-xs text-zinc-500 dark:text-zinc-400";

export function AdminUserForm() {
  const [state, formAction, pending] = useActionState(createAdminUser, initialAdminUserFormState);

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
          <label className={labelClass}>Name</label>
          <input name="name" required className={inputClass} placeholder="Jane Doe" />
          {state.fieldErrors?.name?.[0] && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.fieldErrors.name[0]}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input type="email" name="email" required className={inputClass} placeholder="jane@example.com" />
          {state.fieldErrors?.email?.[0] && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.fieldErrors.email[0]}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Password</label>
          <input type="password" name="password" required className={inputClass} placeholder="At least 8 characters" />
          {state.fieldErrors?.password?.[0] && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.fieldErrors.password[0]}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Role</label>
          <select name="role" defaultValue="editor" className={`${inputClass} bg-white dark:bg-zinc-800`}>
            <option value="editor">Editor (pages &amp; add-ons only)</option>
            <option value="admin">Admin (full access)</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create Admin User"}
        </button>
      </div>
    </form>
  );
}
