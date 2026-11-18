import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function POST(req: NextRequest) {
  try {
    const { conversationId, messages } = (await req.json()) as {
      conversationId: string;
      messages: { role: "user" | "assistant"; content: string }[];
    };

    if (!conversationId || !messages?.length) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    await prisma.chatMessage.createMany({
      data: messages.map((m) => ({
        conversationId,
        role: m.role,
        content: m.content,
      })),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Chat log error:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
