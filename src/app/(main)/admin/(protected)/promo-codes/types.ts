export interface PromoCodeFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const initialPromoCodeFormState: PromoCodeFormState = { status: "idle" };
