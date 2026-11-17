import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId } = body;
    if (!conversationId) return NextResponse.json({ ok: false }, { status: 400 });

    await prisma.chatConversation.updateMany({
      where: {
        id: conversationId,
        status: "active",
      },
      data: {
        status: "abandoned",
        outcome: "abandoned_with_info",
        abandonedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
