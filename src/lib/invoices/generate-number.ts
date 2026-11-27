import { prisma } from "@/lib/db/client";

/**
 * Generates the next sequential invoice number (INV-0001, INV-0002, …).
 * Uses a DB query to find the current max, so concurrent calls within the
 * same transaction are safe (the unique constraint on invoice_number is the
 * ultimate guard).
 */
export async function generateInvoiceNumber(): Promise<string> {
  const last = await prisma.invoice.findFirst({
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let next = 1;
  if (last) {
    const match = last.invoiceNumber.match(/^INV-(\d+)$/);
    if (match) next = parseInt(match[1], 10) + 1;
  }

  return `INV-${String(next).padStart(4, "0")}`;
}
