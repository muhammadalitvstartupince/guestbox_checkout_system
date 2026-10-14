export interface CheckoutPageFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const initialCheckoutPageFormState: CheckoutPageFormState = { status: "idle" };
