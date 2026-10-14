"use client";

import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/app/(main)/admin/actions";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

const TITLES: { prefix: string; title: string }[] = [
  { prefix: "/admin/orders", title: "Orders" },
  { prefix: "/admin/checkout-pages", title: "Checkout Pages" },
  { prefix: "/admin/addons", title: "Add-ons" },
  { prefix: "/admin/promo-codes", title: "Promo Codes" },
  { prefix: "/admin/settings/email", title: "Email Settings" },
  { prefix: "/admin/admin-users", title: "Admin Users" },
  { prefix: "/admin", title: "Dashboard" },
];

function titleFor(pathname: string): string {
  return TITLES.find((t) => pathname.startsWith(t.prefix))?.title ?? "Admin";
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function AdminTopbar({ name, email }: { name: string; email: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-zinc-200 bg-white/80 px-6 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{titleFor(pathname)}</h1>

      <div className="flex items-center gap-4">
        <ThemeToggle />
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
            {initialsFor(name || email)}
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{name}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{email}</p>
          </div>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
