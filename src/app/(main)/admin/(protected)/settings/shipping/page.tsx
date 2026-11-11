import { verifyAdminSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { ShippingSettingsForm } from "@/components/admin/ShippingSettingsForm";

export default async function ShippingSettingsPage() {
  await verifyAdminSession();

  const settings = await prisma.shippingSettings.findFirst({
    include: {
      packageTiers: { orderBy: { sortOrder: "asc" } },
      weightEntries: { orderBy: { qty: "asc" } },
    },
  });

  return (
    <div className="max-w-4xl space-y-6">
      <ShippingSettingsForm
        warehouse={{
          warehouseName: settings?.warehouseName ?? "",
          warehouseStreet: settings?.warehouseStreet ?? "",
          warehouseCity: settings?.warehouseCity ?? "",
          warehouseState: settings?.warehouseState ?? "",
          warehouseZip: settings?.warehouseZip ?? "",
          warehouseCountry: settings?.warehouseCountry ?? "US",
          warehousePhone: settings?.warehousePhone ?? "",
          maxDevicesPerBox: settings?.maxDevicesPerBox ?? 20,
        }}
        packageTiers={(settings?.packageTiers ?? []).map((t) => ({
          minQty: t.minQty,
          maxQty: t.maxQty,
          label: t.label,
          lengthIn: Number(t.lengthIn),
          widthIn: Number(t.widthIn),
          heightIn: Number(t.heightIn),
          maxWeightLb: Number(t.maxWeightLb),
        }))}
        weightEntries={(settings?.weightEntries ?? []).map((w) => ({
          qty: w.qty,
          weightLb: Number(w.weightLb),
        }))}
      />
    </div>
  );
}
