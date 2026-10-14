import { prisma } from "@/lib/db/client";

export interface MonthlyPoint {
  label: string;
  revenueCents: number;
  orderCount: number;
}

export interface RecentOrderRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  amountCents: number | null;
  status: string;
  createdAt: Date;
  checkoutPageTitle: string;
}

export interface DashboardStats {
  totalRevenueCents: number;
  revenueChangePct: number | null;
  totalOrders: number;
  ordersChangePct: number | null;
  totalCustomers: number;
  customersChangePct: number | null;
  monthly: MonthlyPoint[];
  recentOrders: RecentOrderRow[];
}

/** null means "no prior-period activity to compare against" (shown as "New" rather than a misleading 0%/∞% swing). */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [
    totalRevenue,
    totalOrders,
    currentWeekRevenue,
    previousWeekRevenue,
    currentWeekOrders,
    previousWeekOrders,
    currentWeekCustomers,
    previousWeekCustomers,
    allTimeCustomers,
    monthlyOrders,
    recentOrders,
  ] = await Promise.all([
    prisma.order.aggregate({ where: { status: "paid" }, _sum: { amountCents: true } }),
    prisma.order.count({ where: { status: "paid" } }),
    prisma.order.aggregate({
      where: { status: "paid", createdAt: { gte: oneWeekAgo } },
      _sum: { amountCents: true },
    }),
    prisma.order.aggregate({
      where: { status: "paid", createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo } },
      _sum: { amountCents: true },
    }),
    prisma.order.count({ where: { status: "paid", createdAt: { gte: oneWeekAgo } } }),
    prisma.order.count({ where: { status: "paid", createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo } } }),
    prisma.order.groupBy({ by: ["email"], where: { status: "paid", createdAt: { gte: oneWeekAgo } } }),
    prisma.order.groupBy({ by: ["email"], where: { status: "paid", createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo } } }),
    prisma.order.groupBy({ by: ["email"], where: { status: "paid" } }),
    prisma.order.findMany({
      where: { createdAt: { gte: twelveMonthsAgo } },
      select: { amountCents: true, status: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { status: "paid" },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { checkoutPage: { select: { title: true } } },
    }),
  ]);

  // Bucket the last 12 months, oldest first, keyed by calendar month.
  const buckets = new Map<string, MonthlyPoint>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    buckets.set(key, { label: MONTH_LABELS[d.getMonth()], revenueCents: 0, orderCount: 0 });
  }
  for (const order of monthlyOrders) {
    if (order.status !== "paid") continue;
    const key = `${order.createdAt.getFullYear()}-${order.createdAt.getMonth()}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.orderCount += 1;
    bucket.revenueCents += order.amountCents ?? 0;
  }

  return {
    totalRevenueCents: totalRevenue._sum.amountCents ?? 0,
    revenueChangePct: pctChange(currentWeekRevenue._sum.amountCents ?? 0, previousWeekRevenue._sum.amountCents ?? 0),
    totalOrders,
    ordersChangePct: pctChange(currentWeekOrders, previousWeekOrders),
    totalCustomers: allTimeCustomers.length,
    customersChangePct: pctChange(currentWeekCustomers.length, previousWeekCustomers.length),
    monthly: Array.from(buckets.values()),
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      firstName: o.firstName,
      lastName: o.lastName,
      email: o.email,
      amountCents: o.amountCents,
      status: o.status,
      createdAt: o.createdAt,
      checkoutPageTitle: o.checkoutPage.title,
    })),
  };
}
