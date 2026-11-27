"use client";

import { useState } from "react";

export function CopyPaymentLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={url}
        className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        onFocus={(e) => e.target.select()}
      />
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="shrink-0 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
