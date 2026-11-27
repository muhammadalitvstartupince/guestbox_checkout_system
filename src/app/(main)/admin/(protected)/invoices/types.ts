export interface InvoiceFormState {
  error?: string | null;
  fieldErrors?: Record<string, string>;
  invoiceId?: string;
  values?: Record<string, string>;
}
