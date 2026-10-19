import { notFound } from "next/navigation";
import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { CheckoutPageForm, type CheckoutPageFormDefaults } from "@/components/admin/CheckoutPageForm";
import { updateCheckoutPage, attachAddonToPage, detachAddonFromPage, moveCheckoutPageAddon } from "../actions";
import { buildLegacyHeroHtml } from "@/lib/checkout/legacy-hero-html";

function centsToDollarsStr(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

export default async function EditCheckoutPagePage({ params }: { params: Promise<{ id: string }> }) {
  await verifySession();
  const { id } = await params;

  const [page, skins, allAddons, logs] = await Promise.all([
    prisma.checkoutPage.findUnique({
      where: { id },
      include: {
        addonLinks: { orderBy: { sortOrder: "asc" }, include: { addon: true } },
        skin: true,
        priceTiers: { orderBy: { sortOrder: "asc" } },
        billingPlans: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.skin.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.addon.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.checkoutPageLog.findMany({
      where: { checkoutPageId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { adminUser: { select: { name: true, email: true } } },
    }),
  ]);

  if (!page) notFound();

  const skinConfig = (page.skin.config ?? {}) as { colors?: { accent?: string } };
  const accentColor = skinConfig.colors?.accent ?? "#00b4d8";

  const defaults: CheckoutPageFormDefaults = {
    slug: page.slug,
    type: page.type,
    title: page.title,
    productName: page.productName ?? "",
    heroHtml: page.heroHtml ?? buildLegacyHeroHtml(page, accentColor),
    heroHtmlMobile: page.heroHtmlMobile ?? "",
    mockupImageUrl: page.mockupImageUrl ?? "",
    skinId: page.skinId,
    zohoItemId: page.zohoItemId ?? "",
    zohoRecurringItemId: page.zohoRecurringItemId ?? "",
    basePrice: centsToDollarsStr(page.basePriceCents),
    recurringPrice: centsToDollarsStr(page.recurringPriceCents),
    billingInterval: page.billingInterval,
    showPromoCode: page.showPromoCode,
    successRedirectUrl: page.successRedirectUrl,
    failRedirectUrl: page.failRedirectUrl,
    webhookUrl: page.webhookUrl ?? "",
    status: page.status,
    upgradeTitle: page.upgradeTitle ?? "",
    upgradeDescription: page.upgradeDescription ?? "",
    upgradePrice: centsToDollarsStr(page.upgradePriceCents),
    upgradeRecurringPrice: centsToDollarsStr(page.upgradeRecurringPriceCents),
    upgradeZohoItemId: page.upgradeZohoItemId ?? "",
    upgradeZohoRecurringItemId: page.upgradeZohoRecurringItemId ?? "",
    priceTiers: page.priceTiers.map((t) => ({
      minQty: String(t.minQty),
      maxQty: t.maxQty != null ? String(t.maxQty) : "",
      priceCents: centsToDollarsStr(t.priceCents),
      zohoItemId: t.zohoItemId ?? "",
      isBase: t.isBase,
    })),
    billingPlans: page.billingPlans.map((p) => ({
      interval: p.interval as "monthly" | "annually",
      label: p.label,
      priceCents: centsToDollarsStr(p.priceCents),
      zohoItemId: p.zohoItemId ?? "",
      chargeAtCheckout: p.chargeAtCheckout,
      isDefault: p.isDefault,
    })),
  };

  const boundUpdate = updateCheckoutPage.bind(null, page.id);
  const boundAttachAddon = attachAddonToPage.bind(null, page.id);

  const attachedAddonIds = new Set(page.addonLinks.map((l) => l.addonId));
  const availableToAttach = allAddons.filter((a) => !attachedAddonIds.has(a.id));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">{page.title}</h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">/c/{page.slug}</p>
        <CheckoutPageForm action={boundUpdate} defaults={defaults} skins={skins} submitLabel="Save Changes" checkoutPageId={page.id} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Add-ons</h2>
          <Link href="/admin/addons" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Manage all add-ons →
          </Link>
        </div>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Select which add-ons appear on this page and the order they show in. Available for both normal and sales
          pages.
        </p>

        <div className="mb-4 space-y-2">
          {page.addonLinks.map((link, index) => (
            <div
              key={link.id}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <form action={moveCheckoutPageAddon.bind(null, link.id, "up")}>
                    <button
                      type="submit"
                      disabled={index === 0}
                      className="block leading-none text-zinc-400 hover:text-zinc-900 disabled:opacity-30 dark:text-zinc-500 dark:hover:text-zinc-100"
                      aria-label="Move up"
                    >
                      ▲
                    </button>
                  </form>
                  <form action={moveCheckoutPageAddon.bind(null, link.id, "down")}>
                    <button
                      type="submit"
                      disabled={index === page.addonLinks.length - 1}
                      className="block leading-none text-zinc-400 hover:text-zinc-900 disabled:opacity-30 dark:text-zinc-500 dark:hover:text-zinc-100"
                      aria-label="Move down"
                    >
                      ▼
                    </button>
                  </form>
                </div>
                <div>
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {link.addon.name} — ${(link.addon.priceCents / 100).toFixed(2)}
                    {!link.addon.isActive && (
                      <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">(inactive)</span>
                    )}
                  </div>
                  {link.addon.description && (
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">{link.addon.description}</div>
                  )}
                </div>
              </div>
              <form action={detachAddonFromPage.bind(null, link.id)}>
                <button type="submit" className="text-sm text-red-600 hover:underline dark:text-red-400">
                  Remove
                </button>
              </form>
            </div>
          ))}
          {page.addonLinks.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No add-ons attached to this page yet.</p>
          )}
        </div>

        {availableToAttach.length > 0 ? (
          <form
            action={boundAttachAddon}
            className="flex items-end gap-2 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex-1">
              <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Attach an add-on</label>
              <select
                name="addonId"
                required
                className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {availableToAttach.map((addon) => (
                  <option key={addon.id} value={addon.id}>
                    {addon.name} — ${(addon.priceCents / 100).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700"
            >
              Attach
            </button>
          </form>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            All active add-ons are already attached.{" "}
            <Link href="/admin/addons/new" className="text-indigo-600 hover:underline dark:text-indigo-400">
              Create another one
            </Link>
            .
          </p>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-100">Activity Log</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No activity recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {log.adminUser?.name?.charAt(0).toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {log.adminUser?.name ?? "System"}
                    </span>
                    <span className="inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {log.action}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {log.createdAt.toLocaleString()}
                    </span>
                  </div>
                  {log.message && (
                    <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{log.message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
