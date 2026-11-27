"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { COUNTRY_OPTIONS, flagEmoji } from "@/lib/checkout/countries";

export function AdminCountryField({
  name, label, value, onChange,
}: {
  name: string; label: string; value: string; onChange: (code: string) => void;
}) {
  const selected = COUNTRY_OPTIONS.find((c) => c.code === value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => { if (open) requestAnimationFrame(() => searchRef.current?.focus()); }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [query]);

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</label>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => { setOpen((o) => !o); setQuery(""); }}
          className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 text-left text-sm shadow-sm transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20"
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected && <span>{flagEmoji(selected.code)}</span>}
            <span className={`truncate ${selected ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}`}>{selected?.name ?? "Select a country"}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
        </button>
        {open && (
          <div className="absolute top-full left-0 z-20 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
            <div className="border-b border-zinc-100 p-2 dark:border-zinc-700">
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); if (e.key === "Enter") { e.preventDefault(); if (filtered[0]) { onChange(filtered[0].code); setOpen(false); } } }}
                placeholder="Search country"
                className="h-8 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-400"
              />
            </div>
            <ul className="max-h-56 overflow-y-auto py-1">
              {filtered.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => { onChange(c.code); setOpen(false); }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-700 ${c.code === selected?.code ? "bg-zinc-50 font-medium dark:bg-zinc-700" : "dark:text-zinc-200"}`}
                  >
                    <span>{flagEmoji(c.code)}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && <li className="px-3 py-2 text-sm text-zinc-400">No matches</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
