import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function StatCard({
  label,
  value,
  changePct,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  changePct: number | null;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={2} />
        </div>
      </div>
      <ChangeIndicator changePct={changePct} />
    </div>
  );
}

function ChangeIndicator({ changePct }: { changePct: number | null }) {
  if (changePct === null) {
    return <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">No orders in the prior week</p>;
  }
  const isUp = changePct >= 0;
  return (
    <p className="mt-3 flex items-center gap-1 text-xs">
      <span
        className={`flex items-center gap-0.5 font-medium ${
          isUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        }`}
      >
        {isUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
        {Math.abs(changePct).toFixed(1)}%
      </span>
      <span className="text-zinc-400 dark:text-zinc-500">vs. last week</span>
    </p>
  );
}
