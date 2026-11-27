"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { COUNTRY_OPTIONS, DEFAULT_COUNTRY_CODE, flagEmoji } from "@/lib/checkout/countries";

export function AdminPhoneField({
  country, onCountryChange, number, onNumberChange,
}: {
  country: string; onCountryChange: (code: string) => void;
  number: string; onNumberChange: (value: string) => void;
}) {
  const selected = COUNTRY_OPTIONS.find((c) => c.code === country) ?? COUNTRY_OPTIONS.find((c) => c.code === DEFAULT_COUNTRY_CODE)!;
  const fullPhone = `${selected.dialCode}${number.replace(/\D/g, "")}`;
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
    return COUNTRY_OPTIONS.filter((c) => c.name.toLowerCase().includes(q) || c.dialCode.includes(q) || c.code.toLowerCase().includes(q));
  }, [query]);

  return (
    <div>
      <input type="hidden" name="phone" value={fullPhone} />
      <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Phone Number</label>
      <div ref={containerRef} className="relative">
        <div className="flex h-10 overflow-hidden rounded-xl border border-zinc-200 shadow-sm transition focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-zinc-700 dark:focus-within:border-indigo-400 dark:focus-within:ring-indigo-400/20">
          <button
            type="button"
            onClick={() => { setOpen((o) => !o); setQuery(""); }}
            className="flex shrink-0 items-center gap-1 border-r border-zinc-200 bg-zinc-50 px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <span>{flagEmoji(selected.code)}</span>
            <span>{selected.dialCode}</span>
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
          </button>
          <input
            type="tel"
            inputMode="tel"
            value={number}
            onChange={(e) => onNumberChange(e.target.value.replace(/[^\d\s()-]/g, ""))}
            placeholder="555 123 4567"
            className="h-full w-full bg-white px-3 text-sm text-zinc-900 focus:outline-none dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </div>
        {open && (
          <div className="absolute top-full left-0 z-20 mt-1 w-72 rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
            <div className="border-b border-zinc-100 p-2 dark:border-zinc-700">
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); if (e.key === "Enter") { e.preventDefault(); if (filtered[0]) { onCountryChange(filtered[0].code); setOpen(false); } } }}
                placeholder="Search country or code"
                className="h-8 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-400"
              />
            </div>
            <ul className="max-h-56 overflow-y-auto py-1">
              {filtered.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => { onCountryChange(c.code); setOpen(false); }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-700 ${c.code === selected.code ? "bg-zinc-50 font-medium dark:bg-zinc-700" : "dark:text-zinc-200"}`}
                  >
                    <span>{flagEmoji(c.code)}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-zinc-400 dark:text-zinc-500">{c.dialCode}</span>
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
