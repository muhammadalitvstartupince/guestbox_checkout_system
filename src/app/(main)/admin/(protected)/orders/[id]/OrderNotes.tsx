"use client";

import { useActionState, useRef } from "react";
import { addOrderNote } from "./actions";

type Note = {
  id: string;
  content: string;
  createdAt: string;
  adminUser: { email: string };
};

export function OrderNotes({ orderId, notes }: { orderId: string; notes: Note[] }) {
  const [state, formAction, pending] = useActionState(addOrderNote.bind(null, orderId), { error: null });
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div>
      {notes.length > 0 && (
        <ul className="mb-4 space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{note.content}</p>
              <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                {note.adminUser.email} &mdash; {new Date(note.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form
        ref={formRef}
        action={async (fd) => {
          await formAction(fd);
          formRef.current?.reset();
        }}
      >
        <textarea
          name="content"
          rows={2}
          required
          placeholder="Add a note…"
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        {state?.error && <p className="mt-1 text-xs text-red-500">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Add Note"}
        </button>
      </form>
    </div>
  );
}
