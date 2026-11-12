"use client";

import { useState, useRef, useEffect } from "react";
import { Link2, Check, Copy, ChevronDown, X } from "lucide-react";

type Page = { slug: string; title: string };

export function PromoLinkButton({
  code,
  boundPageSlug,
  checkoutPages,
}: {
  code: string;
  boundPageSlug?: string | null;
  checkoutPages: Page[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState(boundPageSlug ?? checkoutPages[0]?.slug ?? "");
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selectedPage = checkoutPages.find((p) => p.slug === selectedSlug);
  const url = selectedSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/c/${selectedSlug}?promo=${encodeURIComponent(code)}`
    : "";

  function handleCopy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (checkoutPages.length === 0) return null;

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 transition hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/50"
      >
        <Link2 className="h-3 w-3" />
        Get Link
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-2.5 dark:border-zinc-700 dark:bg-zinc-800/80">
            <div className="flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                Promo Link for <span className="font-mono text-violet-600 dark:text-violet-400">{code}</span>
              </span>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Page selector — only when not bound to a specific page */}
            {!boundPageSlug && checkoutPages.length > 1 ? (
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Checkout Page
                </label>
                <div className="relative">
                  <select
                    value={selectedSlug}
                    onChange={(e) => { setSelectedSlug(e.target.value); setCopied(false); }}
                    className="w-full appearance-none rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-zinc-800 transition focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:focus:ring-violet-900"
                  >
                    {checkoutPages.map((p) => (
                      <option key={p.slug} value={p.slug}>{p.title}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                </div>
              </div>
            ) : selectedPage && (
              <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-700/50">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Page:</span>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{selectedPage.title}</span>
              </div>
            )}

            {/* URL display + copy */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Shareable URL
              </label>
              <div className="flex items-stretch gap-0 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-600">
                <input
                  readOnly
                  value={url}
                  className="min-w-0 flex-1 border-0 bg-zinc-50 px-3 py-2 text-xs font-mono text-zinc-600 focus:outline-none dark:bg-zinc-900 dark:text-zinc-300"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`flex shrink-0 items-center gap-1.5 border-l px-4 py-2 text-xs font-semibold transition ${
                    copied
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                  }`}
                >
                  {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
