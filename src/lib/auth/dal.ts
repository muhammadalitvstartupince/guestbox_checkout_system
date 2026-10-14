import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session?.adminUserId) {
    redirect("/admin/login");
  }
  return session;
});

// Editors can create/edit checkout pages and add-ons, but everything else
// (orders/card data, promo codes, settings, admin user management) is
// admin-only. Routes and actions gating on role should call this instead
// of verifySession() directly.
export const verifyAdminSession = cache(async () => {
  const session = await verifySession();
  if (session.role !== "admin") {
    redirect("/admin");
  }
  return session;
});
