import { NextResponse } from "next/server";
import { processAbandonedCheckouts } from "@/lib/abandoned-checkout/notify";

export async function GET(request: Request) {
  // Vercel Cron sends CRON_SECRET via Authorization header automatically
  // when the env var is set. Also accept manual Bearer token for external cron.
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // No CRON_SECRET set in production — reject to prevent open access
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const result = await processAbandonedCheckouts();
  return NextResponse.json(result);
}
