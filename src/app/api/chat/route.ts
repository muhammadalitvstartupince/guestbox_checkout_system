import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db/client";
import { getChatbotSettings } from "@/lib/chatbot/settings";

const anthropic = new Anthropic();

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
    profileFirstName: string;
    profileLastName: string;
    profileEmail: string;
    profilePhone: string;
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

    const chatSettings = await getChatbotSettings();

    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" }, take: chatSettings.maxMessages } },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Enforce message limit — count user messages only
    const userMessageCount = conversation.messages.filter((m) => m.role === "user").length;
    if (userMessageCount >= chatSettings.maxMessages) {
      return NextResponse.json({
        reply: "You've reached the message limit for this chat. You can complete your order using the form, or **[Schedule a Call](https://guestbox.tv/schedule-live-demo)** with our team for personalized help!",
      });
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
    let systemPrompt = chatSettings.systemPrompt;
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
- Personal info filled: ${formState.profileFilled ? "yes" : "not yet"}${formState.profileFilled ? `
  - Name: ${formState.profileFirstName} ${formState.profileLastName}
  - Email: ${formState.profileEmail}
  - Phone: ${formState.profilePhone}` : ""}
- Address filled: ${formState.addressFilled ? "yes" : "not yet"}
- Unit price: ${fmtDollars(formState.unitPriceCents)}/device
- Current total: ${fmtDollars(formState.totalCents)}
${formState.promoApplied ? `- Promo applied: ${formState.promoCode} (saving ${fmtDollars(formState.promoSavingsCents)})` : "- No promo applied"}
Use this to avoid asking for info the customer has already provided. Use the REAL prices above when showing order summary — never guess prices.`;
    }

    // Tool-use loop: Claude may return tool calls, we send results back and let it continue
    let currentMessages = history;
    let assistantText = "";
    const allToolCalls: { name: string; input: Record<string, unknown> }[] = [];
    let iterations = 0;

    while (iterations < 5) {
      iterations++;
      const response = await anthropic.messages.create({
        model: chatSettings.chatModel,
        max_tokens: 1024,
        system: systemPrompt,
        messages: currentMessages,
        tools: TOOLS,
      });

      // Collect text and tool calls from this response
      const toolUseBlocks: { id: string; name: string; input: Record<string, unknown> }[] = [];
      for (const block of response.content) {
        if (block.type === "text") {
          assistantText += block.text;
        } else if (block.type === "tool_use") {
          toolUseBlocks.push({ id: block.id, name: block.name, input: block.input as Record<string, unknown> });
          allToolCalls.push({ name: block.name, input: block.input as Record<string, unknown> });
        }
      }

      // If no tool calls, we're done — Claude gave a final text response
      if (response.stop_reason !== "tool_use" || toolUseBlocks.length === 0) break;

      // Send tool results back so Claude can continue
      currentMessages = [
        ...currentMessages,
        { role: "assistant" as const, content: response.content },
        {
          role: "user" as const,
          content: toolUseBlocks.map((t) => ({
            type: "tool_result" as const,
            tool_use_id: t.id,
            content: `Done — ${t.name} executed successfully.`,
          })),
        },
      ];
    }

    if (!assistantText) {
      assistantText = "I've updated your order! What's next?";
    }

    // Save assistant message with tool calls
    await prisma.chatMessage.create({
      data: {
        conversationId,
        role: "assistant",
        content: assistantText,
        toolCalls: allToolCalls.length > 0 ? JSON.parse(JSON.stringify(allToolCalls)) : undefined,
      },
    });

    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return NextResponse.json({
      reply: assistantText,
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
