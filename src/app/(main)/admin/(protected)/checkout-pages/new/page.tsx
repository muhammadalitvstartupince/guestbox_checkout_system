import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { CheckoutPageForm, emptyCheckoutPageDefaults } from "@/components/admin/CheckoutPageForm";
import { createCheckoutPage } from "../actions";

export default async function NewCheckoutPagePage() {
  await verifySession();
  const [skins, addons] = await Promise.all([
    prisma.skin.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.addon.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, priceCents: true } }),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-100">New Checkout Page</h1>
      <CheckoutPageForm
        action={createCheckoutPage}
        defaults={{ ...emptyCheckoutPageDefaults, skinId: skins[0]?.id ?? "" }}
        skins={skins}
        availableAddons={addons}
        submitLabel="Create Checkout Page"
      />
    </div>
  );
}
