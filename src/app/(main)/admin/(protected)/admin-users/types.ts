export interface AdminUserFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const initialAdminUserFormState: AdminUserFormState = { status: "idle" };
