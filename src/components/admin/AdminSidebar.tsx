"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, ShoppingBag, LayoutTemplate, Puzzle, Tag, Zap, Mail, Users } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  // Editors can only manage checkout pages and add-ons — everything else
  // (orders/card data, promo codes, settings, admin users) is admin-only.
  adminOnly?: boolean;
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [
      {
        href: "/admin",
        label: "Dashboard",
        icon: LayoutDashboard,
        iconBg: "bg-indigo-50 dark:bg-indigo-500/10",
        iconColor: "text-indigo-600 dark:text-indigo-400",
      },
    ],
  },
  {
    title: "Manage",
    items: [
      {
        href: "/admin/orders",
        label: "Orders",
        icon: ShoppingBag,
        iconBg: "bg-blue-50 dark:bg-blue-500/10",
        iconColor: "text-blue-600 dark:text-blue-400",
        adminOnly: true,
      },
      {
        href: "/admin/checkout-pages",
        label: "Checkout Pages",
        icon: LayoutTemplate,
        iconBg: "bg-emerald-50 dark:bg-emerald-500/10",
        iconColor: "text-emerald-600 dark:text-emerald-400",
      },
      {
        href: "/admin/addons",
        label: "Add-ons",
        icon: Puzzle,
        iconBg: "bg-violet-50 dark:bg-violet-500/10",
        iconColor: "text-violet-600 dark:text-violet-400",
      },
      {
        href: "/admin/promo-codes",
        label: "Promo Codes",
        icon: Tag,
        iconBg: "bg-amber-50 dark:bg-amber-500/10",
        iconColor: "text-amber-600 dark:text-amber-400",
        adminOnly: true,
      },
      {
        href: "/admin/promotions",
        label: "Promotions",
        icon: Zap,
        iconBg: "bg-orange-50 dark:bg-orange-500/10",
        iconColor: "text-orange-600 dark:text-orange-400",
        adminOnly: true,
      },
    ],
  },
  {
    title: "Settings",
    items: [
      {
        href: "/admin/settings/email",
        label: "Email Settings",
        icon: Mail,
        iconBg: "bg-pink-50 dark:bg-pink-500/10",
        iconColor: "text-pink-600 dark:text-pink-400",
        adminOnly: true,
      },
      {
        href: "/admin/admin-users",
        label: "Admin Users",
        icon: Users,
        iconBg: "bg-cyan-50 dark:bg-cyan-500/10",
        iconColor: "text-cyan-600 dark:text-cyan-400",
        adminOnly: true,
      },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const isAdmin = role === "admin";

  return (
    <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-white md:flex md:flex-col dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex h-16 items-center gap-2 border-b border-zinc-200 px-6 dark:border-zinc-800">
        <Image
          src="/pages_Images/GuestBox-Logo-5v2.png"
          alt="GuestBox"
          width={140}
          height={40}
          className="h-8 w-auto"
        />
        <span className="sr-only">GuestBox</span>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
        {NAV_SECTIONS.map((section) => {
          const items = isAdmin ? section.items : section.items.filter((item) => !item.adminOnly);
          if (items.length === 0) return null;
          return (
          <div key={section.title}>
            <p className="mb-2 px-2 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
              {section.title}
            </p>
            <div className="space-y-1">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400"
                        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    }`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.iconBg}`}>
                      <Icon className={`h-4 w-4 ${item.iconColor}`} strokeWidth={2} />
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          );
        })}
      </nav>
    </aside>
  );
}
