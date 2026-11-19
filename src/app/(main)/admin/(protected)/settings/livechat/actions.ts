"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { verifyAdminSession } from "@/lib/auth/dal";
import type { LiveChatFormState } from "./types";

export async function updateLiveChatSettings(
  _prevState: LiveChatFormState,
  formData: FormData,
): Promise<LiveChatFormState> {
  await verifyAdminSession();

  const enabled = formData.get("enabled") === "on";
  const existing = await prisma.liveChatSettings.findFirst();

  await prisma.liveChatSettings.upsert({
    where: { id: existing?.id ?? "00000000-0000-0000-0000-000000000000" },
    update: { enabled },
    create: { enabled },
  });

  revalidatePath("/admin/settings/livechat");
  revalidatePath("/c", "layout");
  return { status: "idle", message: `Live chat ${enabled ? "enabled" : "disabled"}.` };
}
