import { afterEach, describe, expect, it, vi } from "vitest";
import { sendOrderWebhook } from "./send";

describe("sendOrderWebhook", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the payload as JSON and reports success on a 2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendOrderWebhook("https://example.com/hook", { orderId: "abc" });

    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/hook",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "abc" }),
      }),
    );
  });

  it("reports failure on a non-2xx response without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const result = await sendOrderWebhook("https://example.com/hook", {});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/500/);
  });

  it("reports failure when the request throws, without propagating", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const result = await sendOrderWebhook("https://example.com/hook", {});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ECONNREFUSED/);
  });
});
