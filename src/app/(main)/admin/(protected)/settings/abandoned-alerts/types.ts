export interface AbandonedAlertSettingsFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const initialAbandonedAlertSettingsFormState: AbandonedAlertSettingsFormState = { status: "idle" };

export interface TestSlackState {
  status: "idle" | "success" | "error";
  message?: string;
}

export const initialTestSlackState: TestSlackState = { status: "idle" };

export interface RunScanState {
  status: "idle" | "success" | "error";
  message?: string;
}

export const initialRunScanState: RunScanState = { status: "idle" };
