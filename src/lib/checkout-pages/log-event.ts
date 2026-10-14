import { prisma } from "@/lib/db/client";

export type CheckoutPageAction =
  | "created"
  | "updated"
  | "duplicated"
  | "deleted"
  | "archived"
  | "addon_attached"
  | "addon_detached"
  | "addon_reordered";

export async function logCheckoutPageEvent(
  checkoutPageId: string,
  adminUserId: string | null,
  action: CheckoutPageAction,
  message?: string,
): Promise<void> {
  try {
    await prisma.checkoutPageLog.create({
      data: { checkoutPageId, adminUserId, action, message },
    });
  } catch (err) {
    console.error("Failed to log checkout page event", { checkoutPageId, action, err });
  }
}
