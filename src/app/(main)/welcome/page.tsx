"use client";

import { ShieldCheck, Check } from "lucide-react";
import { montserrat } from "@/lib/fonts";

export default function WelcomePage() {
  return (
    <div className={montserrat.className}>
      <style>{`
        @keyframes card-in {
          0% { opacity: 0; transform: scale(0.85) translateY(30px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes check-pop {
          0% { opacity: 0; transform: scale(0); }
          50% { transform: scale(1.25); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes ring-pulse {
          0% { box-shadow: 0 0 0 0 rgba(6,182,212,0.5); }
          70% { box-shadow: 0 0 0 18px rgba(6,182,212,0); }
          100% { box-shadow: 0 0 0 0 rgba(6,182,212,0); }
        }
        @keyframes fade-up {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
          50% { opacity: 1; transform: scale(1) rotate(180deg); }
        }
        @keyframes confetti-burst {
          0% { opacity: 0; transform: translate(0, 0) scale(0) rotate(0deg); }
          20% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: var(--confetti-end) scale(0.5) rotate(var(--confetti-rot)); }
        }
        @keyframes party-pop {
          0% { opacity: 0; transform: scale(0) rotate(-20deg); }
          60% { opacity: 1; transform: scale(1.3) rotate(5deg); }
          80% { transform: scale(0.95) rotate(-2deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        .animate-party-pop { animation: party-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.8s both; }
        .animate-card-in { animation: card-in 0.6s cubic-bezier(0.16,1,0.3,1) both; }
        .animate-check-pop { animation: check-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.3s both; }
        .animate-ring-pulse { animation: ring-pulse 1s ease-out 0.5s; }
        .animate-fade-up-1 { animation: fade-up 0.5s ease-out 0.5s both; }
        .animate-fade-up-2 { animation: fade-up 0.5s ease-out 0.7s both; }
        .animate-fade-up-3 { animation: fade-up 0.5s ease-out 0.9s both; }
        .animate-shimmer {
          background: linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.15) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 2s ease-in-out 1.2s infinite;
        }
      `}</style>

      <div className="relative min-h-screen flex flex-col">
        <div className="absolute inset-0 -z-20" style={{ background: "radial-gradient(ellipse at center, #05AEEF, #000000)" }} />
        <div className="absolute inset-0 -z-10 bg-black/75" />

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 sm:px-10 sm:py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pages_Images/GuestBox-Logo-5v2.png" alt="GuestBox" className="h-8 w-auto shrink-0 sm:h-12" />
          <div className="flex shrink-0 items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 backdrop-blur-sm sm:gap-3 sm:px-5 sm:py-2.5">
            <ShieldCheck className="h-5 w-5 text-white sm:h-7 sm:w-7" />
            <div className="leading-tight">
              <div className="text-xs font-semibold text-white sm:text-sm">Secure Checkout</div>
              <div className="text-[10px] text-cyan-400 sm:text-xs">Encrypted &amp; Safe</div>
            </div>
          </div>
        </div>

        {/* Centered card */}
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="animate-card-in relative max-w-md w-full px-8 py-12 sm:px-12 text-center overflow-hidden">

            {/* Sparkles */}
            {[
              { top: "12%", left: "15%", delay: "0.8s", size: "6px" },
              { top: "18%", right: "18%", delay: "1.1s", size: "4px" },
              { top: "30%", left: "10%", delay: "1.4s", size: "5px" },
              { top: "25%", right: "12%", delay: "1.7s", size: "3px" },
              { top: "8%", left: "40%", delay: "1.0s", size: "4px" },
              { top: "35%", right: "25%", delay: "1.3s", size: "5px" },
            ].map((s, i) => (
              <span
                key={i}
                className="absolute rounded-full bg-cyan-400 pointer-events-none"
                style={{
                  top: s.top,
                  left: s.left,
                  right: s.right,
                  width: s.size,
                  height: s.size,
                  animation: `sparkle 1.5s ease-in-out ${s.delay} infinite`,
                }}
              />
            ))}

            {/* Checkmark circle */}
            <div className="relative mx-auto mb-8 w-fit">
              <div className="animate-check-pop animate-ring-pulse flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-lg shadow-cyan-500/30">
                <Check className="h-9 w-9 text-white" strokeWidth={3} />
              </div>
            </div>

            <h1 className="animate-fade-up-1 text-2xl font-extrabold uppercase tracking-wide text-white mb-4 sm:text-3xl">
              Thank You for<br />Your Order!{" "}
              <span className="animate-party-pop inline-block relative">
                <span className="text-3xl sm:text-4xl">🎉</span>
                {/* Confetti burst from the emoji */}
                {[
                  { end: "translate(-30px, -40px)", rot: "220deg", color: "#06b6d4", delay: "1.0s" },
                  { end: "translate(25px, -45px)", rot: "-180deg", color: "#fbbf24", delay: "1.05s" },
                  { end: "translate(-40px, -15px)", rot: "300deg", color: "#f472b6", delay: "1.1s" },
                  { end: "translate(35px, -20px)", rot: "-260deg", color: "#34d399", delay: "1.15s" },
                  { end: "translate(-15px, -50px)", rot: "190deg", color: "#a78bfa", delay: "1.08s" },
                  { end: "translate(10px, -55px)", rot: "-200deg", color: "#fb923c", delay: "1.12s" },
                  { end: "translate(-35px, -30px)", rot: "250deg", color: "#38bdf8", delay: "1.18s" },
                  { end: "translate(40px, -35px)", rot: "-150deg", color: "#f87171", delay: "1.02s" },
                ].map((c, i) => (
                  <span
                    key={i}
                    className="absolute left-1/2 top-1/2 pointer-events-none"
                    style={{
                      width: i % 2 === 0 ? "6px" : "5px",
                      height: i % 2 === 0 ? "6px" : "8px",
                      borderRadius: i % 3 === 0 ? "50%" : "1px",
                      backgroundColor: c.color,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      ["--confetti-end" as any]: c.end,
                      ["--confetti-rot" as any]: c.rot,
                      animation: `confetti-burst 0.8s ease-out ${c.delay} both`,
                    }}
                  />
                ))}
              </span>
            </h1>

            <p className="animate-fade-up-2 text-white/80 text-sm leading-relaxed mb-10 max-w-xs mx-auto">
              Your GuestBox is officially on its way to transforming your guest
              experience. We&apos;re getting everything ready for you right now, and
              you&apos;ll receive an email shortly with your order details and next
              steps.
            </p>

            <a
              href="https://guestbox.tv/"
              className="animate-fade-up-3 inline-block rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 transition-all px-10 py-3.5 text-sm font-bold text-white tracking-wider uppercase shadow-lg shadow-cyan-500/25 hover:shadow-cyan-400/40"
            >
              Back to Home
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="py-4 text-center text-xs text-white/60">
          Copyright &copy; {new Date().getFullYear()} GuestBox&reg; by TvStartup Inc. |{" "}
          <a href="https://guestbox.tv" className="underline transition-colors hover:text-white">
            GuestBox.tv
          </a>
        </div>
      </div>
    </div>
  );
}
