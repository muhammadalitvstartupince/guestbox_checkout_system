/**
 * Authorize.net integration via their JSON REST API (no official Node SDK
 * exists — this is the officially documented approach for non-PHP/.NET/Java
 * stacks: https://developer.authorize.net/api/reference/).
 *
 * Mirrors the same authCaptureTransaction shape the legacy PHP SDK builds in
 * __docs/roku-apple-14thJulySale-2026-order-form.php (chargeCreditCard()).
 */

const SANDBOX_ENDPOINT = "https://apitest.authorize.net/xml/v1/request.api";
const PRODUCTION_ENDPOINT = "https://api.authorize.net/xml/v1/request.api";

export interface ChargeCreditCardInput {
  cardNumber: string;
  /** YYYY-MM */
  expirationDate: string;
  cardCode: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  email: string;
  amountCents: number;
  invoiceNumber: string;
  customerId?: string;
}

export interface ChargeCreditCardResult {
  success: boolean;
  responseCode?: string;
  authCode?: string;
  transactionId?: string;
  accountNumber?: string;
  accountType?: string;
  messageCode?: string;
  description?: string;
  errorCode?: string;
  errorMessage?: string;
}

interface AuthorizeNetConfig {
  apiLoginId: string;
  transactionKey: string;
  endpoint: string;
}

function getConfig(): AuthorizeNetConfig {
  const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
  const transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY;
  const environment = process.env.AUTHORIZE_NET_ENVIRONMENT ?? "sandbox";

  if (!apiLoginId || !transactionKey) {
    throw new Error(
      "AUTHORIZE_NET_API_LOGIN_ID and AUTHORIZE_NET_TRANSACTION_KEY must be set",
    );
  }
  if (environment !== "sandbox" && environment !== "production") {
    throw new Error('AUTHORIZE_NET_ENVIRONMENT must be "sandbox" or "production"');
  }

  return {
    apiLoginId,
    transactionKey,
    endpoint: environment === "production" ? PRODUCTION_ENDPOINT : SANDBOX_ENDPOINT,
  };
}

/** Integer-cents amount -> Authorize.net's required decimal string, without
 *  going through floating point. */
function centsToDecimalString(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}${dollars}.${remainder.toString().padStart(2, "0")}`;
}

export async function chargeCreditCard(
  input: ChargeCreditCardInput,
): Promise<ChargeCreditCardResult> {
  const config = getConfig();

  const requestBody = {
    createTransactionRequest: {
      merchantAuthentication: {
        name: config.apiLoginId,
        transactionKey: config.transactionKey,
      },
      refId: `ref${Date.now()}`,
      transactionRequest: {
        transactionType: "authCaptureTransaction",
        amount: centsToDecimalString(input.amountCents),
        payment: {
          creditCard: {
            cardNumber: input.cardNumber,
            expirationDate: input.expirationDate,
            cardCode: input.cardCode,
          },
        },
        order: {
          invoiceNumber: input.invoiceNumber,
          description: "GuestBox",
        },
        // Authorize.net's API is schema-validated (JSON gets transformed to
        // XML server-side), so element order within transactionRequest is
        // significant: customer must precede billTo.
        customer: {
          id: input.customerId,
          email: input.email,
        },
        billTo: {
          firstName: input.firstName,
          lastName: input.lastName,
          address: input.address,
          city: input.city,
          state: input.state,
          zip: input.zip,
          country: input.country,
        },
        transactionSettings: {
          setting: [{ settingName: "duplicateWindow", settingValue: "60" }],
        },
      },
    },
  };

  let rawText: string;
  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(20_000),
    });
    rawText = await response.text();
  } catch (err) {
    return {
      success: false,
      errorMessage: `Authorize.net request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let parsed: AuthorizeNetApiResponse;
  try {
    // Authorize.net's JSON API prefixes responses with a UTF-8 BOM.
    const BOM = String.fromCharCode(0xfeff);
    const withoutBom = rawText.startsWith(BOM) ? rawText.slice(BOM.length) : rawText;
    parsed = JSON.parse(withoutBom);
  } catch {
    return {
      success: false,
      errorMessage: `Authorize.net returned a non-JSON response: ${rawText.slice(0, 200)}`,
    };
  }

  return mapResponse(parsed);
}

interface AuthorizeNetMessage {
  code: string;
  description: string;
  text?: string;
}

interface AuthorizeNetError {
  errorCode: string;
  errorText: string;
}

interface AuthorizeNetApiResponse {
  transactionResponse?: {
    responseCode?: string;
    authCode?: string;
    transId?: string;
    accountNumber?: string;
    accountType?: string;
    messages?: AuthorizeNetMessage[];
    errors?: AuthorizeNetError[];
  };
  messages: {
    resultCode: "Ok" | "Error";
    message: AuthorizeNetMessage[];
  };
}

function mapResponse(response: AuthorizeNetApiResponse): ChargeCreditCardResult {
  const tresponse = response.transactionResponse;

  if (response.messages.resultCode === "Ok" && tresponse?.messages?.length) {
    return {
      success: true,
      responseCode: tresponse.responseCode,
      authCode: tresponse.authCode,
      transactionId: tresponse.transId,
      accountNumber: tresponse.accountNumber,
      accountType: tresponse.accountType,
      messageCode: tresponse.messages[0].code,
      description: tresponse.messages[0].description,
    };
  }

  if (tresponse?.errors?.length) {
    return {
      success: false,
      errorCode: tresponse.errors[0].errorCode,
      errorMessage: tresponse.errors[0].errorText,
    };
  }

  const topLevelMessage = response.messages.message[0];
  return {
    success: false,
    errorCode: topLevelMessage?.code,
    errorMessage: topLevelMessage?.text ?? topLevelMessage?.description ?? "Unknown Authorize.net error",
  };
}
