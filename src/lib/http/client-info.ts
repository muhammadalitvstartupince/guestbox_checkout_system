import type { headers } from "next/headers";

type HeadersList = Awaited<ReturnType<typeof headers>>;

// Client-reported only — not verified, don't treat as authoritative for
// anything beyond support/fraud triage and audit trails.
export function getClientIp(headersList: HeadersList): string | null {
  return headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headersList.get("x-real-ip") ?? null;
}

export function getUserAgent(headersList: HeadersList): string | null {
  return headersList.get("user-agent") ?? null;
}
