"use client";

import { useActionState, useState } from "react";
import { changeAdminPassword } from "@/app/(main)/admin/(protected)/admin-users/actions";
import { initialAdminUserFormState } from "@/app/(main)/admin/(protected)/admin-users/types";

export function ChangePasswordButton({ adminUserId }: { adminUserId: string }) {
  const [open, setOpen] = useState(false);
  const boundAction = changeAdminPassword.bind(null, adminUserId);
  const [state, formAction, pending] = useActionState(boundAction, initialAdminUserFormState);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
      >
        Change Password
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input
        type="password"
        name="newPassword"
        required
        minLength={8}
        placeholder="New password (8+ chars)"
        className="w-44 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-zinc-500 hover:underline"
      >
        Cancel
      </button>
      {state.message && (
        <span className={`text-xs ${state.status === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}
