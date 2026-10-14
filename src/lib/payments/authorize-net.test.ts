import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chargeCreditCard } from "./authorize-net";

const baseInput = {
  cardNumber: "4111111111111111",
  expirationDate: "2030-12",
  cardCode: "900",
  firstName: "Ben",
  lastName: "Fisher",
  address: "3787 Private Road 2556",
  city: "Clyde",
  state: "Texas",
  zip: "46282",
  country: "USA",
  email: "ben@example.com",
  amountCents: 129900,
  invoiceNumber: "inv-1",
};

function jsonResponse(body: unknown, bom = false) {
  const text = (bom ? String.fromCharCode(0xfeff) : "") + JSON.stringify(body);
  return { text: async () => text } as Response;
}

describe("chargeCreditCard", () => {
  beforeEach(() => {
    process.env.AUTHORIZE_NET_API_LOGIN_ID = "test-login";
    process.env.AUTHORIZE_NET_TRANSACTION_KEY = "test-key";
    process.env.AUTHORIZE_NET_ENVIRONMENT = "sandbox";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.AUTHORIZE_NET_API_LOGIN_ID;
    delete process.env.AUTHORIZE_NET_TRANSACTION_KEY;
    delete process.env.AUTHORIZE_NET_ENVIRONMENT;
  });

  it("maps a successful transaction", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        transactionResponse: {
          responseCode: "1",
          authCode: "ABC123",
          transId: "40000000001",
          accountNumber: "XXXX1111",
          accountType: "Visa",
          messages: [{ code: "1", description: "This transaction has been approved." }],
        },
        messages: { resultCode: "Ok", message: [{ code: "I00001", text: "Successful." }] },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await chargeCreditCard(baseInput);

    expect(result).toEqual({
      success: true,
      responseCode: "1",
      authCode: "ABC123",
      transactionId: "40000000001",
      accountNumber: "XXXX1111",
      accountType: "Visa",
      messageCode: "1",
      description: "This transaction has been approved.",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://apitest.authorize.net/xml/v1/request.api",
      expect.objectContaining({ method: "POST" }),
    );
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.createTransactionRequest.transactionRequest.amount).toBe("1299.00");
  });

  it("orders transactionRequest fields per Authorize.net's schema (customer before billTo)", async () => {
    // Authorize.net's JSON API is transformed to XML server-side and is
    // schema-validated: sending `customer` after `billTo` fails with
    // E00003 ("invalid child element 'customer'"), confirmed against the
    // live sandbox. Guard the field order so this doesn't regress silently.
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        transactionResponse: { messages: [{ code: "1", description: "Approved." }] },
        messages: { resultCode: "Ok", message: [] },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await chargeCreditCard(baseInput);

    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const keys = Object.keys(sentBody.createTransactionRequest.transactionRequest);
    expect(keys.indexOf("customer")).toBeLessThan(keys.indexOf("billTo"));
    expect(keys.indexOf("order")).toBeLessThan(keys.indexOf("customer"));
    expect(keys.indexOf("billTo")).toBeLessThan(keys.indexOf("transactionSettings"));
  });

  it("strips a leading UTF-8 BOM before parsing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          transactionResponse: {
            responseCode: "1",
            authCode: "ABC123",
            transId: "1",
            messages: [{ code: "1", description: "Approved." }],
          },
          messages: { resultCode: "Ok", message: [] },
        },
        true,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await chargeCreditCard(baseInput);
    expect(result.success).toBe(true);
  });

  it("maps a declined transaction", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        transactionResponse: {
          errors: [{ errorCode: "2", errorText: "This transaction has been declined." }],
        },
        messages: { resultCode: "Error", message: [{ code: "E00027", text: "Declined." }] },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await chargeCreditCard(baseInput);
    expect(result).toEqual({
      success: false,
      errorCode: "2",
      errorMessage: "This transaction has been declined.",
    });
  });

  it("maps a top-level error when there is no transactionResponse", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        messages: { resultCode: "Error", message: [{ code: "E00003", text: "Invalid XML." }] },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await chargeCreditCard(baseInput);
    expect(result).toEqual({
      success: false,
      errorCode: "E00003",
      errorMessage: "Invalid XML.",
    });
  });

  it("returns a failure result when the network request throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );

    const result = await chargeCreditCard(baseInput);
    expect(result.success).toBe(false);
    expect(result.errorMessage).toMatch(/ECONNREFUSED/);
  });

  it("returns a failure result when the response is not valid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ text: async () => "<html>not json</html>" }));

    const result = await chargeCreditCard(baseInput);
    expect(result.success).toBe(false);
    expect(result.errorMessage).toMatch(/non-JSON/);
  });

  it("hits the production endpoint when configured", async () => {
    process.env.AUTHORIZE_NET_ENVIRONMENT = "production";
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        transactionResponse: { messages: [{ code: "1", description: "Approved." }] },
        messages: { resultCode: "Ok", message: [] },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await chargeCreditCard(baseInput);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.authorize.net/xml/v1/request.api",
      expect.anything(),
    );
  });

  it("throws synchronously when credentials are missing", async () => {
    delete process.env.AUTHORIZE_NET_API_LOGIN_ID;
    await expect(chargeCreditCard(baseInput)).rejects.toThrow(/AUTHORIZE_NET_API_LOGIN_ID/);
  });
});
