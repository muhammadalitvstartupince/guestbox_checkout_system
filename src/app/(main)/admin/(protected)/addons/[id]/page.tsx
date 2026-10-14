import { notFound } from "next/navigation";
import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { AddonForm, type AddonFormDefaults } from "@/components/admin/AddonForm";
import { updateAddon } from "../actions";

export default async function EditAddonPage({ params }: { params: Promise<{ id: string }> }) {
  await verifySession();
  const { id } = await params;

  const addon = await prisma.addon.findUnique({
    where: { id },
    include: { checkoutPageLinks: { include: { checkoutPage: { select: { id: true, title: true } } } } },
  });

  if (!addon) notFound();

  const defaults: AddonFormDefaults = {
    name: addon.name,
    description: addon.description ?? "",
    imageUrl: addon.imageUrl ?? "",
    price: (addon.priceCents / 100).toFixed(2),
    originalPrice: addon.originalPriceCents != null ? (addon.originalPriceCents / 100).toFixed(2) : "",
    zohoItemId: addon.zohoItemId ?? "",
  };

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-100">{addon.name}</h1>
        <AddonForm action={updateAddon.bind(null, addon.id)} defaults={defaults} submitLabel="Save Changes" />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Used On</h2>
        {addon.checkoutPageLinks.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Not attached to any checkout page yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {addon.checkoutPageLinks.map((link) => (
              <li key={link.id}>
                <Link
                  href={`/admin/checkout-pages/${link.checkoutPage.id}`}
                  className="text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {link.checkoutPage.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
