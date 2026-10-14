import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { CopyLinkButton } from "@/components/admin/CopyLinkButton";
import { deleteCheckoutPage, duplicateCheckoutPage } from "./actions";

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_STYLES: Record<string, string> = {
  live: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20",
  draft: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20",
  archived: "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-600/40",
};

const FILTERS = [
  { label: "Active", value: "" },
  { label: "Live", value: "live" },
  { label: "Draft", value: "draft" },
  { label: "Archived", value: "archived" },
  { label: "All", value: "all" },
] as const;

export default async function AdminCheckoutPagesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await verifySession();
  const { status: filter } = await searchParams;

  const where =
    filter === "all" ? {} :
    filter === "live" || filter === "draft" || filter === "archived" ? { status: filter as "live" | "draft" | "archived" } :
    { status: { not: "archived" as const } };

  const pages = await prisma.checkoutPage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { orders: { where: { status: "paid" } }, addonLinks: true } } },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800">
          {FILTERS.map((f) => {
            const active = (filter ?? "") === f.value;
            return (
              <Link
                key={f.value}
                href={f.value ? `?status=${f.value}` : "/admin/checkout-pages"}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
        <Link
          href="/admin/checkout-pages/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          + New Checkout Page
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-xs tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-5 py-3 font-medium">Title</th>
              <th className="px-5 py-3 font-medium">Slug</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Price</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Orders</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr
                key={page.id}
                className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/50"
              >
                <td className="px-5 py-3 font-medium text-zinc-900 dark:text-zinc-100">{page.title}</td>
                <td className="px-5 py-3 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="inline-flex items-center gap-1.5">
                    /c/{page.slug}
                    <CopyLinkButton path={`/c/${page.slug}`} />
                  </span>
                </td>
                <td className="px-5 py-3 text-zinc-600 capitalize dark:text-zinc-400">{page.type}</td>
                <td className="px-5 py-3 text-zinc-900 dark:text-zinc-100">{formatCents(page.basePriceCents)}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[page.status] ?? ""}`}
                  >
                    {page.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">{page._count.orders}</td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  <Link
                    href={`/admin/checkout-pages/${page.id}`}
                    className="mr-3 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    Edit
                  </Link>
                  <form action={duplicateCheckoutPage.bind(null, page.id)} className="mr-3 inline">
                    <button type="submit" className="font-medium text-zinc-600 hover:underline dark:text-zinc-400">
                      Duplicate
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-zinc-400 dark:text-zinc-500">
                  No checkout pages yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
