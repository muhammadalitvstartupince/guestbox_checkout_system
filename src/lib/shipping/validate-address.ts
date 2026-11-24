/**
 * Shippo Address Validation — thin wrapper around POST /addresses/ with validate: true.
 * Uses the same SHIPPO_API_TOKEN as get-rates.ts.
 */

export interface AddressInput {
  street1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  name?: string;
}

export interface AddressValidationResult {
  status: "valid" | "correctable" | "invalid";
  /** Corrected/standardized address (only when correctable or valid with corrections). */
  suggested?: {
    street1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  /** Human-readable validation messages from Shippo. */
  messages: string[];
}

interface ShippoValidationResponse {
  validation_results?: {
    is_valid: boolean;
    messages?: Array<{ text: string; code: string }>;
  };
  street1?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export async function validateAddress(input: AddressInput): Promise<AddressValidationResult> {
  const token = process.env.SHIPPO_API_TOKEN;
  if (!token) {
    // No token = skip validation, treat as valid
    return { status: "valid", messages: [] };
  }

  // Shippo address validation is only reliable for US addresses
  if (input.country.toUpperCase() !== "US") {
    return { status: "valid", messages: [] };
  }

  const res = await fetch("https://api.goshippo.com/addresses/", {
    method: "POST",
    headers: {
      Authorization: `ShippoToken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name || "Customer",
      street1: input.street1,
      city: input.city,
      state: input.state,
      zip: input.zip,
      country: input.country,
      validate: true,
    }),
  });

  if (!res.ok) {
    // API error — don't block the customer, just skip validation
    console.error("Shippo address validation error:", res.status, await res.text().catch(() => ""));
    return { status: "valid", messages: [] };
  }

  const data: ShippoValidationResponse = await res.json();
  const validation = data.validation_results;

  if (!validation) {
    // No validation results = Shippo couldn't validate (unsupported country, etc.)
    return { status: "valid", messages: [] };
  }

  const messages = (validation.messages ?? []).map((m) => m.text);

  if (validation.is_valid) {
    // Check if Shippo corrected anything
    const corrected = {
      street1: data.street1 ?? input.street1,
      city: data.city ?? input.city,
      state: data.state ?? input.state,
      zip: data.zip ?? input.zip,
      country: data.country ?? input.country,
    };

    const changed =
      corrected.street1.toLowerCase() !== input.street1.toLowerCase() ||
      corrected.city.toLowerCase() !== input.city.toLowerCase() ||
      corrected.state.toLowerCase() !== input.state.toLowerCase() ||
      corrected.zip.replace(/\s/g, "") !== input.zip.replace(/\s/g, "") ||
      corrected.country.toLowerCase() !== input.country.toLowerCase();

    if (changed) {
      return { status: "correctable", suggested: corrected, messages };
    }
    return { status: "valid", messages: [] };
  }

  // Invalid
  return {
    status: "invalid",
    messages: messages.length > 0 ? messages : ["This address could not be verified. Please check and try again."],
  };
}
