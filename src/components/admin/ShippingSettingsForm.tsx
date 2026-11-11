"use client";

import { useActionState, useState } from "react";
import { updateShippingSettings, updatePackageTiers, updateWeightTable } from "@/app/(main)/admin/(protected)/settings/shipping/actions";
import { initialShippingSettingsFormState } from "@/app/(main)/admin/(protected)/settings/shipping/types";

const inputClass = "w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelClass = "mb-1 block text-xs text-zinc-500 dark:text-zinc-400";
const smallInputClass = "w-full rounded border border-zinc-300 px-1.5 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";

interface PackageTier {
  minQty: number;
  maxQty: number;
  label: string;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  maxWeightLb: number;
}

interface WeightEntry {
  qty: number;
  weightLb: number;
}

interface Props {
  warehouse: {
    warehouseName: string;
    warehouseStreet: string;
    warehouseCity: string;
    warehouseState: string;
    warehouseZip: string;
    warehouseCountry: string;
    warehousePhone: string;
    maxDevicesPerBox: number;
  };
  packageTiers: PackageTier[];
  weightEntries: WeightEntry[];
}

function StatusBanner({ state }: { state: { status: string; message?: string } }) {
  if (!state.message) return null;
  return (
    <div className={`rounded-lg border p-3 text-sm ${
      state.status === "error"
        ? "border-red-300 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
        : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
    }`}>
      {state.message}
    </div>
  );
}

function WarehouseCard({ warehouse }: { warehouse: Props["warehouse"] }) {
  const [state, formAction, pending] = useActionState(updateShippingSettings, initialShippingSettingsFormState);

  return (
    <form action={formAction} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Warehouse Address</h2>
      <StatusBanner state={state} />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelClass}>Name</label>
          <input name="warehouseName" defaultValue={warehouse.warehouseName} className={inputClass} />
        </div>
        <div className="col-span-2">
          <label className={labelClass}>Street</label>
          <input name="warehouseStreet" defaultValue={warehouse.warehouseStreet} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>City</label>
          <input name="warehouseCity" defaultValue={warehouse.warehouseCity} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>State</label>
          <input name="warehouseState" defaultValue={warehouse.warehouseState} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>ZIP</label>
          <input name="warehouseZip" defaultValue={warehouse.warehouseZip} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Country (2-letter)</label>
          <input name="warehouseCountry" defaultValue={warehouse.warehouseCountry} maxLength={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input name="warehousePhone" defaultValue={warehouse.warehousePhone} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Max devices per box</label>
          <input name="maxDevicesPerBox" type="number" defaultValue={warehouse.maxDevicesPerBox} className={inputClass} />
        </div>
      </div>
      <button type="submit" disabled={pending} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
        {pending ? "Saving…" : "Save Warehouse"}
      </button>
    </form>
  );
}

function PackageTiersCard({ tiers: initialTiers }: { tiers: PackageTier[] }) {
  const [state, formAction, pending] = useActionState(updatePackageTiers, initialShippingSettingsFormState);
  const [tiers, setTiers] = useState(initialTiers);

  function updateTier(i: number, field: keyof PackageTier, value: string) {
    setTiers((prev) => prev.map((t, j) => j === i ? { ...t, [field]: field === "label" ? value : Number(value) } : t));
  }
  function addTier() {
    const last = tiers[tiers.length - 1];
    setTiers((prev) => [...prev, { minQty: (last?.maxQty ?? 0) + 1, maxQty: (last?.maxQty ?? 0) + 5, label: "", lengthIn: 12, widthIn: 12, heightIn: 12, maxWeightLb: 10 }]);
  }
  function removeTier(i: number) {
    setTiers((prev) => prev.filter((_, j) => j !== i));
  }

  return (
    <form action={formAction} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Package Tiers</h2>
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">Dimensions in inches, max weight in lb. Qty range determines which box size to use.</p>
      <StatusBanner state={state} />
      <input type="hidden" name="tierCount" value={tiers.length} />

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-100 text-zinc-500 dark:border-zinc-800">
              <th className="px-1 py-1.5 text-left font-medium">Min Qty</th>
              <th className="px-1 py-1.5 text-left font-medium">Max Qty</th>
              <th className="px-1 py-1.5 text-left font-medium">Label</th>
              <th className="px-1 py-1.5 text-left font-medium">L (in)</th>
              <th className="px-1 py-1.5 text-left font-medium">W (in)</th>
              <th className="px-1 py-1.5 text-left font-medium">H (in)</th>
              <th className="px-1 py-1.5 text-left font-medium">Max Wt (lb)</th>
              <th className="px-1 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {tiers.map((t, i) => (
              <tr key={i} className="border-b border-zinc-50 dark:border-zinc-800/60">
                <td className="px-1 py-1"><input name={`tier_${i}_minQty`} type="number" value={t.minQty} onChange={(e) => updateTier(i, "minQty", e.target.value)} className={smallInputClass} /></td>
                <td className="px-1 py-1"><input name={`tier_${i}_maxQty`} type="number" value={t.maxQty} onChange={(e) => updateTier(i, "maxQty", e.target.value)} className={smallInputClass} /></td>
                <td className="px-1 py-1"><input name={`tier_${i}_label`} value={t.label} onChange={(e) => updateTier(i, "label", e.target.value)} className={smallInputClass} /></td>
                <td className="px-1 py-1"><input name={`tier_${i}_length`} type="number" step="0.1" value={t.lengthIn} onChange={(e) => updateTier(i, "lengthIn", e.target.value)} className={smallInputClass} /></td>
                <td className="px-1 py-1"><input name={`tier_${i}_width`} type="number" step="0.1" value={t.widthIn} onChange={(e) => updateTier(i, "widthIn", e.target.value)} className={smallInputClass} /></td>
                <td className="px-1 py-1"><input name={`tier_${i}_height`} type="number" step="0.1" value={t.heightIn} onChange={(e) => updateTier(i, "heightIn", e.target.value)} className={smallInputClass} /></td>
                <td className="px-1 py-1"><input name={`tier_${i}_maxWeight`} type="number" step="0.01" value={t.maxWeightLb} onChange={(e) => updateTier(i, "maxWeightLb", e.target.value)} className={smallInputClass} /></td>
                <td className="px-1 py-1">
                  <button type="button" onClick={() => removeTier(i)} className="text-red-500 hover:text-red-700">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={addTier} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
          + Add Tier
        </button>
        <button type="submit" disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save Tiers"}
        </button>
      </div>
    </form>
  );
}

function WeightTableCard({ entries: initialEntries }: { entries: WeightEntry[] }) {
  const [state, formAction, pending] = useActionState(updateWeightTable, initialShippingSettingsFormState);
  const [entries, setEntries] = useState(initialEntries);

  function updateEntry(i: number, field: keyof WeightEntry, value: string) {
    setEntries((prev) => prev.map((e, j) => j === i ? { ...e, [field]: Number(value) } : e));
  }
  function addEntry() {
    const lastQty = entries[entries.length - 1]?.qty ?? 0;
    setEntries((prev) => [...prev, { qty: lastQty + 1, weightLb: 0 }]);
  }
  function removeEntry(i: number) {
    setEntries((prev) => prev.filter((_, j) => j !== i));
  }

  return (
    <form action={formAction} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Weight Table (packed weight per device count)</h2>
      <StatusBanner state={state} />
      <input type="hidden" name="weightCount" value={entries.length} />

      <div className="mt-3 grid grid-cols-4 gap-x-4 gap-y-1 sm:grid-cols-5">
        {entries.map((e, i) => (
          <div key={i} className="flex items-center gap-1">
            <input name={`weight_${i}_qty`} type="number" value={e.qty} onChange={(v) => updateEntry(i, "qty", v.target.value)} className={`${smallInputClass} w-12`} />
            <span className="text-xs text-zinc-400">→</span>
            <input name={`weight_${i}_weight`} type="number" step="0.1" value={e.weightLb} onChange={(v) => updateEntry(i, "weightLb", v.target.value)} className={`${smallInputClass} w-16`} />
            <span className="text-xs text-zinc-400">lb</span>
            <button type="button" onClick={() => removeEntry(i)} className="text-xs text-red-400 hover:text-red-600">×</button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={addEntry} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
          + Add Entry
        </button>
        <button type="submit" disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save Weights"}
        </button>
      </div>
    </form>
  );
}

export function ShippingSettingsForm({ warehouse, packageTiers, weightEntries }: Props) {
  return (
    <div className="space-y-6">
      <WarehouseCard warehouse={warehouse} />
      <PackageTiersCard tiers={packageTiers} />
      <WeightTableCard entries={weightEntries} />
    </div>
  );
}
