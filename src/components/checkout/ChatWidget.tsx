"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { getChatBridge, setChatConversationId } from "@/components/checkout/ChatBridge";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

interface CheckoutContext {
  productName: string;
  basePriceCents: number;
  priceTiers: { minQty: number; maxQty: number | null; priceCents: number }[];
  billingPlans: { id: string; label: string; interval: string; priceCents: number }[];
  planTiers: { id: string; name: string; prices: { minQty: number; maxQty: number | null; monthlyPriceCents: number }[] }[];
  addons: { id: string; name: string; priceCents: number }[];
}

function executeToolCalls(toolCalls: ToolCall[]) {
  const bridge = getChatBridge();
  if (!bridge) return;

  for (const call of toolCalls) {
    switch (call.name) {
      case "set_quantity": {
        const qty = Math.max(1, Math.min(10, Number(call.input.quantity) || 1));
        bridge.setQuantity(qty);
        break;
      }
      case "set_listing_qty": {
        const qty = Math.max(1, Number(call.input.quantity) || 1);
        bridge.setListingQty(qty);
        break;
      }
      case "navigate_step": {
        const step = Number(call.input.step);
        if (step === 1 || step === 2 || step === 3) bridge.setWizardStep(step);
        if (step === 2 && call.input.subStep) {
          bridge.setDetailsSubStep(call.input.subStep as "personal" | "address" | "billing-cycle");
        }
        break;
      }
      case "select_plan": {
        if (call.input.planId) bridge.setSelectedPlanId(call.input.planId as string);
        if (call.input.interval) bridge.setSelectedTierInterval(call.input.interval as string);
        break;
      }
      case "toggle_addon": {
        const bridge2 = getChatBridge();
        if (!bridge2) break;
        // We don't have direct access to toggle, so we read current and set
        // This is a simplification — the full addon toggle is in CheckoutForm
        break;
      }
    }
  }
}

export function ChatWidget({ checkoutPageId, checkoutContext }: { checkoutPageId: string; checkoutContext?: CheckoutContext }) {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lead gate form state
  const [leadForm, setLeadForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [leadSubmitting, setLeadSubmitting] = useState(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { if (open && conversationId) inputRef.current?.focus(); }, [open, conversationId]);

  // --- Abandonment detection ---
  const lastActivityRef = useRef(Date.now());
  const nudgeSentRef = useRef(false);

  // Reset activity timer on every message or input
  useEffect(() => { lastActivityRef.current = Date.now(); nudgeSentRef.current = false; }, [messages, input]);

  // beforeunload: mark abandoned when user leaves the page
  useEffect(() => {
    if (!conversationId) return;
    const handleUnload = () => {
      navigator.sendBeacon("/api/chat/abandon", JSON.stringify({ conversationId }));
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [conversationId]);

  // Idle timer: nudge at 3 min, mark abandoned at 10 min
  useEffect(() => {
    if (!conversationId) return;
    const interval = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      // 3 min nudge
      if (idleMs >= 3 * 60 * 1000 && !nudgeSentRef.current) {
        nudgeSentRef.current = true;
        setMessages((prev) => [...prev, { role: "assistant", content: "Still there? Happy to help finish your order!" }]);
      }
      // 10 min abandon
      if (idleMs >= 10 * 60 * 1000) {
        fetch("/api/chat/abandon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId }),
        }).catch(() => {});
        clearInterval(interval);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [conversationId]);

  async function handleLeadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leadForm.firstName || !leadForm.lastName || !leadForm.email || !leadForm.phone) return;
    setLeadSubmitting(true);
    try {
      const res = await fetch("/api/chat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutPageId, sessionId, ...leadForm }),
      });
      const data = await res.json();
      if (data.conversationId) {
        setConversationId(data.conversationId);
        setChatConversationId(data.conversationId);
        setMessages([{ role: "assistant", content: data.greeting }]);
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setLeadSubmitting(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || !conversationId || sending) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: text,
          checkoutContext,
          formState: (() => {
            const b = getChatBridge();
            if (!b) return undefined;
            return {
              step: b.wizardStep,
              subStep: b.detailsSubStep,
              quantity: b.quantity,
              listingQty: b.listingQty,
              hasOrder: !!b.orderId,
              profileFilled: !!(b.profileForm.firstName && b.profileForm.email),
              addressFilled: b.addressFilled,
            };
          })(),
        }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }
      if (data.toolCalls) {
        executeToolCalls(data.toolCalls);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setSending(false);
    }
  }

  const inputClass = "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500";

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-600 text-white shadow-lg transition hover:bg-cyan-700 hover:shadow-xl"
          aria-label="Open chat"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[480px] w-[380px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl sm:h-[520px]">
          {/* Header */}
          <div className="flex items-center justify-between bg-cyan-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm font-semibold">GuestBox Assistant</span>
            </div>
            <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-white/20" aria-label="Close chat">
              <X className="h-4 w-4" />
            </button>
          </div>

          {!conversationId ? (
            /* Lead gate form */
            <form onSubmit={handleLeadSubmit} className="flex flex-1 flex-col gap-3 p-4">
              <p className="text-sm text-zinc-600">
                Hi! I'd love to help you with your GuestBox order. Let me get your details so I can assist you best.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={inputClass}
                  placeholder="First Name"
                  value={leadForm.firstName}
                  onChange={(e) => setLeadForm((f) => ({ ...f, firstName: e.target.value }))}
                  required
                />
                <input
                  className={inputClass}
                  placeholder="Last Name"
                  value={leadForm.lastName}
                  onChange={(e) => setLeadForm((f) => ({ ...f, lastName: e.target.value }))}
                  required
                />
              </div>
              <input
                className={inputClass}
                type="email"
                placeholder="Email"
                value={leadForm.email}
                onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
              <input
                className={inputClass}
                type="tel"
                placeholder="Phone"
                value={leadForm.phone}
                onChange={(e) => setLeadForm((f) => ({ ...f, phone: e.target.value }))}
                required
              />
              <button
                type="submit"
                disabled={leadSubmitting}
                className="mt-auto rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-60"
              >
                {leadSubmitting ? "Starting…" : "Start Chat →"}
              </button>
            </form>
          ) : (
            /* Chat messages + input */
            <>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-3">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                          msg.role === "user"
                            ? "bg-cyan-600 text-white"
                            : "bg-zinc-100 text-zinc-800"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {sending && (
                    <div className="flex justify-start">
                      <div className="rounded-xl bg-zinc-100 px-3 py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="border-t border-zinc-200 p-3">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    placeholder="Type a message…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    disabled={sending}
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !input.trim()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-600 text-white transition hover:bg-cyan-700 disabled:opacity-40"
                    aria-label="Send"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
