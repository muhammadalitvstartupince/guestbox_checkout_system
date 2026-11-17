import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db/client";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are the GuestBox Checkout Assistant. You help customers complete their GuestBox device order and answer product questions.

ABOUT GUESTBOX:
GuestBox is a plug-and-play hospitality streaming device for vacation rentals, hotels, and short-term rental properties. It turns any TV with an HDMI port into a smart, branded guest entertainment system.

KEY FACTS:
- One GuestBox per TV. Plug it in, connect to WiFi, done.
- Includes streaming apps (Netflix, YouTube, Disney+, etc.) — guests use their own subscriptions.
- Custom welcome screen with property branding, local guides, check-in/out info.
- Guest accounts auto-clear between stays for privacy.
- Works with most TVs that have HDMI (not built-in smart TV apps — it's an external device).
- Ships from the USA. Free domestic shipping. International shipping calculated at checkout.
- Plans are per-property (Gold, Platinum, Diamond) — not per-device or per-account.
- 30-day money-back guarantee.
- Setup takes minutes — plug in, connect WiFi, done.
- Managed service — GuestBox handles updates, support, and maintenance.

BEHAVIOR RULES:
- Be concise, friendly, professional.
- Answer product questions accurately. Never invent features, prices, or integrations.
- If you don't know something: "Great question! For specifics on that, reach out to support@guestbox.tv or visit help.guestbox.net."
- NEVER ask for or accept credit card information in chat. Direct users to the secure payment form.
- Keep responses short — 2-3 sentences max unless the user asks for detail.
- Use **bold** for key terms and - bullet lists for features/steps. Keep formatting clean and readable.

ORDER MODE — when user says "help me order" or similar, guide them through the FULL flow:

1. **Properties**: Ask how many properties they manage. 1 property = 1 rental home/unit/listing.

2. **Devices** (after properties answer): Ask how many TVs to equip. "Each TV needs its own GuestBox." Use set_quantity and set_listing_qty tools.

3. **Cross-sell**: If 1 device, suggest adding more for every TV. If multiple properties, remind they can order for all at once.

4. **Personal info**: Ask for their details one by one or together:
   - First name, Last name, Email, Phone
   - Use the set_profile tool to fill each field into the form.
   - Navigate to step 2 "personal" sub-step first.

5. **Shipping address**: Navigate to "address" sub-step. Ask for:
   - Street address, City, State, ZIP, Country
   - Use set_address tool to fill the form.

6. **Billing plan**: Navigate to "billing-cycle" sub-step. Explain available plans from the checkout context. Let them pick. Upsell annual: "Annual saves X% — want to switch?"

7. **Order summary + payment**: Navigate to step 3. Show a summary using REAL prices from CURRENT FORM STATE:

   📋 **Order Summary**
   - **Devices**: X × $price/ea = $total
   - **Properties**: Y
   - **Plan**: [name] ($price/month)
   {if promo} - **Promo**: [code] — saving $amount
   - **Total today**: $amount

   Then say: "Click the button below to go to payment and enter your card details 🔒"

IMPORTANT: After each user response, proceed to the next step immediately. Don't ask one question and wait. Keep momentum. Use tools to fill the form as you go — the user should see the form updating in real-time.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "set_quantity",
    description: "Set the number of GuestBox devices the customer wants to order.",
    input_schema: {
      type: "object" as const,
      properties: { quantity: { type: "number", description: "Number of devices (1-10)" } },
      required: ["quantity"],
    },
  },
  {
    name: "set_listing_qty",
    description: "Set the number of properties/listings the customer manages.",
    input_schema: {
      type: "object" as const,
      properties: { quantity: { type: "number", description: "Number of properties" } },
      required: ["quantity"],
    },
  },
  {
    name: "navigate_step",
    description: "Navigate the checkout form to a specific step. Use this to guide the customer through checkout.",
    input_schema: {
      type: "object" as const,
      properties: {
        step: { type: "number", description: "Step number: 1 (QTY), 2 (DETAILS), 3 (PAYMENT)" },
        subStep: { type: "string", description: "For step 2 only: 'personal', 'address', or 'billing-cycle'" },
      },
      required: ["step"],
    },
  },
  {
    name: "select_plan",
    description: "Select a billing plan for the customer.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: { type: "string", description: "The plan ID to select" },
        interval: { type: "string", description: "'monthly' or 'annually'" },
      },
      required: ["planId"],
    },
  },
  {
    name: "toggle_addon",
    description: "Add or remove an add-on from the order.",
    input_schema: {
      type: "object" as const,
      properties: {
        addonId: { type: "string", description: "The add-on ID" },
        selected: { type: "boolean", description: "true to add, false to remove" },
      },
      required: ["addonId", "selected"],
    },
  },
  {
    name: "set_profile",
    description: "Set a customer profile field (firstName, lastName, email, phoneNumber) in the checkout form.",
    input_schema: {
      type: "object" as const,
      properties: {
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        phoneNumber: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "set_address",
    description: "Set shipping address fields in the checkout form.",
    input_schema: {
      type: "object" as const,
      properties: {
        addressLine1: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        zip: { type: "string" },
        country: { type: "string", description: "2-letter country code, e.g. US" },
      },
      required: [],
    },
  },
];

interface ChatRequestBody {
  conversationId: string;
  message: string;
  checkoutContext?: {
    productName: string;
    basePriceCents: number;
    priceTiers: { minQty: number; maxQty: number | null; priceCents: number }[];
    billingPlans: { id: string; label: string; interval: string; priceCents: number }[];
    planTiers: { id: string; name: string; prices: { minQty: number; maxQty: number | null; monthlyPriceCents: number }[] }[];
    addons: { id: string; name: string; priceCents: number }[];
  };
  formState?: {
    step: number;
    subStep: string;
    quantity: number;
    listingQty: number;
    hasOrder: boolean;
    profileFilled: boolean;
    addressFilled: boolean;
    unitPriceCents: number;
    totalCents: number;
    promoApplied: boolean;
    promoCode: string | null;
    promoSavingsCents: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const { conversationId, message, checkoutContext, formState } = body;

    if (!conversationId || !message?.trim()) {
      return NextResponse.json({ error: "Missing conversationId or message" }, { status: 400 });
    }

    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 50 } },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Save user message
    await prisma.chatMessage.create({
      data: { conversationId, role: "user", content: message.trim() },
    });

    // Build message history for Claude
    const history: Anthropic.MessageParam[] = conversation.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    history.push({ role: "user", content: message.trim() });

    // Inject checkout context into system prompt if provided
    let systemPrompt = SYSTEM_PROMPT;
    if (checkoutContext) {
      const tierStr = checkoutContext.priceTiers.length > 0
        ? checkoutContext.priceTiers.map((t) => `${t.minQty}${t.maxQty ? `-${t.maxQty}` : "+"} units: $${(t.priceCents / 100).toFixed(2)}/ea`).join(", ")
        : "No volume tiers";
      const planStr = checkoutContext.billingPlans.length > 0
        ? checkoutContext.billingPlans.map((p) => `${p.label} ($${(p.priceCents / 100).toFixed(2)}/${p.interval})`).join(", ")
        : checkoutContext.planTiers.length > 0
          ? checkoutContext.planTiers.map((t) => t.name).join(", ")
          : "No plans";
      const addonStr = checkoutContext.addons.length > 0
        ? checkoutContext.addons.map((a) => `${a.name} ($${(a.priceCents / 100).toFixed(2)})`).join(", ")
        : "None";

      systemPrompt += `\n\nCHECKOUT CONTEXT:
- Product: ${checkoutContext.productName}
- Base price: $${(checkoutContext.basePriceCents / 100).toFixed(2)}
- Volume tiers: ${tierStr}
- Billing plans: ${planStr}
- Add-ons: ${addonStr}
- Shipping: Free domestic (USA). International calculated at checkout.`;
    }

    if (formState) {
      const stepNames = ["", "QTY (quantity selection)", "DETAILS (personal info, address, billing)", "PAYMENT (card, addons, promo, submit)"];
      const fmtDollars = (c: number) => `$${(c / 100).toFixed(2)}`;
      systemPrompt += `\n\nCURRENT FORM STATE:
- Current step: ${stepNames[formState.step] ?? formState.step}${formState.step === 2 ? ` → ${formState.subStep}` : ""}
- Quantity: ${formState.quantity} devices, ${formState.listingQty} properties
- Order started: ${formState.hasOrder ? "yes" : "no"}
- Personal info filled: ${formState.profileFilled ? "yes" : "not yet"}
- Address filled: ${formState.addressFilled ? "yes" : "not yet"}
- Unit price: ${fmtDollars(formState.unitPriceCents)}/device
- Current total: ${fmtDollars(formState.totalCents)}
${formState.promoApplied ? `- Promo applied: ${formState.promoCode} (saving ${fmtDollars(formState.promoSavingsCents)})` : "- No promo applied"}
Use this to avoid asking for info the customer has already provided. Use the REAL prices above when showing order summary — never guess prices.`;
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: systemPrompt,
      messages: history,
      tools: TOOLS,
    });

    // Extract text and tool calls
    let assistantText = "";
    const toolCalls: { name: string; input: Record<string, unknown> }[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        assistantText += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({ name: block.name, input: block.input as Record<string, unknown> });
      }
    }

    // If Claude only returned tool calls with no text, add a brief acknowledgment
    if (!assistantText && toolCalls.length > 0) {
      assistantText = "Done! I've updated your order.";
    }

    // Save assistant message with tool calls
    await prisma.chatMessage.create({
      data: {
        conversationId,
        role: "assistant",
        content: assistantText,
        toolCalls: toolCalls.length > 0 ? JSON.parse(JSON.stringify(toolCalls)) : undefined,
      },
    });

    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return NextResponse.json({
      reply: assistantText,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
