"use client";

import { useState } from "react";
import type { MonthlyPoint } from "@/lib/admin/dashboard-stats";

const RANGE_OPTIONS = [
  { key: "3M", months: 3 },
  { key: "6M", months: 6 },
  { key: "1Y", months: 12 },
] as const;

type RangeKey = (typeof RANGE_OPTIONS)[number]["key"];

export function RevenueChart({ data }: { data: MonthlyPoint[] }) {
  const [range, setRange] = useState<RangeKey>("1Y");
  const months = RANGE_OPTIONS.find((r) => r.key === range)!.months;
  const visible = data.slice(-months);

  const maxRevenue = Math.max(1, ...visible.map((d) => d.revenueCents));
  const maxOrders = Math.max(1, ...visible.map((d) => d.orderCount));

  const width = 800;
  const height = 260;
  const paddingLeft = 12;
  const paddingRight = 16;
  const paddingTop = 12;
  const paddingBottom = 28;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const barSlot = chartWidth / Math.max(visible.length, 1);
  const barWidth = Math.min(28, barSlot * 0.5);

  const linePoints = visible.map((d, i) => ({
    x: paddingLeft + barSlot * i + barSlot / 2,
    y: paddingTop + chartHeight - (d.orderCount / maxOrders) * chartHeight,
  }));
  const linePath = linePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  const totalRevenue = visible.reduce((sum, d) => sum + d.revenueCents, 0);
  const totalOrders = visible.reduce((sum, d) => sum + d.orderCount, 0);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Revenue</h2>
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setRange(opt.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                range === opt.key
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {opt.key}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-8 border-b border-zinc-100 pb-4 dark:border-zinc-800">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Orders</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{totalOrders.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Earnings</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            ${(totalRevenue / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-400 dark:text-zinc-500">No order activity yet.</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 w-full" preserveAspectRatio="xMidYMid meet">
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const y = paddingTop + chartHeight * (1 - t);
              return (
                <line
                  key={t}
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  strokeWidth={1}
                  className="stroke-zinc-100 dark:stroke-zinc-800"
                />
              );
            })}

            {visible.map((d, i) => {
              const x = paddingLeft + barSlot * i + (barSlot - barWidth) / 2;
              const barHeight = maxRevenue > 0 ? (d.revenueCents / maxRevenue) * chartHeight : 0;
              const y = paddingTop + chartHeight - barHeight;
              return (
                <g key={`${d.label}-${i}`}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(barHeight, 1)}
                    rx={4}
                    className="fill-indigo-500 dark:fill-indigo-400"
                    opacity={0.85}
                  >
                    <title>{`${d.label}: $${(d.revenueCents / 100).toFixed(2)}`}</title>
                  </rect>
                  <text
                    x={x + barWidth / 2}
                    y={height - 8}
                    textAnchor="middle"
                    fontSize={11}
                    className="fill-zinc-500 dark:fill-zinc-400"
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}

            <path
              d={linePath}
              fill="none"
              strokeWidth={2}
              strokeDasharray="4 3"
              className="stroke-purple-500 dark:stroke-purple-400"
            />
            {linePoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={3} className="fill-purple-500 dark:fill-purple-400">
                <title>{`${visible[i].label}: ${visible[i].orderCount} orders`}</title>
              </circle>
            ))}
          </svg>

          <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500 dark:bg-indigo-400" /> Revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-purple-500 dark:bg-purple-400" /> Orders
            </span>
          </div>
        </>
      )}
    </div>
  );
}
