"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { COUNTRY_OPTIONS, DEFAULT_COUNTRY_CODE, flagEmoji } from "@/lib/checkout/countries";

/**
 * Best-effort default country for the dial-code picker: tries an IP
 * geolocation lookup first, falls back to the browser's locale region, and
 * leaves the field on DEFAULT_COUNTRY_CODE if both are unavailable (offline,
 * blocked, unsupported region). Never overrides a country the visitor has
 * already picked themselves.
 */
function useDetectedCountry(onDetected: (code: string) => void, alreadyPicked: () => boolean) {
  useEffect(() => {
    let cancelled = false;

    async function detect() {
      try {
        const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          const code = typeof data.country_code === "string" ? data.country_code.toUpperCase() : null;
          if (!cancelled && !alreadyPicked() && code && COUNTRY_OPTIONS.some((c) => c.code === code)) {
            onDetected(code);
            return;
          }
        }
      } catch {
        // IP lookup unavailable — fall through to the locale-based guess.
      }

      if (cancelled || alreadyPicked()) return;
      const region = navigator.language?.split("-")[1]?.toUpperCase();
      if (region && COUNTRY_OPTIONS.some((c) => c.code === region)) {
        onDetected(region);
      }
    }

    detect();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount; onDetected/alreadyPicked are stable setState/ref accessors from the parent
  }, []);
}

export function PhoneNumberField({
  country,
  onCountryChange,
  number,
  onNumberChange,
  errors,
}: {
  country: string;
  onCountryChange: (code: string) => void;
  number: string;
  onNumberChange: (value: string) => void;
  errors?: string[];
}) {
  const userPickedCountry = useRef(false);

  useDetectedCountry(
    (code) => onCountryChange(code),
    () => userPickedCountry.current,
  );

  const selected = COUNTRY_OPTIONS.find((c) => c.code === country) ?? COUNTRY_OPTIONS.find((c) => c.code === DEFAULT_COUNTRY_CODE)!;
  const fullPhone = `${selected.dialCode}${number.replace(/\D/g, "")}`;

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
    return COUNTRY_OPTIONS.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dialCode.includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [query]);

  function selectCountry(code: string) {
    userPickedCountry.current = true;
    onCountryChange(code);
    setOpen(false);
  }

  return (
    <div>
      <input type="hidden" name="phone" value={fullPhone} />
      <label htmlFor="phone-number" className="mb-1 block text-sm text-zinc-700">
        Phone Number
      </label>
      <div ref={containerRef} className="relative">
        <div
          className={`flex h-10 overflow-hidden rounded border transition-colors focus-within:border-zinc-400 ${
            errors?.[0] ? "border-red-300" : ""
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setOpen((o) => !o);
              setQuery("");
            }}
            aria-haspopup="listbox"
            aria-expanded={open}
            className="flex shrink-0 items-center gap-1 border-r bg-zinc-50 px-2 text-sm focus:outline-none"
          >
            <span>{flagEmoji(selected.code)}</span>
            <span>{selected.dialCode}</span>
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
          </button>
          <input
            id="phone-number"
            type="tel"
            inputMode="tel"
            value={number}
            onChange={(e) => onNumberChange(e.target.value.replace(/[^\d\s()-]/g, ""))}
            placeholder="555 123 4567"
            className="h-full w-full px-3 focus:outline-none"
          />
        </div>

        {open && (
          <div className="absolute top-full left-0 z-20 mt-1 w-72 rounded-lg border border-zinc-200 bg-white shadow-lg">
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
                placeholder="Search country or code"
                className="h-8 w-full rounded border px-2 text-sm focus:border-zinc-400 focus:outline-none"
              />
            </div>
            <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
              {filtered.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.code === selected.code}
                    onClick={() => selectCountry(c.code)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-50 ${
                      c.code === selected.code ? "bg-zinc-50 font-medium" : ""
                    }`}
                  >
                    <span>{flagEmoji(c.code)}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-zinc-400">{c.dialCode}</span>
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
