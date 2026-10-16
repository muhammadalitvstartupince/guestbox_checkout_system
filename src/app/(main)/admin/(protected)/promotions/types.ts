export interface PromotionFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const initialPromotionFormState: PromotionFormState = { status: "idle" };
