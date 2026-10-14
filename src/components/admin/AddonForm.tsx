"use client";

import { useActionState } from "react";
import { initialAddonFormState, type AddonFormState } from "@/app/(main)/admin/(protected)/addons/types";
import { RichTextEditor } from "@/components/admin/RichTextEditor";

export interface AddonFormDefaults {
  name: string;
  description: string;
  imageUrl: string;
  price: string;
  originalPrice: string;
  zohoItemId: string;
}

export const emptyAddonDefaults: AddonFormDefaults = {
  name: "",
  description: "",
  imageUrl: "",
  price: "",
  originalPrice: "",
  zohoItemId: "",
};

type BoundAction = (state: AddonFormState, formData: FormData) => Promise<AddonFormState>;

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelClass = "mb-1 block text-sm text-zinc-700 dark:text-zinc-300";

export function AddonForm({
  action,
  defaults,
  submitLabel,
}: {
  action: BoundAction;
  defaults: AddonFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialAddonFormState);

  return (
    <form action={formAction} className="space-y-4">
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

      <div>
        <label htmlFor="name" className={labelClass}>
          Name
        </label>
        <input id="name" name="name" defaultValue={defaults.name} className={inputClass} />
        {state.fieldErrors?.name?.[0] && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{state.fieldErrors.name[0]}</p>}
      </div>

      <RichTextEditor
        name="description"
        label="Description (optional)"
        defaultValue={defaults.description}
        errors={state.fieldErrors?.description}
      />

      <div>
        <label htmlFor="imageUrl" className={labelClass}>
          Image Path (optional)
        </label>
        <input
          id="imageUrl"
          name="imageUrl"
          defaultValue={defaults.imageUrl}
          placeholder="/pages_Images/example.png"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Shown above the add-on&rsquo;s heading on the checkout step.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="price" className={labelClass}>
            Price (USD)
          </label>
          <input id="price" name="price" defaultValue={defaults.price} className={inputClass} />
          {state.fieldErrors?.priceCents?.[0] && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{state.fieldErrors.priceCents[0]}</p>
          )}
        </div>
        <div>
          <label htmlFor="originalPrice" className={labelClass}>
            Original Price (USD, optional — shown struck through)
          </label>
          <input id="originalPrice" name="originalPrice" defaultValue={defaults.originalPrice} className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="zohoItemId" className={labelClass}>
          Zoho Item ID (optional)
        </label>
        <input id="zohoItemId" name="zohoItemId" defaultValue={defaults.zohoItemId} className={inputClass} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
