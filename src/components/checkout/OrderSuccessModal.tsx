"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

const AUTO_REDIRECT_SECONDS = 5;

export function OrderSuccessModal({ redirectUrl, accentColor }: { redirectUrl: string; accentColor: string }) {
  const [secondsLeft, setSecondsLeft] = useState(AUTO_REDIRECT_SECONDS);

  useEffect(() => {
    const interval = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) window.location.href = redirectUrl;
  }, [secondsLeft, redirectUrl]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <Check className="h-8 w-8 text-emerald-600" strokeWidth={3} />
        </div>
        <h2 className="mb-2 text-xl font-bold text-zinc-900">Order Placed Successfully!</h2>
        <p className="mb-6 text-sm text-zinc-600">
          Thank you for your order. You&rsquo;ll receive a confirmation email shortly.
        </p>
        <button
          type="button"
          onClick={() => {
            window.location.href = redirectUrl;
          }}
          className="w-full rounded-lg py-3 font-semibold text-white transition hover:brightness-110 active:brightness-95"
          style={{ backgroundColor: accentColor }}
        >
          Continue {secondsLeft > 0 ? `(${secondsLeft}s)` : ""}
        </button>
      </div>
    </div>
  );
}
