"use server";

import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/client";
import { getClientIp } from "@/lib/http/client-info";
import { verifyAdminSession } from "@/lib/auth/dal";
import { decryptCardField } from "@/lib/crypto/card-crypto";
import type { RevealCardState } from "@/app/(main)/admin/(protected)/orders/[id]/types";

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function revealInvoiceCard(
  invoiceId: string,
  _prevState: RevealCardState,
  formData: FormData,
): Promise<RevealCardState> {
  const session = await verifyAdminSession();
  const enteredKey = formData.get("hashKey")?.toString().trim() ?? "";

  if (!enteredKey) {
    return { status: "error", message: "Enter the reveal key." };
  }

  const revealKey = process.env.CARD_REVEAL_KEY;
  if (!revealKey) {
    return { status: "error", message: "CARD_REVEAL_KEY is not configured on the server." };
  }
  if (!safeCompare(revealKey, enteredKey)) {
    return { status: "error", message: "Invalid reveal key." };
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    return { status: "error", message: "Invoice not found." };
  }
  if (!invoice.cardNumberEncrypted || !invoice.cardCvvEncrypted) {
    return { status: "error", message: "No card on file for this invoice." };
  }

  let cardNumber: string;
  let cvv: string;
  let expiry: string | undefined;
  try {
    cardNumber = decryptCardField(invoice.cardNumberEncrypted);
    cvv = decryptCardField(invoice.cardCvvEncrypted);
    expiry = invoice.cardExpiryEncrypted ? decryptCardField(invoice.cardExpiryEncrypted) : undefined;
  } catch {
    return { status: "error", message: "Failed to decrypt card data." };
  }

  const ipAddress = getClientIp(await headers());

  await prisma.cardAccessAuditLog.create({
    data: {
      invoiceId: invoice.id,
      adminUserId: session.adminUserId as string,
      ipAddress,
    },
  });

  return { status: "revealed", cardNumber, cvv, expiry };
}
