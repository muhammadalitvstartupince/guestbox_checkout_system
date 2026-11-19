export interface LiveChatFormState {
  status: "idle" | "error";
  message?: string;
}

export const initialLiveChatFormState: LiveChatFormState = { status: "idle" };
