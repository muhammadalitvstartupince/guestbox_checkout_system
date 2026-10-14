export interface EmailSettingsFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const initialEmailSettingsFormState: EmailSettingsFormState = { status: "idle" };

export interface SendTestEmailState {
  status: "idle" | "success" | "error";
  message?: string;
}

export const initialSendTestEmailState: SendTestEmailState = { status: "idle" };
