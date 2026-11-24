export interface CheckoutFormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** Where the "Continue" button / auto-redirect on the success screen should send the customer. */
  redirectUrl?: string;
}

export const initialCheckoutFormState: CheckoutFormState = { status: "idle" };

export interface InitiateOrderState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  orderId?: string;
}

export const initialInitiateOrderState: InitiateOrderState = { status: "idle" };

export interface SuggestedAddress {
  street1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface BillingInfoState {
  status: "idle" | "error" | "success" | "address_suggestion" | "address_invalid";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** True when shipping country is international (needs Shippo rate selection). */
  isInternational?: boolean;
  /** True when shipping settings are enabled (rates will be fetched for all addresses). */
  shippingEnabled?: boolean;
  /** Corrected address returned by Shippo when status is "address_suggestion". */
  suggestedAddress?: SuggestedAddress;
  /** Validation messages from Shippo when status is "address_invalid". */
  validationMessages?: string[];
}

export const initialBillingInfoState: BillingInfoState = { status: "idle" };
