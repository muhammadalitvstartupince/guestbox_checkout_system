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
- When helping with an order, use the provided tools to fill form fields and navigate checkout steps.
- For payment: direct the user to enter card details in the secure form. Never collect card info in chat.`;

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
      systemPrompt += `\n\nCURRENT FORM STATE:
- Current step: ${stepNames[formState.step] ?? formState.step}${formState.step === 2 ? ` → ${formState.subStep}` : ""}
- Quantity: ${formState.quantity} devices, ${formState.listingQty} properties
- Order started: ${formState.hasOrder ? "yes" : "no"}
- Personal info filled: ${formState.profileFilled ? "yes" : "not yet"}
- Address filled: ${formState.addressFilled ? "yes" : "not yet"}
Use this to avoid asking for info the customer has already provided. Guide them to the next unfilled step.`;
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
