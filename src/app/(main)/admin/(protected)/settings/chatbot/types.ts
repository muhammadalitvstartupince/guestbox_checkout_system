export interface ChatbotSettingsFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const initialChatbotSettingsFormState: ChatbotSettingsFormState = { status: "idle" };

export interface TestWebhookState {
  status: "idle" | "success" | "error";
  message?: string;
}

export const initialTestWebhookState: TestWebhookState = { status: "idle" };
