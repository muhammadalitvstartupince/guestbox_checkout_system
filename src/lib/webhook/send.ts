/**
 * Optional per-checkout-page marketing webhook (mirrors the legacy
 * sendDataToWebhook() in __docs/webhook_functions.php). Off unless the
 * admin sets checkout_pages.webhook_url. Best-effort — a failure here must
 * never affect the checkout result, since the card has already been
 * charged by the time this runs.
 */

export interface SendOrderWebhookResult {
  success: boolean;
  error?: string;
  responseBody?: unknown;
  statusCode?: number;
}

export async function sendOrderWebhook(url: string, data: Record<string, unknown>): Promise<SendOrderWebhookResult> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(10_000),
    });
    let responseBody: unknown;
    try { responseBody = await response.json(); } catch { try { responseBody = await response.text(); } catch { /* empty */ } }
    if (!response.ok) {
      return { success: false, error: `Webhook responded with HTTP ${response.status}`, responseBody, statusCode: response.status };
    }
    return { success: true, responseBody, statusCode: response.status };
  } catch (err) {
    return {
      success: false,
      error: `Webhook request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
