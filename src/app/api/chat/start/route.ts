import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { fireChatStartedWebhook } from "@/lib/chatbot/webhooks";

interface StartChatBody {
  checkoutPageId: string;
  sessionId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  skipLeadGate?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StartChatBody;
    const { checkoutPageId, sessionId, firstName, lastName, email, phone, skipLeadGate } = body;

    if (!checkoutPageId || !sessionId) {
      return NextResponse.json({ error: "checkoutPageId and sessionId are required" }, { status: 400 });
    }

    if (!skipLeadGate && (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !phone?.trim())) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const conversation = await prisma.chatConversation.create({
      data: {
        checkoutPageId,
        sessionId,
        firstName: firstName?.trim() ?? "Guest",
        lastName: lastName?.trim() ?? "",
        email: email?.trim() ?? "",
        phone: phone?.trim() ?? "",
        status: "active",
      },
    });

    const name = firstName?.trim() || "there";
    // Save the initial greeting as an assistant message
    const greeting = `Hey ${name}! 👋 How can I help you today? I can answer questions about GuestBox or help you with your order.`;
    await prisma.chatMessage.create({
      data: { conversationId: conversation.id, role: "assistant", content: greeting },
    });

    // Fire webhook (non-blocking)
    fireChatStartedWebhook({
      id: conversation.id,
      firstName: conversation.firstName,
      lastName: conversation.lastName,
      email: conversation.email,
      phone: conversation.phone,
    }).catch(() => {});

    return NextResponse.json({ conversationId: conversation.id, greeting });
  } catch (err) {
    console.error("Chat start error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
