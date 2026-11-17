"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { getChatBridge, setChatConversationId } from "@/components/checkout/ChatBridge";
import { PhoneNumberField } from "@/components/checkout/PhoneNumberField";
import { DEFAULT_COUNTRY_CODE } from "@/lib/checkout/countries";

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

/** Detect context from bot message and return quick-reply buttons */
function getQuickReplies(content: string, isGreeting: boolean): { label: string; text: string }[] {
  const lower = content.toLowerCase();

  // Greeting — show main CTAs
  if (isGreeting) {
    return [
      { label: "📦 What is GuestBox?", text: "What is GuestBox?" },
      { label: "💰 Pricing & Plans", text: "What are the pricing options and plans?" },
      { label: "🛒 Help me order", text: "Help me place my order" },
    ];
  }

  // Asking about number of devices / TVs / GuestBoxes — check BEFORE properties
  // (bot often says "across those properties" which would false-match the property pattern)
  if (lower.includes("how many tv") || lower.includes("how many devices") || lower.includes("how many guestbox") || lower.includes("equip") || lower.includes("total do you")) {
    return [
      { label: "📺 1", text: "1 device" },
      { label: "📺 2", text: "2 devices" },
      { label: "📺 3", text: "3 devices" },
      { label: "📺 5", text: "5 devices" },
      { label: "📺 10", text: "10 devices" },
    ];
  }

  // Asking about number of properties
  if (lower.includes("how many properties") || lower.includes("how many locations") || lower.includes("do you manage")) {
    return [
      { label: "🏠 1 property", text: "1 property" },
      { label: "🏘️ 2 properties", text: "2 properties" },
      { label: "🏘️ 3 properties", text: "3 properties" },
      { label: "🏙️ 5+", text: "5 properties" },
    ];
  }

  // Asking about plan choice (Gold/Platinum/Diamond or monthly/annual)
  if (lower.includes("which plan") || lower.includes("gold") || lower.includes("platinum") || lower.includes("diamond") || lower.includes("monthly or annual")) {
    const replies: { label: string; text: string }[] = [];
    if (lower.includes("gold") || lower.includes("which plan")) replies.push({ label: "🥇 Gold", text: "Gold plan" });
    if (lower.includes("platinum") || lower.includes("which plan")) replies.push({ label: "🥈 Platinum", text: "Platinum plan" });
    if (lower.includes("diamond") || lower.includes("which plan")) replies.push({ label: "💎 Diamond", text: "Diamond plan" });
    if (lower.includes("monthly") || lower.includes("annual")) {
      replies.push({ label: "📅 Monthly", text: "Monthly billing" });
      replies.push({ label: "💰 Annual (save more)", text: "Annual billing" });
    }
    return replies;
  }

  // Yes/No questions
  if (lower.includes("would you like") || lower.includes("ready to") || lower.includes("shall i") || lower.includes("do you want")) {
    return [
      { label: "✅ Yes", text: "Yes" },
      { label: "❌ No thanks", text: "No thanks" },
    ];
  }

  // Payment / card entry — show "Go to Payment" action button
  if (lower.includes("card details") || lower.includes("payment form") || lower.includes("secure form") || lower.includes("enter your card") || lower.includes("complete your order")) {
    return [
      { label: "💳 Go to Payment", text: "Take me to the payment step" },
    ];
  }

  // Confirming personal info from lead gate
  if (lower.includes("is this correct") || lower.includes("would you like to change") || lower.includes("here's what i have")) {
    return [
      { label: "✅ Looks good!", text: "Yes, that's correct" },
      { label: "✏️ Change name", text: "I want to change my name" },
      { label: "✏️ Change email", text: "I want to change my email" },
      { label: "✏️ Change phone", text: "I want to change my phone number" },
    ];
  }

  // Asking for new personal info (user wants to change)
  if (lower.includes("first name") || lower.includes("your name") || lower.includes("new name") || lower.includes("updated name")) {
    return [];
  }

  // Address step — remind user to fill form
  if (lower.includes("shipping address") || lower.includes("fill in your") || lower.includes("address in the form") || lower.includes("where should we ship")) {
    return [
      { label: "✅ Done, next step", text: "I've filled in my address, what's next?" },
    ];
  }

  // Billing plan selection
  if (lower.includes("billing") || lower.includes("plan option")) {
    return [
      { label: "📅 Monthly", text: "Monthly billing" },
      { label: "💰 Annual (save more)", text: "Annual billing" },
    ];
  }

  // Cross-sell — more devices
  if (lower.includes("add more") || lower.includes("every tv") || lower.includes("want to add")) {
    return [
      { label: "📺 Add more devices", text: "Yes, let me add more devices" },
      { label: "👍 I'm good", text: "No, that's enough" },
    ];
  }

  // Asking if they have questions or need help
  if (lower.includes("any questions") || lower.includes("anything else") || lower.includes("can i help")) {
    return [
      { label: "📋 Tell me about plans", text: "Tell me about the plans" },
      { label: "🚚 How does shipping work?", text: "How does shipping work?" },
      { label: "🛒 I'm ready to order", text: "Help me place my order" },
    ];
  }

  return [];
}

/** Simple markdown-to-JSX: **bold**, - lists, newlines */
function formatMessage(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  function flushList() {
    if (listItems.length === 0) return;
    elements.push(
      <ul key={`ul-${elements.length}`} className="ml-4 list-disc space-y-0.5">
        {listItems.map((item, i) => <li key={i}>{parseBold(item)}</li>)}
      </ul>
    );
    listItems = [];
  }

  function parseBold(str: string): React.ReactNode {
    const parts = str.split(/\*\*(.*?)\*\*/g);
    if (parts.length === 1) return str;
    return parts.map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part);
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      listItems.push(trimmed.slice(2));
    } else {
      flushList();
      if (trimmed) {
        elements.push(<p key={`p-${elements.length}`}>{parseBold(trimmed)}</p>);
      }
    }
  }
  flushList();

  return <div className="space-y-1.5">{elements}</div>;
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
        break;
      }
      case "set_profile": {
        if (call.input.firstName) bridge.setProfileField("firstName", call.input.firstName as string);
        if (call.input.lastName) bridge.setProfileField("lastName", call.input.lastName as string);
        if (call.input.email) bridge.setProfileField("email", call.input.email as string);
        if (call.input.phoneNumber) bridge.setProfileField("phoneNumber", call.input.phoneNumber as string);
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
  const [leadForm, setLeadForm] = useState({ firstName: "", lastName: "", email: "", phoneCountry: DEFAULT_COUNTRY_CODE, phoneNumber: "" });
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
    if (!leadForm.firstName || !leadForm.lastName || !leadForm.email || !leadForm.phoneNumber) return;
    setLeadSubmitting(true);
    try {
      const res = await fetch("/api/chat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutPageId, sessionId, firstName: leadForm.firstName, lastName: leadForm.lastName, email: leadForm.email, phone: leadForm.phoneNumber }),
      });
      const data = await res.json();
      if (data.conversationId) {
        setConversationId(data.conversationId);
        setChatConversationId(data.conversationId);
        setMessages([{ role: "assistant", content: data.greeting }]);
        // Push lead gate info into the checkout form
        const bridge = getChatBridge();
        if (bridge) {
          bridge.setProfileField("firstName", leadForm.firstName);
          bridge.setProfileField("lastName", leadForm.lastName);
          bridge.setProfileField("email", leadForm.email);
          bridge.setProfileField("phoneCountry", leadForm.phoneCountry);
          bridge.setProfileField("phoneNumber", leadForm.phoneNumber);
        }
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setLeadSubmitting(false);
    }
  }

  async function sendMessage(text: string) {
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
              profileFirstName: b.profileForm.firstName || leadForm.firstName,
              profileLastName: b.profileForm.lastName || leadForm.lastName,
              profileEmail: b.profileForm.email || leadForm.email,
              profilePhone: b.profileForm.phone || leadForm.phoneNumber,
              addressFilled: b.addressFilled,
              unitPriceCents: b.unitPriceCents,
              totalCents: b.estimateTotalCents,
              promoApplied: b.promoApplied,
              promoCode: b.promoCode,
              promoSavingsCents: b.promoSavingsCents,
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

  function handleSend() {
    sendMessage(input.trim());
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
          <span className="text-2xl">💬</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[480px] w-[380px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl sm:h-[520px]">
          {/* Header */}
          <div className="flex items-center justify-between bg-cyan-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
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
                👋 Hi! I'd love to help you with your GuestBox order. Let me get your details so I can assist you best.
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
              <PhoneNumberField
                country={leadForm.phoneCountry}
                onCountryChange={(code) => setLeadForm((f) => ({ ...f, phoneCountry: code }))}
                number={leadForm.phoneNumber}
                onNumberChange={(val) => setLeadForm((f) => ({ ...f, phoneNumber: val }))}
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
                  {messages.map((msg, i) => {
                    const isLast = msg.role === "assistant" && i === messages.length - 1 && !sending;
                    const quickReplies = isLast ? getQuickReplies(msg.content, i === 0) : [];
                    return (
                      <div key={i}>
                        <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                              msg.role === "user"
                                ? "bg-cyan-600 text-white"
                                : "bg-zinc-100 text-zinc-800"
                            }`}
                          >
                            {msg.role === "assistant" ? formatMessage(msg.content) : msg.content}
                          </div>
                        </div>
                        {quickReplies.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {quickReplies.map((cta) => (
                              <button
                                key={cta.label}
                                type="button"
                                onClick={() => sendMessage(cta.text)}
                                className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700 transition hover:bg-cyan-100"
                              >
                                {cta.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
