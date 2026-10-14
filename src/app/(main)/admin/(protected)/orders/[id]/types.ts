export interface RevealCardState {
  status: "idle" | "error" | "revealed";
  message?: string;
  cardNumber?: string;
  cvv?: string;
  expiry?: string;
}

export const initialRevealCardState: RevealCardState = { status: "idle" };
