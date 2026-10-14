"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { verifyAdminSession } from "@/lib/auth/dal";
import { hashPassword } from "@/lib/auth/password";
import type { AdminUserFormState } from "./types";

const adminUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "editor"]),
});

export async function createAdminUser(
  _prevState: AdminUserFormState,
  formData: FormData,
): Promise<AdminUserFormState> {
  await verifyAdminSession();

  const parsed = adminUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const existing = await prisma.adminUser.findUnique({ where: { email: data.email } });
  if (existing) {
    return { status: "error", message: "That email is already in use.", fieldErrors: { email: ["Already in use"] } };
  }

  const passwordHash = await hashPassword(data.password);
  await prisma.adminUser.create({
    data: { name: data.name, email: data.email, passwordHash, role: data.role },
  });

  return { status: "idle", message: `Admin user ${data.email} created.` };
}

const changePasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function changeAdminPassword(
  adminUserId: string,
  _prevState: AdminUserFormState,
  formData: FormData,
): Promise<AdminUserFormState> {
  await verifyAdminSession();

  const parsed = changePasswordSchema.safeParse({
    newPassword: formData.get("newPassword"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.flatten().fieldErrors.newPassword?.[0] ?? "Invalid input." };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.adminUser.update({ where: { id: adminUserId }, data: { passwordHash } });

  return { status: "idle", message: "Password updated." };
}

export async function deleteAdminUser(adminUserId: string): Promise<void> {
  const session = await verifyAdminSession();
  // Deleting your own account here would immediately invalidate the
  // session mid-request and lock the last admin out with no way back in.
  if (session.adminUserId === adminUserId) return;
  try {
    await prisma.adminUser.delete({ where: { id: adminUserId } });
  } catch {
    // Foreign key restrict: this admin created checkout pages or has card
    // access log entries and can't be hard-deleted.
  }
}
