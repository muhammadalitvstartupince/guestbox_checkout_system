"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Send, Loader2, Package, DollarSign, ShoppingCart, Tv, Monitor, Home, Building2, Hotel, Award, Gem, Crown, CalendarDays, Banknote, Check, XCircle, CreditCard, PencilLine, MapPin, Truck, ClipboardList, ThumbsUp, ArrowRight, RefreshCw, Hash, ChevronDown, ChevronUp } from "lucide-react";
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
  promoPriceCents?: number;
  priceTiers: { minQty: number; maxQty: number | null; priceCents: number }[];
  billingPlans: { id: string; label: string; interval: string; priceCents: number }[];
  planTiers: { id: string; name: string; prices: { minQty: number; maxQty: number | null; monthlyPriceCents: number }[] }[];
  addons: { id: string; name: string; priceCents: number }[];
}

type QuickReply = { icon: React.ComponentType<{ className?: string }>; label: string; text: string };

/** Detect context from bot message and return quick-reply buttons */
function getQuickReplies(content: string, isGreeting: boolean): QuickReply[] {
  const lower = content.toLowerCase();

  // Greeting — show main CTAs
  if (isGreeting) {
    return [
      { icon: Package, label: "What is GuestBox?", text: "What is GuestBox?" },
      { icon: DollarSign, label: "Pricing & Plans", text: "What are the pricing options and plans?" },
      { icon: ShoppingCart, label: "Help me order", text: "Help me place my order" },
    ];
  }

  // Asking about number of devices / TVs / GuestBoxes — check BEFORE properties
  if (lower.includes("how many tv") || lower.includes("how many devices") || lower.includes("how many guestbox") || lower.includes("equip") || lower.includes("total do you")) {
    const TvIcon = ({ count, className }: { count: number; className?: string }) => (
      <span className={`inline-flex items-center gap-0.5 ${className ?? ""}`}>
        {Array.from({ length: Math.min(count, 3) }, (_, i) => (
          <Monitor key={i} className={`${count === 1 ? "h-5 w-5" : "h-4 w-4"} text-cyan-400`} />
        ))}
        {count > 3 && <span className="text-[9px] font-bold text-cyan-400">+</span>}
      </span>
    );
    return [
      { icon: ({ className }: { className?: string }) => <TvIcon count={1} className={className} />, label: "1", text: "1 device" },
      { icon: ({ className }: { className?: string }) => <TvIcon count={2} className={className} />, label: "2", text: "2 devices" },
      { icon: ({ className }: { className?: string }) => <TvIcon count={3} className={className} />, label: "3", text: "3 devices" },
      { icon: ({ className }: { className?: string }) => <TvIcon count={3} className={className} />, label: "5", text: "5 devices" },
      { icon: ({ className }: { className?: string }) => <TvIcon count={3} className={className} />, label: "10", text: "10 devices" },
    ];
  }

  // Asking about number of properties
  if (lower.includes("how many properties") || lower.includes("how many locations") || lower.includes("do you manage")) {
    return [
      { icon: Home, label: "1 Property", text: "1 property" },
      { icon: Building2, label: "2-5 Properties", text: "2 properties" },
      { icon: Hotel, label: "6+ Properties", text: "6 properties" },
    ];
  }

  // Asking about plan choice (Gold/Platinum/Diamond or monthly/annual)
  if (lower.includes("which plan") || lower.includes("gold") || lower.includes("platinum") || lower.includes("diamond") || lower.includes("monthly or annual")) {
    const replies: QuickReply[] = [];
    if (lower.includes("gold") || lower.includes("which plan")) replies.push({ icon: Award, label: "Gold", text: "Gold plan" });
    if (lower.includes("platinum") || lower.includes("which plan")) replies.push({ icon: Crown, label: "Platinum", text: "Platinum plan" });
    if (lower.includes("diamond") || lower.includes("which plan")) replies.push({ icon: Gem, label: "Diamond", text: "Diamond plan" });
    if (lower.includes("monthly") || lower.includes("annual")) {
      replies.push({ icon: CalendarDays, label: "Monthly", text: "Monthly billing" });
      replies.push({ icon: Banknote, label: "Annual (save more)", text: "Annual billing" });
    }
    return replies;
  }

  // Yes/No questions
  if (lower.includes("would you like") || lower.includes("ready to") || lower.includes("shall i") || lower.includes("do you want")) {
    return [
      { icon: Check, label: "Yes", text: "Yes" },
      { icon: XCircle, label: "No thanks", text: "No thanks" },
    ];
  }

  // Payment / card entry
  if (lower.includes("card details") || lower.includes("payment form") || lower.includes("secure form") || lower.includes("enter your card") || lower.includes("complete your order")) {
    return [
      { icon: CreditCard, label: "Go to Payment", text: "Take me to the payment step" },
    ];
  }

  // Confirming personal info from lead gate
  if (lower.includes("is this correct") || lower.includes("would you like to change") || lower.includes("here's what i have")) {
    return [
      { icon: Check, label: "Looks good!", text: "Yes, that's correct" },
      { icon: PencilLine, label: "Change name", text: "I want to change my name" },
      { icon: PencilLine, label: "Change email", text: "I want to change my email" },
      { icon: PencilLine, label: "Change phone", text: "I want to change my phone number" },
    ];
  }

  // Asking for new personal info (user wants to change)
  if (lower.includes("first name") || lower.includes("your name") || lower.includes("new name") || lower.includes("updated name")) {
    return [];
  }

  // Address step
  if (lower.includes("shipping address") || lower.includes("fill in your") || lower.includes("address in the form") || lower.includes("where should we ship")) {
    return [
      { icon: MapPin, label: "Done, next step", text: "__check_address__" },
    ];
  }

  // Billing plan selection
  if (lower.includes("billing") || lower.includes("plan option")) {
    return [
      { icon: CalendarDays, label: "Monthly", text: "Monthly billing" },
      { icon: Banknote, label: "Annual (save more)", text: "Annual billing" },
    ];
  }

  // Cross-sell — more devices
  if (lower.includes("add more") || lower.includes("every tv") || lower.includes("want to add")) {
    return [
      { icon: Tv, label: "Add more devices", text: "Yes, let me add more devices" },
      { icon: ThumbsUp, label: "I'm good", text: "No, that's enough" },
    ];
  }

  // Idle nudge — "still there" re-engagement
  if (lower.includes("still there") || lower.includes("before you check out")) {
    return [
      { icon: ShoppingCart, label: "Continue order", text: "Help me finish my order" },
      { icon: DollarSign, label: "Any discounts?", text: "Are there any discounts or promo codes available?" },
      { icon: Truck, label: "Shipping info", text: "How does shipping work?" },
      { icon: ClipboardList, label: "Compare plans", text: "Tell me about the plans" },
    ];
  }

  // Asking if they have questions or need help
  if (lower.includes("any questions") || lower.includes("anything else") || lower.includes("can i help")) {
    return [
      { icon: ClipboardList, label: "Tell me about plans", text: "Tell me about the plans" },
      { icon: Truck, label: "How does shipping work?", text: "How does shipping work?" },
      { icon: ShoppingCart, label: "I'm ready to order", text: "Help me place my order" },
    ];
  }

  // "Talk to a human" response — show schedule demo button
  if (lower.includes("book a demo") || lower.includes("sales@guestbox")) {
    return [
      { icon: Package, label: "SCHEDULE A LIVE DEMO", text: "__schedule_demo__" },
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
        {listItems.map((item, i) => <li key={i}>{parseInline(item)}</li>)}
      </ul>
    );
    listItems = [];
  }

  function parseInline(str: string): React.ReactNode {
    // Handle **bold** and [text](url) links
    const parts = str.split(/(\*\*.*?\*\*|\[.*?\]\(.*?\))/g);
    if (parts.length === 1) return str;
    return parts.map((part, i) => {
      const boldMatch = part.match(/^\*\*(.*?)\*\*$/);
      if (boldMatch) return <strong key={i}>{boldMatch[1]}</strong>;
      const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch) return <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="font-semibold text-cyan-600 underline hover:text-cyan-700">{linkMatch[1]}</a>;
      return part;
    });
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      listItems.push(trimmed.slice(2));
    } else {
      flushList();
      if (trimmed) {
        elements.push(<p key={`p-${elements.length}`}>{parseInline(trimmed)}</p>);
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

export function ChatWidget({ checkoutPageId, checkoutContext, embedded = false, leadGateEnabled = true }: { checkoutPageId: string; checkoutContext?: CheckoutContext; embedded?: boolean; leadGateEnabled?: boolean }) {
  const [open, setOpen] = useState(embedded);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showBubbleMsg, setShowBubbleMsg] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Guided flow state (when lead gate is off)
  type GuidedStep = "properties" | "properties-picker" | "tvs" | "tvs-input" | "summary" | "form-personal" | "form-address" | "form-billing" | "form-payment" | "form-final" | "done";
  const [guidedStep, setGuidedStep] = useState<GuidedStep | null>(null);
  const [guidedProps, setGuidedProps] = useState(1);
  const [guidedTvsPerProp, setGuidedTvsPerProp] = useState(1);
  const [pickerValue, setPickerValue] = useState(2);

  // Show greeting bubble after 15s of TRUE inactivity (no clicks, typing, scrolling)
  useEffect(() => {
    if (embedded || open) return;
    let timer = setTimeout(() => setShowBubbleMsg(true), 15_000);
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => setShowBubbleMsg(true), 15_000); };
    window.addEventListener("click", reset, true);
    window.addEventListener("keydown", reset, true);
    window.addEventListener("scroll", reset, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", reset, true);
      window.removeEventListener("keydown", reset, true);
      window.removeEventListener("scroll", reset, true);
    };
  }, [embedded, open]);

  // Lead gate form state — pre-fill from checkout form if user already typed info
  const [leadForm, setLeadForm] = useState(() => {
    const b = getChatBridge();
    if (b?.profileForm) {
      return {
        firstName: b.profileForm.firstName || "",
        lastName: b.profileForm.lastName || "",
        email: b.profileForm.email || "",
        phoneCountry: (b.profileForm as Record<string, string>).phoneCountry || DEFAULT_COUNTRY_CODE,
        phoneNumber: b.profileForm.phone || "",
      };
    }
    return { firstName: "", lastName: "", email: "", phoneCountry: DEFAULT_COUNTRY_CODE, phoneNumber: "" };
  });
  const [leadSubmitting, setLeadSubmitting] = useState(false);

  const scrollToBottom = useCallback(() => {
    const el = messagesEndRef.current?.parentElement?.parentElement;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { if (open && conversationId) inputRef.current?.focus(); }, [open, conversationId]);

  // Show guided greeting immediately but defer conversation creation until first interaction
  const autoStarted = useRef(false);
  useEffect(() => {
    if (leadGateEnabled || autoStarted.current) return;
    autoStarted.current = true;
    const rawCents = checkoutContext?.promoPriceCents || checkoutContext?.priceTiers?.[0]?.priceCents || checkoutContext?.basePriceCents || 9900;
    const priceDollars = Math.floor(rawCents / 100);
    setMessages([{ role: "assistant", content: `Hi! I'll help you set up your order. Devices are $${priceDollars} each right now, with your first month free, plus 7 extra days to allow for shipping.\n\n**How many properties do you manage?**` }]);
    setGuidedStep("properties");
  }, [leadGateEnabled, checkoutContext]);

  // Create conversation on server only when user first interacts
  async function ensureConversation() {
    if (conversationId) return conversationId;
    try {
      const res = await fetch("/api/chat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutPageId, sessionId, skipLeadGate: true }),
      });
      const data = await res.json();
      if (data.conversationId) {
        setConversationId(data.conversationId);
        setChatConversationId(data.conversationId);
        return data.conversationId as string;
      }
    } catch { /* silent */ }
    return null;
  }

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
        setMessages((prev) => [...prev, { role: "assistant", content: "Hey! Still there? No worries — I'm here whenever you're ready. Need help with anything before you check out?" }]);
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
        // Push lead gate info into the checkout form
        const bridge = getChatBridge();
        if (bridge) {
          bridge.setProfileField("firstName", leadForm.firstName);
          bridge.setProfileField("lastName", leadForm.lastName);
          bridge.setProfileField("email", leadForm.email);
          bridge.setProfileField("phoneCountry", leadForm.phoneCountry);
          bridge.setProfileField("phoneNumber", leadForm.phoneNumber);
        }
        // Start guided flow (same as no-lead-gate mode)
        const rawCents = checkoutContext?.promoPriceCents || checkoutContext?.priceTiers?.[0]?.priceCents || checkoutContext?.basePriceCents || 9900;
        const priceDollars = Math.floor(rawCents / 100);
        setMessages([{ role: "assistant", content: `Hi ${leadForm.firstName}! I'll help you set up your order. Devices are $${priceDollars} each right now, with your first month free, plus 7 extra days to allow for shipping.\n\n**How many properties do you manage?**` }]);
        setGuidedStep("properties");
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setLeadSubmitting(false);
    }
  }

  async function sendMessage(text: string) {
    if (!text || !conversationId || sending) return;

    if (text === "__schedule_demo__") {
      window.open("https://guestbox.tv/schedule-live-demo", "_blank", "noopener");
      return;
    }

    // Intercept validation checks
    if (text === "__check_address__") {
      const b = getChatBridge();
      if (b && !b.addressFilled) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Please fill in your shipping address in the form first — I need at least street address, city, and ZIP code 📝" }]);
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

  function handleTalkToHuman() {
    setMessages(prev => [...prev,
      { role: "assistant", content: "For sales and orders, email [sales@guestbox.tv](mailto:sales@guestbox.tv). For an existing order, email [support@guestbox.tv](mailto:support@guestbox.tv). You can also use Live Chat on the form, or book a demo." },
    ]);
  }

  // --- Guided flow helpers ---
  const TV_QUESTION = "**Quick note:** GuestBox is not needed on every TV. That's your choice: it just has to be on at least one TV, the main television in the home. It can be more effective on every TV, and you can always expand later. Some hosts do all their TVs, some 2, some just 1.\n\n**How many TVs per property do you want GuestBox on?**";

  const pendingMessages = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  function saveGuidedMessages(msgs: { role: "user" | "assistant"; content: string }[]) {
    pendingMessages.current.push(...msgs);
    if (!conversationId) return; // will flush when conversationId arrives
    flushPendingMessages(conversationId);
  }

  function flushPendingMessages(cId: string) {
    if (!pendingMessages.current.length) return;
    const toSave = [...pendingMessages.current];
    pendingMessages.current = [];
    fetch("/api/chat/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: cId, messages: toSave }),
    }).catch(() => {});
  }

  // Flush pending messages when conversationId becomes available
  useEffect(() => {
    if (conversationId && pendingMessages.current.length) flushPendingMessages(conversationId);
  }, [conversationId]);

  function addGuidedMessages(userMsg: string, botMsg: string) {
    const msgs: { role: "user" | "assistant"; content: string }[] = [{ role: "user", content: userMsg }, { role: "assistant", content: botMsg }];
    setMessages(prev => [...prev, ...msgs]);
    saveGuidedMessages(msgs);
  }

  function addBotMessage(content: string) {
    setMessages(prev => [...prev, { role: "assistant", content }]);
    saveGuidedMessages([{ role: "assistant", content }]);
  }

  function updateFormQuantities(props: number, tvs: number) {
    const bridge = getChatBridge();
    if (bridge) {
      bridge.setListingQty(props);
      bridge.setQuantity(props * tvs);
    }
  }

  function finishTvSelection(props: number, tvs: number) {
    setGuidedTvsPerProp(tvs);
    updateFormQuantities(props, tvs);
    const total = props * tvs;
    const propLabel = props === 1 ? "1 property" : `${props} properties`;
    const perProp = props > 1 ? ` (${tvs} per property)` : "";
    addGuidedMessages(
      tvs === 1 ? "1 TV" : `${tvs} TVs`,
      `I've set your order to **${propLabel}** and **${total} GuestBox${total > 1 ? "es" : ""}**${perProp}. Just pick your plan (or skip, it defaults to Gold) and enter your details. First month free, plus 7 extra days to allow for shipping.\n\nShipping is **FREE inside the US**. For international orders, shipping is calculated at checkout. You can adjust the counters in the form if needed.`,
    );
    setGuidedStep("summary");
  }

  function handleGuidedAction(action: string) {
    // Create conversation on first interaction (lazy init)
    if (!conversationId && !leadGateEnabled) ensureConversation();

    switch (guidedStep) {
      case "properties":
        if (action === "1-property") {
          setGuidedProps(1);
          updateFormQuantities(1, 1);
          addGuidedMessages("1 Property", TV_QUESTION);
          setGuidedStep("tvs");
        } else {
          setPickerValue(2);
          setGuidedStep("properties-picker");
        }
        break;
      case "properties-picker": {
        const p = pickerValue;
        setGuidedProps(p);
        updateFormQuantities(p, 1);
        addGuidedMessages(`${p} Properties`, TV_QUESTION);
        setGuidedStep("tvs");
        break;
      }
      case "tvs":
        if (action === "1-tv") { finishTvSelection(guidedProps, 1); }
        else if (action === "2-tvs") { finishTvSelection(guidedProps, 2); }
        else { setPickerValue(3); setGuidedStep("tvs-input"); }
        break;
      case "tvs-input":
        finishTvSelection(guidedProps, pickerValue);
        break;
      case "summary":
        if (action === "done") {
          const b = getChatBridge();
          if (b) {
            b.setWizardStep(2);
            b.setDetailsSubStep("personal");
          }
          addBotMessage("In the form, enter your **First Name**, **Last Name**, **Email Address**, and **Phone Number**, then press **Next**.");
          setGuidedStep("form-personal");
        } else {
          const pd = Math.floor((checkoutContext?.promoPriceCents || checkoutContext?.priceTiers?.[0]?.priceCents || checkoutContext?.basePriceCents || 9900) / 100);
          addGuidedMessages("Change quantities", `No problem! Devices are $${pd} each.\n\n**How many properties do you manage?**`);
          setGuidedStep("properties");
        }
        break;
      case "form-personal": {
        const b = getChatBridge();
        if (b && b.profileForm.firstName && b.profileForm.email) {
          b.setWizardStep(2);
          b.setDetailsSubStep("address");
          setMessages(prev => [...prev,
            { role: "user", content: "Done, next step" },
            { role: "assistant", content: "This is where your GuestBox device(s) will be shipped. Enter **Street Address**, **Country**, **City**, **State / Province**, and **Zip Code**, then press **Next**. Shipping is **FREE inside the US**; international shipping is calculated at checkout." },
          ]);
          setGuidedStep("form-address");
        } else {
          addBotMessage("Please fill in your **First Name**, **Email**, and other personal details in the form first.");
        }
        break;
      }
      case "form-address": {
        const b = getChatBridge();
        if (b && b.addressFilled) {
          b.setWizardStep(2);
          b.setDetailsSubStep("billing-cycle");
          setMessages(prev => [...prev,
            { role: "user", content: "Done, next step" },
            { role: "assistant", content: "Choose Your Plan (**GOLD**, **PLATINUM**, or **DIAMOND**) and a Billing Cycle (Annual renews 13 months after purchase: free first month plus 12 months). You can skip it — it defaults to Gold, and you can change your tier later during onboarding. Then press **Next**." },
          ]);
          setGuidedStep("form-billing");
        } else {
          addBotMessage("Please fill in your **shipping address** in the form first — I need at least street address, city, and ZIP code.");
        }
        break;
      }
      case "form-billing": {
        const b = getChatBridge();
        if (b) {
          b.setWizardStep(3);
          setMessages(prev => [...prev,
            { role: "user", content: "Done, next step" },
            { role: "assistant", content: "Enter your **Credit Card Number**, **Exp. Month**, **Exp. Year**, and **CVV**. First month free, plus 7 extra days to allow for shipping. Review the **Order Summary**, agree to the **Terms & Conditions**, and press **Submit** when you're ready." },
          ]);
          setGuidedStep("form-payment");
        }
        break;
      }
      case "form-payment":
        setMessages(prev => [...prev,
          { role: "user", content: "Done, next step" },
          { role: "assistant", content: "You're at the last step in the form. When you press **Submit**, you'll get a confirmation email. Don't type card numbers in this chat." },
        ]);
        setGuidedStep("form-final");
        break;
      case "form-final":
        setGuidedStep("done");
        break;
    }
  }

  function renderGuidedButtons() {
    const btnClass = "flex w-full items-center justify-center gap-3 rounded-xl border border-cyan-500/30 bg-[#0c2d48] px-4 py-4 text-base font-bold text-white transition hover:bg-[#0e3a5c]";

    if (guidedStep === "properties") {
      return (
        <div className="mt-3 flex flex-col gap-2 px-2">
          <button type="button" onClick={() => handleGuidedAction("1-property")} className={btnClass}><Home className="h-5 w-5 text-cyan-400" /> 1 Property</button>
          <button type="button" onClick={() => handleGuidedAction("multiple")} className={btnClass}><Building2 className="h-5 w-5 text-cyan-400" /> Multiple Properties</button>
          <button type="button" onClick={handleTalkToHuman} className="mt-1 text-center text-sm text-white/50 underline hover:text-white/70">Talk to a human</button>
        </div>
      );
    }

    if (guidedStep === "properties-picker" || guidedStep === "tvs-input") {
      const min = guidedStep === "properties-picker" ? 2 : 3;
      const label = guidedStep === "properties-picker" ? "properties" : "TVs per property";
      return (
        <div className="mx-2 mt-3 rounded-xl border border-cyan-500/30 bg-[#0c2d48] p-4">
          <p className="mb-3 text-center text-sm font-semibold text-white">How many {label}?</p>
          <div className="flex items-center justify-center gap-6">
            <button type="button" onClick={() => setPickerValue(v => Math.max(min, v - 1))} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-xl font-bold text-white hover:bg-white/10">−</button>
            <span className="min-w-[3ch] text-center text-3xl font-bold text-white">{pickerValue}</span>
            <button type="button" onClick={() => setPickerValue(v => Math.min(50, v + 1))} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-xl font-bold text-white hover:bg-white/10">+</button>
          </div>
          <button type="button" onClick={() => handleGuidedAction("confirm")} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 py-3 text-sm font-bold text-white hover:bg-cyan-600"><ArrowRight className="h-4 w-4" /> Continue</button>
        </div>
      );
    }

    if (guidedStep === "tvs") {
      return (
        <div className="mt-3 flex flex-col gap-2 px-2">
          <button type="button" onClick={() => handleGuidedAction("1-tv")} className={btnClass}><Monitor className="h-5 w-5 text-cyan-400" /> 1 TV (the main TV)</button>
          <button type="button" onClick={() => handleGuidedAction("2-tvs")} className={btnClass}><Tv className="h-5 w-5 text-cyan-400" /> 2 TVs</button>
          <button type="button" onClick={() => handleGuidedAction("more")} className={btnClass}><Hash className="h-5 w-5 text-cyan-400" /> More (type a number)</button>
        </div>
      );
    }

    if (guidedStep === "summary") {
      return (
        <div className="mt-3 flex flex-col gap-2 px-2">
          <button type="button" onClick={() => handleGuidedAction("done")} className={btnClass}><ArrowRight className="h-5 w-5 text-cyan-400" /> Done, next step</button>
          <div className="flex items-center justify-center gap-4">
            <button type="button" onClick={() => handleGuidedAction("change")} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"><RefreshCw className="h-3.5 w-3.5" /> Change quantities</button>
            <button type="button" onClick={handleTalkToHuman} className="text-sm text-white/50 underline hover:text-white/70">Talk to a human</button>
          </div>
        </div>
      );
    }

    // Form step guide buttons
    if (guidedStep?.startsWith("form-")) {
      return (
        <div className="mt-3 flex flex-col gap-2 px-2">
          <button type="button" onClick={() => handleGuidedAction("next")} className={btnClass}><ArrowRight className="h-5 w-5 text-cyan-400" /> Done, next step</button>
          <div className="flex items-center justify-center gap-4">
            <button type="button" onClick={handleTalkToHuman} className="text-sm text-white/50 underline hover:text-white/70">Talk to a human</button>
          </div>
        </div>
      );
    }

    return null;
  }

  const inputClass = embedded
    ? "w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white shadow-sm placeholder:text-white/40 transition focus:border-cyan-500 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
    : "w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 transition focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20";

  const panelClasses = embedded
    ? "flex w-full flex-col overflow-hidden bg-[#0b1a2b] lg:h-full lg:rounded-2xl"
    : "fixed bottom-5 right-5 z-50 flex h-[480px] w-[380px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl sm:h-[520px]";

  return (
    <>
      {/* Floating bubble + greeting — hidden in embedded mode */}
      {!embedded && !open && (
        <div className="fixed bottom-2 right-2 z-50 flex flex-col items-end gap-2">
          <style>{`
            @keyframes floatBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
            @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          `}</style>
          {showBubbleMsg && (
            <div className="relative max-w-[180px] animate-[fadeSlideUp_0.4s_ease-out] rounded-xl bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-lg">
              <button onClick={(e) => { e.stopPropagation(); setShowBubbleMsg(false); }} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 hover:bg-zinc-300 hover:text-zinc-700" aria-label="Dismiss"><X className="h-3 w-3" /></button>
              Hi, I'm GuestBox Assistant. How may I help you?
              <div className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 bg-white" />
            </div>
          )}
          <button
            onClick={() => {
              const b = getChatBridge();
              if (b?.profileForm && !conversationId) {
                setLeadForm((prev) => ({
                  firstName: prev.firstName || b.profileForm.firstName || "",
                  lastName: prev.lastName || b.profileForm.lastName || "",
                  email: prev.email || b.profileForm.email || "",
                  phoneCountry: prev.phoneCountry || (b.profileForm as Record<string, string>).phoneCountry || DEFAULT_COUNTRY_CODE,
                  phoneNumber: prev.phoneNumber || b.profileForm.phone || "",
                }));
              }
              setOpen(true);
            }}
            className="h-16 w-16 overflow-hidden rounded-full shadow-lg transition hover:scale-110 hover:shadow-xl"
            style={{ animation: "floatBounce 2s ease-in-out infinite" }}
            aria-label="Open chat"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pages_Images/robot.png" alt="Chat" className="h-full w-full object-cover" />
          </button>
        </div>
      )}

      {/* Chat panel */}
      {open && (
        <div className={panelClasses}>
          {/* Header */}
          {embedded ? (
            <button
              type="button"
              onClick={() => setMobileOpen(v => !v)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left lg:cursor-default"
              style={{ background: "linear-gradient(135deg, #0c2d48 0%, #0a4d6e 50%, #0c2d48 100%)" }}
            >
              <style>{`
                @keyframes bot-hover { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
                @keyframes pulse-dot { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .6; transform: scale(1.4); } }
              `}</style>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/pages_Images/robot.png" alt="Bot" className="h-10 w-10 shrink-0 rounded-full object-cover" style={{ animation: "bot-hover 2s ease-in-out infinite" }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">GuestBox Order Assistant</p>
                <p className="flex items-center gap-1.5 text-xs text-white/70">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" style={{ animation: "pulse-dot 1.5s ease-in-out infinite" }} />
                  Questions about your order? Ask here.
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-cyan-300 lg:hidden">
                {mobileOpen ? "Hide" : "Ask"} {mobileOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>
          ) : (
            <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0c2d48 0%, #0a4d6e 50%, #0c2d48 100%)" }}>
              <button onClick={() => setOpen(false)} className="absolute right-2 top-2 z-10 rounded p-1 text-white/70 hover:bg-white/20 hover:text-white" aria-label="Close chat">
                <X className="h-4 w-4" />
              </button>
              <style>{`
                @keyframes bot-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
                @keyframes bubble-glow { 0%,100% { box-shadow: 0 0 8px rgba(6,182,212,0.2); } 50% { box-shadow: 0 0 18px rgba(6,182,212,0.5); } }
                @keyframes wave { 0% { transform: rotate(0deg); } 15% { transform: rotate(14deg); } 30% { transform: rotate(-8deg); } 45% { transform: rotate(14deg); } 60% { transform: rotate(-4deg); } 75% { transform: rotate(10deg); } 100% { transform: rotate(0deg); } }
              `}</style>
              <div className="flex items-end gap-2 px-3 pt-2 sm:gap-3 sm:px-4 sm:pt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/pages_Images/robot.png"
                  alt="GuestBox Bot"
                  className="h-14 w-14 shrink-0 object-contain sm:h-20 sm:w-20"
                  style={!conversationId ? { animation: "bot-bounce 2s ease-in-out infinite" } : undefined}
                />
                <div
                  className="mb-2 rounded-lg border border-cyan-500/30 bg-cyan-900/40 px-2.5 py-2 backdrop-blur-sm sm:mb-3 sm:rounded-xl sm:px-3.5 sm:py-2.5"
                  style={!conversationId ? { animation: "bubble-glow 2s ease-in-out infinite" } : undefined}
                >
                  <p className="text-xs font-bold text-white sm:text-sm">
                    <span style={!conversationId ? { display: "inline-block", animation: "wave 1.5s ease-in-out infinite", transformOrigin: "70% 70%" } : undefined}>👋</span>
                    {" "}Hi! I'm the <span className="text-cyan-300">GuestBox Checkout Assistant.</span>
                  </p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-white sm:text-xs">I'll help you get the right setup, explain your options, and apply any coupon codes. It only takes a minute!</p>
                </div>
              </div>
            </div>
          )}

          <div className={embedded ? `flex-1 flex-col overflow-hidden ${mobileOpen ? "flex" : "hidden lg:flex"}` : "flex flex-1 flex-col"}>
          {!conversationId && leadGateEnabled ? (
            /* Lead gate form */
            <form onSubmit={handleLeadSubmit} className="flex flex-1 flex-col gap-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`mb-1 block text-xs font-semibold ${embedded ? "text-white/70" : "text-zinc-500"}`}>First Name</label>
                  <input
                    className={inputClass}
                    placeholder="John"
                    value={leadForm.firstName}
                    onChange={(e) => setLeadForm((f) => ({ ...f, firstName: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className={`mb-1 block text-xs font-semibold ${embedded ? "text-white/70" : "text-zinc-500"}`}>Last Name</label>
                  <input
                    className={inputClass}
                    placeholder="Doe"
                    value={leadForm.lastName}
                    onChange={(e) => setLeadForm((f) => ({ ...f, lastName: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div>
                <label className={`mb-1 block text-xs font-semibold ${embedded ? "text-white/70" : "text-zinc-500"}`}>Email</label>
                <input
                  className={inputClass}
                  type="email"
                  placeholder="john@example.com"
                  value={leadForm.email}
                  onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <PhoneNumberField
                  country={leadForm.phoneCountry}
                  onCountryChange={(code) => setLeadForm((f) => ({ ...f, phoneCountry: code }))}
                  number={leadForm.phoneNumber}
                  onNumberChange={(val) => setLeadForm((f) => ({ ...f, phoneNumber: val }))}
                  dark={embedded}
                />
              </div>
              <button
                type="submit"
                disabled={leadSubmitting}
                className={`inline-flex w-full items-center justify-center gap-2 text-white transition disabled:opacity-60 ${
                  embedded
                    ? "rounded-full py-3.5 text-lg font-bold hover:brightness-110"
                    : "rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold hover:bg-cyan-700"
                }`}
                style={embedded ? { backgroundColor: "#0284C7" } : undefined}
              >
                {leadSubmitting ? "Starting…" : <><span>Start Chat</span><Send className="h-5 w-5" /></>}
              </button>
            </form>
          ) : (
            /* Chat messages + input */
            <>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-3">
                  {messages.map((msg, i) => {
                    const isLast = msg.role === "assistant" && i === messages.length - 1 && !sending;
                    const isGuided = guidedStep !== null && guidedStep !== "done";
                    const quickReplies = isLast && (!isGuided || msg.content.includes("book a demo")) ? getQuickReplies(msg.content, i === 0) : [];
                    return (
                      <div key={i}>
                        <div className={`flex ${msg.role === "user" ? "justify-end" : "items-start gap-2"}`}>
                          {msg.role === "assistant" && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src="/icons/100-by-100.png" alt="" className="mt-1 h-6 w-6 shrink-0 rounded-full" />
                          )}
                          <div
                            className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                              msg.role === "user"
                                ? "bg-cyan-600 text-white"
                                : embedded
                                  ? "bg-white/10 text-white/90"
                                  : "bg-zinc-100 text-zinc-800"
                            }`}
                          >
                            {msg.role === "assistant" ? formatMessage(msg.content) : msg.content}
                          </div>
                        </div>
                        {quickReplies.length > 0 && (
                          <div className={embedded ? "mt-3 flex flex-col gap-2 px-2" : "ml-8 mt-2 flex flex-wrap gap-2"}>
                            {quickReplies.map((cta) => (
                              <button
                                key={cta.label}
                                type="button"
                                onClick={() => sendMessage(cta.text)}
                                className={embedded
                                  ? cta.text === "__schedule_demo__"
                                    ? "inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-500"
                                    : "w-full rounded-xl bg-cyan-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-cyan-600"
                                  : "flex flex-col items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-white transition hover:border-cyan-400 hover:shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                                }
                              >
                                {!embedded && <cta.icon className="h-5 w-5 text-cyan-400" />}
                                <span className={embedded ? "" : "text-[11px] font-semibold leading-tight"}>{cta.label}</span>
                              </button>
                            ))}
                            {embedded && !quickReplies.some(c => c.text === "__schedule_demo__") && (
                              <button type="button" onClick={handleTalkToHuman} className="mt-1 text-center text-sm text-white/50 underline hover:text-white/70">
                                Talk to a human
                              </button>
                            )}
                          </div>
                        )}
                        {isLast && isGuided && renderGuidedButtons()}
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

              <div className={`border-t p-3 ${embedded ? "border-white/10 bg-[#0b1a2b]" : "border-zinc-200 bg-slate-900"}`}>
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    className="max-h-24 min-h-[38px] flex-1 resize-none rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    placeholder={embedded ? "Type a question about ordering…" : "Type a message…"}
                    value={input}
                    onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    disabled={sending}
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !input.trim()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-700/40 text-cyan-300 transition hover:bg-cyan-600 hover:text-white disabled:opacity-40"
                    aria-label="Send"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                {embedded && <p className="mt-2 text-center text-[11px] text-white/40">Automated helper with answers from guestbox.tv.</p>}
              </div>
            </>
          )}
          </div>{/* end collapsible content */}
        </div>
      )}
    </>
  );
}
