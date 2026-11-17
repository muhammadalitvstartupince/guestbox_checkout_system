/** Default Claude model — used when no override is saved in DB. */
export const DEFAULT_CHAT_MODEL = "claude-haiku-4-5-20251001";
export const DEFAULT_SUMMARIZER_MODEL = "claude-haiku-4-5-20251001";

/** All models available in the admin dropdown. */
export const AVAILABLE_MODELS = [
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (fastest, cheapest)" },
  { value: "claude-sonnet-4-6-20250514", label: "Claude Sonnet 4.6 (balanced)" },
  { value: "claude-opus-4-6-20250610", label: "Claude Opus 4.6 (most capable)" },
] as const;
