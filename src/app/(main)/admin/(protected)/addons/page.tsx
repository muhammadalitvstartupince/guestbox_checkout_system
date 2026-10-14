import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { toggleAddonActive, deleteAddon } from "./actions";

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function AdminAddonsPage() {
  await verifySession();

  const addons = await prisma.addon.findMany({
    orderBy: { createdAt: "desc" },
    include: { checkoutPageLinks: { include: { checkoutPage: { select: { title: true } } } } },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
          A shared pool of optional add-ons. Attach any of these to any checkout page — normal or sales — and control
          their display order from that page&rsquo;s editor.
        </p>
        <Link
          href="/admin/addons/new"
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          + New Add-on
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-xs tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Price</th>
              <th className="px-5 py-3 font-medium">Used On</th>
              <th className="px-5 py-3 font-medium">Active</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {addons.map((addon) => (
              <tr
                key={addon.id}
                className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/50"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    {addon.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- static local asset, admin-configured
                      <img src={addon.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded object-contain" />
                    )}
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">{addon.name}</div>
                      {addon.description && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">{addon.description.replace(/<[^>]+>/g, " ")}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-zinc-900 dark:text-zinc-100">
                  {addon.originalPriceCents != null && (
                    <span className="mr-1.5 text-xs text-zinc-400 line-through">{formatCents(addon.originalPriceCents)}</span>
                  )}
                  {formatCents(addon.priceCents)}
                </td>
                <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">
                  {addon.checkoutPageLinks.length
                    ? addon.checkoutPageLinks.map((l) => l.checkoutPage.title).join(", ")
                    : "—"}
                </td>
                <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">{addon.isActive ? "Yes" : "No"}</td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  <Link
                    href={`/admin/addons/${addon.id}`}
                    className="mr-3 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    Edit
                  </Link>
                  <form action={toggleAddonActive.bind(null, addon.id)} className="inline">
                    <button type="submit" className="mr-3 text-zinc-600 hover:underline dark:text-zinc-400">
                      {addon.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                  <form action={deleteAddon.bind(null, addon.id)} className="inline">
                    <button type="submit" className="text-red-600 hover:underline dark:text-red-400">
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {addons.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-zinc-400 dark:text-zinc-500">
                  No add-ons yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
