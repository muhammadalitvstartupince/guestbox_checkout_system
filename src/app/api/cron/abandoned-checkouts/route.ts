import { NextResponse } from "next/server";
import { processAbandonedCheckouts } from "@/lib/abandoned-checkout/notify";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processAbandonedCheckouts();
  return NextResponse.json(result);
}
