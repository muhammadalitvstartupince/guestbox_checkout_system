"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export interface LoginFormState {
  status: "idle" | "error";
  message?: string;
}

// A syntactically-valid bcrypt hash of an unrelated password, compared
// against when no account matches — keeps failed-login timing consistent
// regardless of whether the email exists, instead of short-circuiting.
const DUMMY_HASH = "$2b$12$t0rbpruRYQF9vIE5usGSl.ur0fo0CNgrEwZLQ41mMMS3BQ.prDQRm";

export async function login(_prevState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email and password." };
  }

  const admin = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });
  const valid = await verifyPassword(parsed.data.password, admin?.passwordHash ?? DUMMY_HASH);

  if (!admin || !valid) {
    return { status: "error", message: "Invalid email or password." };
  }

  await createSession({ adminUserId: admin.id, email: admin.email, name: admin.name, role: admin.role });
  redirect("/admin");
}
