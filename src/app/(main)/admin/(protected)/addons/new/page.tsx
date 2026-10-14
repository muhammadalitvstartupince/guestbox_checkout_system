import { verifySession } from "@/lib/auth/dal";
import { AddonForm, emptyAddonDefaults } from "@/components/admin/AddonForm";
import { createAddon } from "../actions";

export default async function NewAddonPage() {
  await verifySession();

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-100">New Add-on</h1>
      <AddonForm action={createAddon} defaults={emptyAddonDefaults} submitLabel="Create Add-on" />
    </div>
  );
}
