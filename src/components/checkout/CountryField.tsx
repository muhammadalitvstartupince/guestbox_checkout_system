"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { COUNTRY_OPTIONS, flagEmoji } from "@/lib/checkout/countries";

export function CountryField({
  name,
  label,
  value,
  onChange,
  errors,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (code: string) => void;
  errors?: string[];
}) {
  const selected = COUNTRY_OPTIONS.find((c) => c.code === value);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [query]);

  function selectCountry(code: string) {
    onChange(code);
    setOpen(false);
  }

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <label htmlFor={`${name}-trigger`} className="mb-1 block text-sm text-[#18181a]">
        {label}
      </label>
      <div ref={containerRef} className="relative">
        <button
          id={`${name}-trigger`}
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setQuery("");
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`flex h-10 w-full items-center justify-between gap-2 rounded border px-3 text-left transition-colors focus:border-zinc-400 focus:outline-none ${
            errors?.[0] ? "border-red-300" : ""
          }`}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected && <span>{flagEmoji(selected.code)}</span>}
            <span className={`truncate ${selected ? "" : "text-zinc-400"}`}>{selected?.name ?? "Select a country"}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
        </button>

        {open && (
          <div className="absolute top-full left-0 z-20 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg">
            <div className="border-b border-zinc-100 p-2">
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (filtered[0]) selectCountry(filtered[0].code);
                  }
                }}
                placeholder="Search country"
                className="h-8 w-full rounded border px-2 text-sm focus:border-zinc-400 focus:outline-none"
              />
            </div>
            <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
              {filtered.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.code === selected?.code}
                    onClick={() => selectCountry(c.code)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-50 ${
                      c.code === selected?.code ? "bg-zinc-50 font-medium" : ""
                    }`}
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
      {errors?.[0] && <p className="mt-1 text-sm text-red-600">{errors[0]}</p>}
    </div>
  );
}
