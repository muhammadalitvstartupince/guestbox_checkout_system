export interface ShippingSettingsFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const initialShippingSettingsFormState: ShippingSettingsFormState = { status: "idle" };
