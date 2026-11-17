"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Loader2, ChevronDown, ChevronUp } from "lucide-react";
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
        bridge.setQuantity(Math.max(1, Math.min(10, Number(call.input.quantity) || 1)));
        break;
      }
      case "set_listing_qty": {
        bridge.setListingQty(Math.max(1, Number(call.input.quantity) || 1));
        break;
      }
      case "navigate_step": {
        const step = Number(call.input.step);
        if (step === 1 || step === 2 || step === 3) bridge.setWizardStep(step);
        if (step === 2 && call.input.subStep) bridge.setDetailsSubStep(call.input.subStep as "personal" | "address" | "billing-cycle");
        break;
      }
      case "select_plan": {
        if (call.input.planId) bridge.setSelectedPlanId(call.input.planId as string);
        if (call.input.interval) bridge.setSelectedTierInterval(call.input.interval as string);
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

function getQuickReplies(content: string, isGreeting: boolean): { label: string; text: string }[] {
  const lower = content.toLowerCase();

  if (isGreeting) {
    return [
      { label: "📦 What is GuestBox?", text: "What is GuestBox?" },
      { label: "💰 Pricing & Plans", text: "What are the pricing options and plans?" },
      { label: "🛒 Help me order", text: "Help me place my order" },
    ];
  }

  if (lower.includes("how many tv") || lower.includes("how many devices") || lower.includes("how many guestbox") || lower.includes("equip") || lower.includes("total do you")) {
    return [
      { label: "📺 1", text: "1 device" }, { label: "📺 2", text: "2 devices" }, { label: "📺 3", text: "3 devices" },
      { label: "📺 5", text: "5 devices" }, { label: "📺 10", text: "10 devices" },
    ];
  }

  if (lower.includes("how many properties") || lower.includes("how many locations") || lower.includes("do you manage")) {
    return [
      { label: "🏠 1 property", text: "1 property" }, { label: "🏘️ 2 properties", text: "2 properties" },
      { label: "🏘️ 3 properties", text: "3 properties" }, { label: "🏙️ 5+", text: "5 properties" },
    ];
  }

  if (lower.includes("is this correct") || lower.includes("would you like to change")) {
    return [
      { label: "✅ Looks good!", text: "Yes, that's correct" },
      { label: "✏️ Change name", text: "I want to change my name" },
      { label: "✏️ Change email", text: "I want to change my email" },
      { label: "✏️ Change phone", text: "I want to change my phone number" },
    ];
  }

  if (lower.includes("card details") || lower.includes("payment form") || lower.includes("secure form") || lower.includes("enter your card") || lower.includes("complete your order")) {
    return [{ label: "💳 Go to Payment", text: "Take me to the payment step" }];
  }

  if (lower.includes("shipping address") || lower.includes("fill in your") || lower.includes("address in the form") || lower.includes("where should we ship")) {
    return [{ label: "✅ Done, next step", text: "__check_address__" }];
  }

  if (lower.includes("add more") || lower.includes("every tv") || lower.includes("want to add")) {
    return [{ label: "📺 Add more devices", text: "Yes, let me add more devices" }, { label: "👍 I'm good", text: "No, that's enough" }];
  }

  if (lower.includes("would you like") || lower.includes("ready to") || lower.includes("shall i") || lower.includes("do you want")) {
    return [{ label: "✅ Yes", text: "Yes" }, { label: "❌ No thanks", text: "No thanks" }];
  }

  if (lower.includes("any questions") || lower.includes("anything else") || lower.includes("can i help")) {
    return [
      { label: "📋 Tell me about plans", text: "Tell me about the plans" },
      { label: "🚚 How does shipping work?", text: "How does shipping work?" },
      { label: "🛒 I'm ready to order", text: "Help me place my order" },
    ];
  }

  return [];
}

export function ChatLayoutSide({
  checkoutPageId,
  checkoutContext,
  children,
}: {
  checkoutPageId: string;
  checkoutContext: CheckoutContext;
  children: React.ReactNode;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mobileOpen, setMobileOpen] = useState(true);

  const [leadForm, setLeadForm] = useState({ firstName: "", lastName: "", email: "", phoneCountry: DEFAULT_COUNTRY_CODE, phoneNumber: "" });
  const [leadSubmitting, setLeadSubmitting] = useState(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { if (conversationId) inputRef.current?.focus(); }, [conversationId]);

  // Abandonment
  useEffect(() => {
    if (!conversationId) return;
    const handleUnload = () => {
      navigator.sendBeacon("/api/chat/abandon", JSON.stringify({ conversationId }));
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
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
        const bridge = getChatBridge();
        if (bridge) {
          bridge.setProfileField("firstName", leadForm.firstName);
          bridge.setProfileField("lastName", leadForm.lastName);
          bridge.setProfileField("email", leadForm.email);
          bridge.setProfileField("phoneCountry", leadForm.phoneCountry);
          bridge.setProfileField("phoneNumber", leadForm.phoneNumber);
        }
      }
    } catch { /* retry */ } finally {
      setLeadSubmitting(false);
    }
  }

  async function sendMessage(text: string) {
    if (!text || !conversationId || sending) return;
    if (text === "__check_address__") {
      const b = getChatBridge();
      if (b && !b.addressFilled) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Please fill in your shipping address in the form first 📝" }]);
        return;
      }
      text = "I've filled in my address, what's next?";
    }
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId, message: text, checkoutContext,
          formState: (() => {
            const b = getChatBridge();
            if (!b) return undefined;
            return {
              step: b.wizardStep, subStep: b.detailsSubStep, quantity: b.quantity, listingQty: b.listingQty,
              hasOrder: !!b.orderId,
              profileFilled: !!(b.profileForm.firstName && b.profileForm.email),
              profileFirstName: b.profileForm.firstName || leadForm.firstName,
              profileLastName: b.profileForm.lastName || leadForm.lastName,
              profileEmail: b.profileForm.email || leadForm.email,
              profilePhone: b.profileForm.phone || leadForm.phoneNumber,
              addressFilled: b.addressFilled,
              unitPriceCents: b.unitPriceCents, totalCents: b.estimateTotalCents,
              promoApplied: b.promoApplied, promoCode: b.promoCode, promoSavingsCents: b.promoSavingsCents,
            };
          })(),
        }),
      });
      const data = await res.json();
      if (data.reply) setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.toolCalls) executeToolCalls(data.toolCalls);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]);
    } finally {
      setSending(false);
    }
  }

  const leadInputClass = "w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400";

  const chatPanel = (
    <div className="flex h-full flex-col">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <span className="text-2xl">🤖</span>
        <div>
          <div className="text-sm font-bold text-white">GuestBox Checkout Assistant</div>
          <div className="text-xs text-cyan-400">I'll help you get the right setup</div>
        </div>
      </div>

      {!conversationId ? (
        /* Lead gate */
        <form onSubmit={handleLeadSubmit} className="flex flex-1 flex-col gap-3 p-5">
          <p className="text-sm text-white/80">
            👋 Hi! Let me get your details so I can help you with your order.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input className={leadInputClass} placeholder="First Name" value={leadForm.firstName} onChange={(e) => setLeadForm((f) => ({ ...f, firstName: e.target.value }))} required />
            <input className={leadInputClass} placeholder="Last Name" value={leadForm.lastName} onChange={(e) => setLeadForm((f) => ({ ...f, lastName: e.target.value }))} required />
          </div>
          <input className={leadInputClass} type="email" placeholder="Email" value={leadForm.email} onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))} required />
          <PhoneNumberField
            country={leadForm.phoneCountry}
            onCountryChange={(code) => setLeadForm((f) => ({ ...f, phoneCountry: code }))}
            number={leadForm.phoneNumber}
            onNumberChange={(val) => setLeadForm((f) => ({ ...f, phoneNumber: val }))}
          />
          <button type="submit" disabled={leadSubmitting} className="mt-auto rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-400 disabled:opacity-60">
            {leadSubmitting ? "Starting…" : "Start Chat →"}
          </button>
        </form>
      ) : (
        /* Messages */
        <>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {messages.map((msg, i) => {
                const isLast = msg.role === "assistant" && i === messages.length - 1 && !sending;
                const quickReplies = isLast ? getQuickReplies(msg.content, i === 0) : [];
                return (
                  <div key={i}>
                    <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        msg.role === "user" ? "bg-cyan-500 text-white" : "bg-white/10 text-white/90"
                      }`}>
                        {msg.role === "assistant" ? formatMessage(msg.content) : msg.content}
                      </div>
                    </div>
                    {quickReplies.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {quickReplies.map((cta) => (
                          <button key={cta.label} type="button" onClick={() => sendMessage(cta.text)}
                            className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/20">
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
                  <div className="rounded-xl bg-white/10 px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-white/10 p-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                className="flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                placeholder="Type a question or click an option..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input.trim()); } }}
                disabled={sending}
              />
              <button onClick={() => sendMessage(input.trim())} disabled={sending || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500 text-white transition hover:bg-cyan-400 disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left: Chat — dark theme */}
      <div className="relative lg:w-1/2 lg:sticky lg:top-0 lg:h-screen">
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(ellipse at center, #0a2540, #000)" }} />

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="flex w-full items-center justify-between border-b border-white/10 px-5 py-3 text-white lg:hidden"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span>🤖</span> GuestBox Assistant
          </span>
          {mobileOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <div className={`${mobileOpen ? "block" : "hidden"} h-[60vh] lg:block lg:h-full`}>
          {chatPanel}
        </div>
      </div>

      {/* Right: Checkout form */}
      <div className="flex-1 lg:w-1/2">
        {children}
      </div>
    </div>
  );
}
