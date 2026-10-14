export interface AddonFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const initialAddonFormState: AddonFormState = { status: "idle" };
