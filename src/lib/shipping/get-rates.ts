import { prisma } from "@/lib/db/client";

export interface ShippingRate {
  objectId: string;
  carrier: string;
  service: string;
  amountCents: number;
  currency: string;
  estimatedDays: number | null;
  attributes: string[];
  carrierLogo: string | null;
}

export interface ShippoToAddress {
  name?: string;
  street1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
}

interface ShippoParcel {
  length: string;
  width: string;
  height: string;
  distance_unit: string;
  weight: string;
  mass_unit: string;
}

interface ShippoRate {
  object_id: string;
  provider: string;
  provider_image_75: string;
  servicelevel: { name: string; token: string };
  amount: string;
  currency: string;
  estimated_days: number | null;
  attributes: string[];
}

interface ShippoShipmentResponse {
  rates: ShippoRate[];
  messages?: Array<{ text: string }>;
}

function dec(d: unknown): number {
  return Number(d);
}

/** Build the list of parcels for a given device quantity using DB config. */
export async function buildParcels(quantity: number): Promise<{ parcels: ShippoParcel[]; settings: Awaited<ReturnType<typeof loadSettings>> }> {
  const settings = await loadSettings();
  if (!settings) return { parcels: [], settings: null };

  const maxPerBox = settings.maxDevicesPerBox;
  const parcels: ShippoParcel[] = [];

  let remaining = quantity;
  while (remaining > 0) {
    const boxQty = Math.min(remaining, maxPerBox);
    remaining -= boxQty;

    const tier = settings.packageTiers.find((t) => boxQty >= t.minQty && boxQty <= t.maxQty);
    const weightEntry = settings.weightEntries.find((w) => w.qty === boxQty);

    // Fall back to largest tier if qty somehow exceeds all tiers
    const fallbackTier = tier ?? settings.packageTiers[settings.packageTiers.length - 1];
    if (!fallbackTier) continue;

    const weight = weightEntry ? dec(weightEntry.weightLb) : dec(fallbackTier.maxWeightLb);

    parcels.push({
      length: String(dec(fallbackTier.lengthIn)),
      width: String(dec(fallbackTier.widthIn)),
      height: String(dec(fallbackTier.heightIn)),
      distance_unit: "in",
      weight: String(weight),
      mass_unit: "lb",
    });
  }

  return { parcels, settings };
}

async function loadSettings() {
  return prisma.shippingSettings.findFirst({
    include: {
      packageTiers: { orderBy: { sortOrder: "asc" } },
      weightEntries: { orderBy: { qty: "asc" } },
    },
  });
}

export async function getShippingRates(
  toAddress: ShippoToAddress,
  quantity: number,
): Promise<{ rates: ShippingRate[]; error?: string }> {
  const token = process.env.SHIPPO_API_TOKEN;
  if (!token) {
    return { rates: [], error: "Shippo API token not configured." };
  }

  const { parcels, settings } = await buildParcels(quantity);
  if (!settings || parcels.length === 0) {
    return { rates: [], error: "Shipping settings not configured." };
  }

  const res = await fetch("https://api.goshippo.com/shipments/", {
    method: "POST",
    headers: {
      Authorization: `ShippoToken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address_from: {
        name: settings.warehouseName,
        street1: settings.warehouseStreet,
        city: settings.warehouseCity,
        state: settings.warehouseState,
        zip: settings.warehouseZip,
        country: settings.warehouseCountry,
        phone: settings.warehousePhone,
      },
      address_to: {
        name: toAddress.name || "Customer",
        street1: toAddress.street1,
        city: toAddress.city,
        state: toAddress.state,
        zip: toAddress.zip,
        country: toAddress.country,
        phone: toAddress.phone || "",
        email: toAddress.email || "",
      },
      parcels,
      async: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Shippo API error", res.status, text);
    return { rates: [], error: `Shippo returned ${res.status}` };
  }

  const data: ShippoShipmentResponse = await res.json();

  const ALLOWED_CARRIERS = new Set(["USPS", "UPS", "FedEx"]);

  const rates: ShippingRate[] = data.rates
    .filter((r) => ALLOWED_CARRIERS.has(r.provider))
    .map((r) => ({
      objectId: r.object_id,
      carrier: r.provider,
      service: r.servicelevel.name,
      amountCents: Math.round(parseFloat(r.amount) * 100),
      currency: r.currency,
      estimatedDays: r.estimated_days,
      attributes: r.attributes ?? [],
      carrierLogo: r.provider_image_75 || null,
    }))
    .sort((a, b) => a.amountCents - b.amountCents);

  return { rates };
}
