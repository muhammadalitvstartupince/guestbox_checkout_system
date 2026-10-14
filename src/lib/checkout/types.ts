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

export interface BillingInfoState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const initialBillingInfoState: BillingInfoState = { status: "idle" };
