// One-off utility to create (or reset the password of) a single admin user
// — deliberately separate from seed.ts, which also seeds demo checkout
// page/add-ons/promo code you don't want touching a real database.
//
// Usage: DATABASE_URL=... npx tsx prisma/create-admin.ts <email> <password>
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/lib/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error("Usage: tsx prisma/create-admin.ts <email> <password>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const passwordHash = await hashPassword(password);
  const admin = await prisma.adminUser.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash },
    create: { email: email.toLowerCase(), passwordHash, name: "Admin", role: "admin" },
  });
  console.log(`Admin user ready: ${admin.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
