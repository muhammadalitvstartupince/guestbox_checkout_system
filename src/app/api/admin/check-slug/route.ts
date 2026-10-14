import { prisma } from "@/lib/db/client";
import { verifySession } from "@/lib/auth/dal";

export async function GET(request: Request) {
  await verifySession();
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const exclude = searchParams.get("exclude");

  if (!slug) return Response.json({ available: false });

  const existing = await prisma.checkoutPage.findUnique({ where: { slug } });
  const available = !existing || (!!exclude && existing.id === exclude);

  return Response.json({ available });
}
