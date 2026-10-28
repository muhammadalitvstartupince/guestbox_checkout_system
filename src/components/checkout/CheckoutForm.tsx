"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { initiateOrder, saveBillingInfo, saveBillingPlan, completeCheckout, checkPromoCode } from "@/app/c/[slug]/actions";
import { OrderSuccessModal } from "@/components/checkout/OrderSuccessModal";
import { PhoneNumberField } from "@/components/checkout/PhoneNumberField";
import { CountryField } from "@/components/checkout/CountryField";
import { DEFAULT_COUNTRY_CODE } from "@/lib/checkout/countries";
import {
  initialCheckoutFormState,
  initialInitiateOrderState,
  initialBillingInfoState,
  type CheckoutFormState,
  type BillingInfoState,
} from "@/lib/checkout/types";
import { calculateOrderPrice } from "@/lib/pricing/calculate";
import { montserrat } from "@/lib/fonts";
import { detectCardBrand } from "@/lib/payments/card-brand";
import { isValidLuhn } from "@/lib/payments/luhn";
import { Check, ShieldCheck, CreditCard, Ticket, PencilLine, Minus, Plus, Tv, ThumbsUp, Settings, Truck, Zap, Lock, Clock } from "lucide-react";

function CardBrandIcon({ brand }: { brand: string | null }) {
  switch (brand) {
    case "visa":
      return <span className="text-xs font-black tracking-tight text-blue-800 italic">VISA</span>;
    case "mastercard":
      return (
        <span className="flex -space-x-2">
          <span className="h-4 w-4 rounded-full bg-red-500" />
          <span className="h-4 w-4 rounded-full bg-amber-400 opacity-90" />
        </span>
      );
    case "amex":
      return <span className="text-[10px] font-extrabold tracking-tight text-sky-700">AMEX</span>;
    case "discover":
      return <span className="text-[10px] font-extrabold tracking-tight text-orange-600">DISC</span>;
    default:
      return <CreditCard className="h-5 w-5 text-zinc-300" />;
  }
}

interface AddonView {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  originalPriceCents: number | null;
}

interface UpgradeView {
  title: string;
  description: string | null;
  priceCents: number;
  recurringPriceCents: number | null;
}

interface PriceTierView {
  minQty: number;
  maxQty: number | null;
  priceCents: number;
}

interface BillingPlanView {
  id: string;
  interval: "monthly" | "annually" | "none";
  label: string;
  priceCents: number;
  chargeAtCheckout: boolean;
  isDefault: boolean;
}

interface SkinConfig {
  colors?: { primary?: string; accent?: string };
  font?: string;
  backgroundImageUrl?: string;
  logoUrl?: string;
}

export interface ActivePromotionView {
  name: string;
  originalPriceCents: number;
  promoPriceCents: number;
  promoCode: string;
  endsAt: string | null;
}

export interface CheckoutPageView {
  slug: string;
  type: "normal" | "sales";
  title: string;
  productName: string;
  headline: string;
  originalPriceCents: number | null;
  heroHtml: string | null;
  heroHtmlMobile: string | null;
  mockupImageUrl: string | null;
  basePriceCents: number;
  recurringPriceCents: number | null;
  billingInterval: "monthly" | "annually" | "none";
  showPromoCode: boolean;
  skinConfig: SkinConfig;
  addons: AddonView[];
  upgrade: UpgradeView | null;
  priceTiers: PriceTierView[];
  billingPlans: BillingPlanView[];
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatWholeDollars(cents: number) {
  return `$${Math.round(cents / 100)}`;
}

function formatCardNumberInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function digitsOnly(raw: string, maxLength: number): string {
  return raw.replace(/\D/g, "").slice(0, maxLength);
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 16 }, (_, i) => String(CURRENT_YEAR + i));

async function noopBillingAction(state: BillingInfoState): Promise<BillingInfoState> {
  return state;
}
async function noopPaymentAction(state: CheckoutFormState): Promise<CheckoutFormState> {
  return state;
}

/** Given price tiers and a quantity, return the unit price in cents. */
function getUnitPrice(tiers: PriceTierView[], qty: number, fallback: number): number {
  for (const tier of tiers) {
    if (qty >= tier.minQty && (tier.maxQty == null || qty <= tier.maxQty)) {
      return tier.priceCents;
    }
  }
  return fallback;
}

/** Compute savings percentage vs the first tier's price. */
function savingsPercent(tierPrice: number, basePrice: number): number {
  if (basePrice <= 0) return 0;
  return Math.round(((basePrice - tierPrice) / basePrice) * 100);
}

export function CheckoutForm({ checkoutPage, landingUrl, activePromotion = null }: { checkoutPage: CheckoutPageView; landingUrl: string; activePromotion?: ActivePromotionView | null }) {
  const boundInitiate = initiateOrder.bind(null, checkoutPage.slug);
  const [initState, initFormAction, initPending] = useActionState(boundInitiate, initialInitiateOrderState);

  const orderId = initState.status === "success" ? (initState.orderId ?? null) : null;

  const boundSaveBilling = useMemo(() => (orderId ? saveBillingInfo.bind(null, orderId) : null), [orderId]);
  const [billingState, billingFormAction, billingPending] = useActionState(
    boundSaveBilling ?? noopBillingAction,
    initialBillingInfoState,
  );

  const boundComplete = useMemo(() => (orderId ? completeCheckout.bind(null, orderId) : null), [orderId]);
  const [completeState, completeFormAction, completePending] = useActionState(
    boundComplete ?? noopPaymentAction,
    initialCheckoutFormState,
  );

  const hasPlans = checkoutPage.billingPlans.length > 0;

  // --- New 3-step wizard: QTY → DETAILS → PAYMENT ---
  // DETAILS has sub-pages: personal info, address, billing cycle
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [detailsSubStep, setDetailsSubStep] = useState<"personal" | "address" | "billing-cycle">("personal");

  // Auto-advance after server actions succeed
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  if (orderId !== lastOrderId) {
    setLastOrderId(orderId);
    if (orderId) {
      setDetailsSubStep("address");
    }
  }

  const [lastBillingState, setLastBillingState] = useState(billingState);
  const [billingGen, setBillingGen] = useState(0);
  if (billingState !== lastBillingState) {
    setLastBillingState(billingState);
    setBillingGen((g) => g + 1);
    if (billingState.status === "success") {
      if (hasPlans) {
        setDetailsSubStep("billing-cycle");
      } else {
        setWizardStep(3);
      }
    }
  }

  const [lastInitState, setLastInitState] = useState(initState);
  const [initGen, setInitGen] = useState(0);
  if (initState !== lastInitState) {
    setLastInitState(initState);
    setInitGen((g) => g + 1);
  }

  const [lastCompleteState, setLastCompleteState] = useState(completeState);
  const [completeGen, setCompleteGen] = useState(0);
  if (completeState !== lastCompleteState) {
    setLastCompleteState(completeState);
    setCompleteGen((g) => g + 1);
  }

  // --- Form state ---
  const isPromoActive = activePromotion != null;
  const [quantity, setQuantity] = useState(1);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [upgradeSelected, setUpgradeSelected] = useState(false);
  const [listingQty, setListingQty] = useState(1);
  // Clamp listing qty to never exceed device qty
  useEffect(() => {
    setListingQty((prev) => Math.min(prev, quantity));
  }, [quantity]);

  const hasTiers = checkoutPage.priceTiers.length > 0;
  const baseTierPrice = hasTiers ? checkoutPage.priceTiers[0].priceCents : checkoutPage.basePriceCents;
  // When a promotion is active, lock to the promotion tier's price
  const unitPrice = isPromoActive
    ? activePromotion.originalPriceCents
    : hasTiers ? getUnitPrice(checkoutPage.priceTiers, quantity, checkoutPage.basePriceCents) : checkoutPage.basePriceCents;

  const defaultPlan = checkoutPage.billingPlans.find((p) => p.isDefault) ?? checkoutPage.billingPlans[0];
  const [selectedPlanId, setSelectedPlanId] = useState(defaultPlan?.id ?? "");
  const selectedPlan = checkoutPage.billingPlans.find((p) => p.id === selectedPlanId) ?? defaultPlan;

  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneCountry: DEFAULT_COUNTRY_CODE,
    phoneNumber: "",
  });
  const [billingForm, setBillingForm] = useState({
    addressLine1: "",
    country: "US",
    city: "",
    state: "",
    zip: "",
  });
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true);
  const [shippingForm, setShippingForm] = useState({
    addressLine1: "",
    country: "US",
    city: "",
    state: "",
    zip: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    cardNumber: "",
    expMonth: "",
    expYear: "",
    cvv: "",
    promoCode: isPromoActive ? activePromotion.promoCode : "",
    agree: false,
  });

  const cardDigits = paymentForm.cardNumber.replace(/\D/g, "");
  const cardBrand = detectCardBrand(cardDigits);
  const cardLooksValid = cardDigits.length >= 13 && isValidLuhn(cardDigits);

  const [promoCheck, setPromoCheck] = useState<{
    status: "idle" | "checking" | "valid" | "invalid";
    message?: string;
    discount?: { type: "percent" | "fixed"; value: number };
    appliedCode?: string;
  }>({ status: "idle" });

  async function handleValidatePromo() {
    const code = paymentForm.promoCode.trim();
    if (!code) {
      setPromoCheck({ status: "invalid", message: "Enter a promo code." });
      return;
    }
    setPromoCheck({ status: "checking" });
    const result = await checkPromoCode(checkoutPage.slug, code);
    setPromoCheck({
      status: result.valid ? "valid" : "invalid",
      message: result.message,
      discount: result.discount,
      appliedCode: result.valid ? code.toUpperCase() : undefined,
    });
  }

  function handleEditPromo() {
    if (!isPromoActive) setPromoCheck({ status: "idle" });
  }

  // Auto-validate the promo code when a promotion is active
  useEffect(() => {
    if (isPromoActive && promoCheck.status === "idle") {
      handleValidatePromo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPromoActive]);

  const effectiveTitle = upgradeSelected && checkoutPage.upgrade ? checkoutPage.upgrade.title : checkoutPage.productName;
  // During promotion: use promo price directly as base (discount is baked in)
  const effectiveBasePriceCents = isPromoActive
    ? activePromotion.promoPriceCents
    : upgradeSelected && checkoutPage.upgrade ? checkoutPage.upgrade.priceCents : unitPrice;
  // Only charge the plan price at checkout if chargeAtCheckout is true.
  // Otherwise it's recurring-only (starts at device activation).
  const planListingMultiplier = hasPlans && selectedPlan
    ? (selectedPlan.interval === "annually" ? listingQty : quantity)
    : 1;
  const effectiveRecurringPriceCents = hasPlans && selectedPlan
    ? (selectedPlan.chargeAtCheckout ? selectedPlan.priceCents * planListingMultiplier : 0)
    : upgradeSelected && checkoutPage.upgrade
      ? checkoutPage.upgrade.recurringPriceCents
      : checkoutPage.recurringPriceCents;
  // The plan price for display (always shown, regardless of chargeAtCheckout)
  const displayRecurringPriceCents = hasPlans && selectedPlan
    ? selectedPlan.priceCents * planListingMultiplier
    : effectiveRecurringPriceCents;

  const selectedAddons = useMemo(
    () => checkoutPage.addons.filter((a) => selectedAddonIds.includes(a.id)),
    [checkoutPage.addons, selectedAddonIds],
  );

  // During promotion the discount is baked into effectiveBasePriceCents — don't double-apply
  const appliedPromo = (!isPromoActive && promoCheck.status === "valid") ? (promoCheck.discount ?? null) : null;
  const estimate = useMemo(
    () =>
      calculateOrderPrice({
        basePriceCents: effectiveBasePriceCents,
        quantity,
        addons: selectedAddons.map((a) => ({ priceCents: a.priceCents })),
        recurringPriceCents: effectiveRecurringPriceCents,
        promo: appliedPromo,
      }),
    [quantity, listingQty, selectedAddons, effectiveBasePriceCents, effectiveRecurringPriceCents, appliedPromo],
  );

  const primaryColor = checkoutPage.skinConfig.colors?.primary ?? "#0d1b2a";
  const accentColor = checkoutPage.skinConfig.colors?.accent ?? "#00b4d8";

  function toggleAddon(id: string, include: boolean) {
    setSelectedAddonIds((prev) => {
      if (include) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((a) => a !== id);
    });
  }

  const recurringLabel = selectedPlan?.interval === "annually" ? "yr" : "mo";

  // =====================================================================
  // STEP 1: QTY
  // =====================================================================
  function renderQtyStep() {
    const promoUnitPrice = isPromoActive ? activePromotion.promoPriceCents : unitPrice;
    const orderTotal = promoUnitPrice * quantity;
    return (
      <div className="space-y-6">
        <h2 className={`${montserrat.className} text-xl font-bold text-zinc-900 sm:text-2xl`}>SUBMIT YOUR ORDER</h2>

        {/* Limited Time Promotion banner — replaces tier badges */}
        {isPromoActive && (() => {
          const savePercent = Math.round(((activePromotion.originalPriceCents - activePromotion.promoPriceCents) / activePromotion.originalPriceCents) * 100);
          return (
            <div className="relative overflow-hidden rounded-2xl border-2 border-orange-400 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 px-5 pb-5 pt-8 text-center shadow-lg">
              {/* Animated shimmer overlay */}
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.6)_50%,transparent_75%)] bg-[length:250%_100%] animate-[shimmer_3s_ease-in-out_infinite]" />

              {/* Top ribbon */}
              <div className="absolute -left-1 -top-1 z-10">
                <div className="flex items-center gap-1 rounded-br-xl rounded-tl-xl bg-gradient-to-r from-red-600 to-orange-500 px-4 py-1.5 text-xs font-extrabold tracking-widest text-white uppercase shadow-md">
                  <Zap className="h-3.5 w-3.5 fill-yellow-300 text-yellow-300" />
                  Limited Time
                </div>
              </div>

              {/* Save badge */}
              {savePercent > 0 && (
                <div className="absolute -right-1 -top-1 z-10">
                  <div className="rounded-bl-xl rounded-tr-xl bg-emerald-500 px-3 py-1.5 text-xs font-extrabold text-white shadow-md">
                    SAVE {savePercent}%
                  </div>
                </div>
              )}

              {/* Price display */}
              <div className="mt-2 flex items-baseline justify-center gap-2">
                <span className="text-xl font-semibold text-zinc-400 line-through decoration-red-400 decoration-2">
                  {formatWholeDollars(activePromotion.originalPriceCents)}
                </span>
                <span className="text-5xl font-black text-zinc-900">
                  {formatWholeDollars(activePromotion.promoPriceCents)}
                </span>
                <span className="text-sm font-medium text-zinc-500">/each</span>
              </div>

              <p className="mt-1.5 text-sm font-medium text-zinc-600">{checkoutPage.productName}</p>

              {/* Urgency nudge */}
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                </span>
                Offer ends soon — don&apos;t miss out!
              </div>
            </div>
          );
        })()}

        {/* Tier badges — hidden during promotion */}
        {!isPromoActive && hasTiers && checkoutPage.priceTiers.filter((t) => t.minQty > 1).length > 0 && (
          <div className="flex flex-wrap gap-3">
            {checkoutPage.priceTiers
              .filter((t) => t.minQty > 1)
              .map((tier) => {
                const savings = savingsPercent(tier.priceCents, baseTierPrice);
                const label = `${tier.minQty}+`;
                const isTierActive = quantity >= tier.minQty && (tier.maxQty == null || quantity <= tier.maxQty);
                return (
                  <button
                    key={tier.minQty}
                    type="button"
                    onClick={() => setQuantity(tier.minQty)}
                    className={`group relative flex-1 overflow-hidden rounded-xl border-2 px-3 py-2.5 text-center transition-all ${
                      isTierActive
                        ? "border-cyan-500 bg-gradient-to-b from-cyan-50 to-white shadow-lg shadow-cyan-500/10"
                        : "border-zinc-200 bg-white hover:border-cyan-400 hover:shadow-md"
                    }`}
                  >
                    {isTierActive && (
                      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500" />
                    )}
                    <div className={`text-sm font-semibold ${isTierActive ? "text-cyan-600" : "text-zinc-500"}`}>
                      {label} GuestBoxes
                    </div>
                    <div className={`text-2xl font-extrabold ${isTierActive ? "text-zinc-900" : "text-zinc-700"}`}>
                      {formatWholeDollars(tier.priceCents)}
                    </div>
                    {savings > 0 && (
                      <div className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        isTierActive
                          ? "bg-cyan-100 text-cyan-700"
                          : "bg-zinc-100 text-zinc-500 group-hover:bg-cyan-50 group-hover:text-cyan-600"
                      }`}>
                        SAVE {savings}%
                      </div>
                    )}
                  </button>
                );
              })}
          </div>
        )}

        {/* Quantity control — always shown */}
        <div className="text-center">
          <p className="mb-2 text-sm font-semibold text-zinc-700">Quantity</p>
          <div className="inline-flex items-center gap-0">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-12 w-14 items-center justify-center rounded-l-full bg-red-200 text-red-700 transition-colors hover:bg-red-300"
            >
              <Minus className="h-5 w-5" />
            </button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={quantity}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1) setQuantity(v);
              }}
              className="h-12 w-20 border-y border-zinc-300 text-center text-lg font-bold text-zinc-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-12 w-14 items-center justify-center rounded-r-full bg-emerald-400 text-white transition-colors hover:bg-emerald-500"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Order total bar */}
        <div className="flex items-center justify-between rounded-full px-6 py-3" style={{ backgroundColor: primaryColor }}>
          <span className="text-sm font-semibold text-white/90">Order Total:</span>
          <span className="text-2xl font-bold text-white">{formatWholeDollars(orderTotal)}</span>
        </div>
        <p className="-mt-4 text-center text-sm text-zinc-500">
          {formatWholeDollars(promoUnitPrice)} per device
          {isPromoActive && <span className="ml-1 text-zinc-400 line-through">{formatWholeDollars(activePromotion.originalPriceCents)}</span>}
          {selectedPlan ? ` | ${formatWholeDollars(selectedPlan.priceCents)}/${recurringLabel} per listing` : ""}
        </p>
        <div className="-mt-1 flex items-center justify-evenly rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 px-2 py-2 text-emerald-700 shadow-sm ring-1 ring-emerald-200/60">
          <span className="flex flex-col items-center gap-0.5">
            <Truck className="h-4 w-4" />
            <span className="text-[10px] font-extrabold leading-tight tracking-wide">FREE SHIPPING</span>
          </span>
          <span className="h-8 w-px bg-emerald-200" />
          <span className="flex flex-col items-center gap-0.5">
            <Check className="h-4 w-4" />
            <span className="text-[10px] font-extrabold leading-tight tracking-wide">NO TAX</span>
          </span>
          <span className="h-8 w-px bg-emerald-200" />
          <span className="flex flex-col items-center gap-0.5">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-[10px] font-extrabold leading-tight tracking-wide">NO EXTRA FEES</span>
          </span>
        </div>

        {/* Next button */}
        <button
          type="button"
          onClick={() => setWizardStep(2)}
          className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-lg font-bold text-white transition hover:brightness-110"
          style={{ backgroundColor: accentColor }}
        >
          Next <span aria-hidden>→</span>
        </button>
      </div>
    );
  }

  // =====================================================================
  // STEP 2: DETAILS — sub-steps: personal → address → billing cycle
  // =====================================================================
  function renderDetailsStep() {
    return (
      <div className="space-y-6">
        <h2 className={`${montserrat.className} text-xl font-bold text-zinc-900 sm:text-2xl`}>SUBMIT YOUR ORDER</h2>

        {detailsSubStep === "personal" && renderPersonalSubStep()}
        {detailsSubStep === "address" && renderAddressSubStep()}
        {detailsSubStep === "billing-cycle" && renderBillingCycleSubStep()}
      </div>
    );
  }

  function renderPersonalSubStep() {
    return (
      <>
        {initState.status === "error" && initState.message && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">{initState.message}</div>
        )}
        <form key={initGen} action={initFormAction} className="space-y-4">
          <input type="hidden" name="landingUrl" value={landingUrl} />
          <input type="hidden" name="quantity" value={quantity} />
          <div className="grid grid-cols-2 gap-3">
            <Field
              name="firstName"
              label="First Name"
              value={profileForm.firstName}
              onChange={(v) => setProfileForm((p) => ({ ...p, firstName: v }))}
              errors={initState.fieldErrors?.firstName}
              placeholder="John"
            />
            <Field
              name="lastName"
              label="Last Name"
              value={profileForm.lastName}
              onChange={(v) => setProfileForm((p) => ({ ...p, lastName: v }))}
              errors={initState.fieldErrors?.lastName}
              placeholder="Smith"
            />
          </div>
          <Field
            name="email"
            label="Email Address"
            type="email"
            value={profileForm.email}
            onChange={(v) => setProfileForm((p) => ({ ...p, email: v }))}
            errors={initState.fieldErrors?.email}
            placeholder="you@example.com"
          />
          <PhoneNumberField
            country={profileForm.phoneCountry}
            onCountryChange={(v) => setProfileForm((p) => ({ ...p, phoneCountry: v }))}
            number={profileForm.phoneNumber}
            onNumberChange={(v) => setProfileForm((p) => ({ ...p, phoneNumber: v }))}
            errors={initState.fieldErrors?.phone}
          />

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setWizardStep(1)}
              className="flex-1 rounded-full bg-zinc-200 py-3 font-bold text-zinc-700 transition-colors hover:bg-zinc-300"
            >
              Previous
            </button>
            {orderId ? (
              <button
                type="button"
                onClick={() => setDetailsSubStep("address")}
                className="flex-1 rounded-full py-3 font-bold text-white transition hover:brightness-110"
                style={{ backgroundColor: accentColor }}
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={initPending}
                className="flex-1 rounded-full py-3 font-bold text-white transition hover:brightness-110 disabled:opacity-60"
                style={{ backgroundColor: accentColor }}
              >
                Next
              </button>
            )}
          </div>
        </form>
      </>
    );
  }

  function renderAddressSubStep() {
    return (
      <>
        {billingState.status === "error" && billingState.message && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">{billingState.message}</div>
        )}
        <form key={billingGen} action={billingFormAction} className="space-y-4">
          <input type="hidden" name="shippingSameAsBilling" value={shippingSameAsBilling ? "on" : ""} />
          {!shippingSameAsBilling && (
            <>
              <input type="hidden" name="shippingAddressLine1" value={shippingForm.addressLine1} />
              <input type="hidden" name="shippingCountry" value={shippingForm.country} />
              <input type="hidden" name="shippingCity" value={shippingForm.city} />
              <input type="hidden" name="shippingState" value={shippingForm.state} />
              <input type="hidden" name="shippingZip" value={shippingForm.zip} />
            </>
          )}

          <Field
            name="addressLine1"
            label="Street Address"
            value={billingForm.addressLine1}
            onChange={(v) => setBillingForm((b) => ({ ...b, addressLine1: v }))}
            errors={billingState.fieldErrors?.addressLine1}
            placeholder="123 Main St"
          />
          <CountryField
            name="country"
            label="Country"
            value={billingForm.country}
            onChange={(v) => setBillingForm((b) => ({ ...b, country: v }))}
            errors={billingState.fieldErrors?.country}
          />
          <Field
            name="city"
            label="City"
            value={billingForm.city}
            onChange={(v) => setBillingForm((b) => ({ ...b, city: v }))}
            errors={billingState.fieldErrors?.city}
            placeholder="New York"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              name="state"
              label="State / Province"
              value={billingForm.state}
              onChange={(v) => setBillingForm((b) => ({ ...b, state: v }))}
              errors={billingState.fieldErrors?.state}
              placeholder="New York"
            />
            <Field
              name="zip"
              label="Zip Code"
              value={billingForm.zip}
              onChange={(v) => setBillingForm((b) => ({ ...b, zip: v }))}
              errors={billingState.fieldErrors?.zip}
              placeholder="10001"
            />
          </div>

          {/* Shipping same as billing */}
          <label className="flex items-center gap-2 text-sm font-bold text-zinc-800">
            <input
              type="checkbox"
              checked={shippingSameAsBilling}
              onChange={(e) => setShippingSameAsBilling(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Shipping address same as billing
          </label>

          {/* Separate shipping address */}
          {!shippingSameAsBilling && (
            <div className="space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-700">Shipping Address</p>
              <Field
                name="shippingAddressLine1_display"
                label="Street Address"
                value={shippingForm.addressLine1}
                onChange={(v) => setShippingForm((s) => ({ ...s, addressLine1: v }))}
                placeholder="456 Oak Ave"
              />
              <CountryField
                name="shippingCountry_display"
                label="Country"
                value={shippingForm.country}
                onChange={(v) => setShippingForm((s) => ({ ...s, country: v }))}
              />
              <Field
                name="shippingCity_display"
                label="City"
                value={shippingForm.city}
                onChange={(v) => setShippingForm((s) => ({ ...s, city: v }))}
                placeholder="Los Angeles"
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  name="shippingState_display"
                  label="State / Province"
                  value={shippingForm.state}
                  onChange={(v) => setShippingForm((s) => ({ ...s, state: v }))}
                  placeholder="California"
                />
                <Field
                  name="shippingZip_display"
                  label="Zip Code"
                  value={shippingForm.zip}
                  onChange={(v) => setShippingForm((s) => ({ ...s, zip: v }))}
                  placeholder="90001"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDetailsSubStep("personal")}
              className="flex-1 rounded-full bg-zinc-200 py-3 font-bold text-zinc-700 transition-colors hover:bg-zinc-300"
            >
              Previous
            </button>
            <button
              type="submit"
              disabled={billingPending}
              className="flex-1 rounded-full py-3 font-bold text-white transition hover:brightness-110 disabled:opacity-60"
              style={{ backgroundColor: accentColor }}
            >
              Next
            </button>
          </div>
        </form>
      </>
    );
  }

  function renderBillingCycleSubStep() {
    if (!hasPlans) {
      return null;
    }

    // Annual plan for showing strikethrough savings
    const annualPlan = checkoutPage.billingPlans.find((p) => p.interval === "annually");
    const monthlyPlan = checkoutPage.billingPlans.find((p) => p.interval === "monthly");
    const annualSavings = monthlyPlan && annualPlan
      ? (monthlyPlan.priceCents * 12) - annualPlan.priceCents
      : 0;
    const monthlyAsAnnual = monthlyPlan ? monthlyPlan.priceCents * 12 : 0;

    return (
      <div className="space-y-5">
        <div>
          <p className="text-lg font-bold text-zinc-900">Choose Your Subscription Option</p>
        </div>

        {/* Monthly plan card */}
        {monthlyPlan && (() => {
          const isSelected = selectedPlanId === monthlyPlan.id;
          return (
            <label
              className={`relative block cursor-pointer rounded-2xl border-2 p-5 transition-all ${
                isSelected
                  ? "border-blue-500 bg-blue-50/40 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/20"
                  : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm"
              }`}
              onClick={() => setSelectedPlanId(monthlyPlan.id)}
            >
              <div className="flex items-center gap-3">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                  isSelected ? "border-blue-500 bg-blue-500" : "border-zinc-300"
                }`}>
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </span>
                <input type="radio" name="billingPlan" checked={isSelected} onChange={() => setSelectedPlanId(monthlyPlan.id)} className="sr-only" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-zinc-900">{monthlyPlan.label}</span>
                    <div className="text-right">
                      <span className="text-2xl font-extrabold text-zinc-900">{formatWholeDollars(monthlyPlan.priceCents)}</span>
                      <span className="text-sm text-zinc-400">/month</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="ml-0.5 space-y-1">
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> Access all standard features
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> Supports multiple devices per listing
                </div>
              </div>
            </label>
          );
        })()}

        {/* Annual plan card */}
        {annualPlan && (() => {
          const isSelected = selectedPlanId === annualPlan.id;
          const savePct = annualSavings > 0 ? Math.round((annualSavings / monthlyAsAnnual) * 100) : 0;
          return (
            <div className="relative">
              <label
                className={`relative block cursor-pointer rounded-2xl border-2 p-5 transition-all ${
                  isSelected
                    ? "border-blue-500 bg-blue-50/40 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/20"
                    : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm"
                }`}
                onClick={() => setSelectedPlanId(annualPlan.id)}
              >
                {annualSavings > 0 && (
                  <div className="mb-3 flex flex-col gap-1.5 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 px-2.5 py-1.5 sm:flex-row sm:items-center sm:gap-2">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-5 w-5 shrink-0 text-emerald-600" />
                      <span className="text-sm font-bold text-zinc-900 sm:text-sm">Limited Time Offer</span>
                    </div>
                    <span
                      className="inline-block rounded-xl px-3.5 py-1.5 text-sm leading-snug font-extrabold tracking-wide text-white uppercase shadow-lg sm:whitespace-nowrap sm:rounded-full sm:text-[11px] sm:px-3.5 sm:py-1"
                      style={{ backgroundColor: accentColor }}
                    >
                      OPTIONAL — <span className="text-yellow-300">Save {savePct}%</span> <span className="hidden sm:inline">When You Pay </span>Annually!
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                    isSelected ? "border-blue-500 bg-blue-500" : "border-zinc-300"
                  }`}>
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <input type="radio" name="billingPlan" checked={isSelected} onChange={() => setSelectedPlanId(annualPlan.id)} className="sr-only" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-zinc-900">{annualPlan.label}</span>
                      <div className="translate-y-2.5 text-right">
                        <span className="text-2xl font-extrabold text-zinc-900">{formatWholeDollars(annualPlan.priceCents)}</span>
                        <span className="text-sm text-zinc-400">/year</span>
                        {monthlyAsAnnual > 0 && (
                          <div className="text-xs text-zinc-400 line-through">{formatWholeDollars(monthlyAsAnnual)}/year</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="-mt-1 ml-0.5 space-y-0.5">
                  <div className="flex items-center gap-2 text-sm text-zinc-600">
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> Priority support
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-600">
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> Save {formatWholeDollars(annualSavings)}/year
                    {annualSavings > 0 && (
                      <span className="ml-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-600">
                        {formatWholeDollars(annualSavings)} OFF
                      </span>
                    )}
                  </div>
                </div>
              </label>
            </div>
          );
        })()}

        {/* Remaining plans (if any beyond monthly/annual) */}
        {checkoutPage.billingPlans.filter((p) => p.interval !== "monthly" && p.interval !== "annually").map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          return (
            <label
              key={plan.id}
              className={`relative block cursor-pointer rounded-2xl border-2 p-5 transition-all ${
                isSelected
                  ? "border-blue-500 bg-blue-50/40 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/20"
                  : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm"
              }`}
              onClick={() => setSelectedPlanId(plan.id)}
            >
              <div className="flex items-center gap-3">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                  isSelected ? "border-blue-500 bg-blue-500" : "border-zinc-300"
                }`}>
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </span>
                <input type="radio" name="billingPlan" checked={isSelected} onChange={() => setSelectedPlanId(plan.id)} className="sr-only" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-zinc-900">{plan.label}</span>
                    <div className="text-right">
                      <span className="text-2xl font-extrabold text-zinc-900">{formatWholeDollars(plan.priceCents)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </label>
          );
        })}

        {selectedPlan?.interval === "annually" && quantity > 1 && (() => {
          const listingTotal = selectedPlan.priceCents * listingQty;
          return (
            <div className="rounded-2xl border-2 border-zinc-200 bg-gradient-to-b from-white to-zinc-50/80 p-5">
              <p className="text-center text-base font-bold text-zinc-900">How many listings do you to manage?</p>
              <p className="mt-1 text-center text-xs text-zinc-500">Each listing is billed at {formatWholeDollars(selectedPlan.priceCents)}/year</p>

              <div className="mt-4 flex items-center justify-center gap-0">
                <button
                  type="button"
                  disabled={listingQty <= 1}
                  onClick={() => setListingQty((q) => Math.max(1, q - 1))}
                  className="flex h-12 w-14 items-center justify-center rounded-l-full bg-red-200 text-red-700 transition-colors hover:bg-red-300 disabled:opacity-40"
                >
                  <Minus className="h-5 w-5" />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={listingQty}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= 1) setListingQty(Math.min(v, quantity));
                  }}
                  className="h-12 w-20 border-y border-zinc-300 bg-white text-center text-lg font-bold text-zinc-900 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={listingQty >= quantity}
                  onClick={() => setListingQty((q) => Math.min(q + 1, quantity))}
                  className="flex h-12 w-14 items-center justify-center rounded-r-full bg-emerald-400 text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-100 px-4 py-2.5">
                <span className="text-sm text-zinc-600">{listingQty} {listingQty === 1 ? "listing" : "listings"} × {formatWholeDollars(selectedPlan.priceCents)}/yr</span>
                <span className="text-base font-bold text-zinc-900">{formatWholeDollars(listingTotal)}/yr</span>
              </div>
            </div>
          );
        })()}

        <div className="text-center">
        <span className="inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-extrabold text-emerald-600">
          {selectedPlan?.interval === "annually"
            ? "✓ Annual plans are billed upfront to secure the discounted rates."
            : "✓ Monthly billing only starts when your device is installed and activated."}
        </span>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setDetailsSubStep("address")}
            className="flex-1 rounded-full bg-zinc-200 py-3 font-bold text-zinc-700 transition-colors hover:bg-zinc-300"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={async () => {
              if (orderId) await saveBillingPlan(orderId, selectedPlanId, selectedPlan?.interval === "annually" ? listingQty : quantity);
              setWizardStep(3);
            }}
            className="flex-1 rounded-full py-3 font-bold text-white transition hover:brightness-110"
            style={{ backgroundColor: accentColor }}
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  // =====================================================================
  // STEP 3: PAYMENT
  // =====================================================================
  function renderPaymentStep() {
    return (
      <div>
        <form key={completeGen} action={completeFormAction} className="space-y-6">
          {selectedAddonIds.map((id) => (
            <input key={id} type="hidden" name="addonIds" value={id} />
          ))}
          {upgradeSelected && <input type="hidden" name="upgradeSelected" value="on" />}
          <input type="hidden" name="quantity" value={quantity} />
          <input type="hidden" name="listingQty" value={selectedPlan?.interval === "annually" ? listingQty : quantity} />
          {selectedPlanId && <input type="hidden" name="billingPlanId" value={selectedPlanId} />}

          <section className="space-y-3">
            <Field
              name="cardNumber"
              label="Credit Card Number"
              value={paymentForm.cardNumber}
              onChange={(v) => setPaymentForm((f) => ({ ...f, cardNumber: formatCardNumberInput(v) }))}
              errors={completeState.fieldErrors?.cardNumber}
              maxLength={23}
              inputMode="numeric"
              placeholder="1234 5678 9012 3456"
              trailing={
                <span className="flex items-center gap-1.5">
                  <CardBrandIcon brand={cardBrand} />
                  {cardLooksValid && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                </span>
              }
            />
            <div className="grid grid-cols-3 gap-3">
              <SelectField
                name="expMonth"
                label="Exp. Month"
                value={paymentForm.expMonth}
                onChange={(v) => setPaymentForm((f) => ({ ...f, expMonth: v }))}
                options={MONTH_OPTIONS.map((m) => ({ value: m, label: m }))}
                errors={completeState.fieldErrors?.expMonth}
                placeholder="MM"
              />
              <SelectField
                name="expYear"
                label="Exp. Year"
                value={paymentForm.expYear}
                onChange={(v) => setPaymentForm((f) => ({ ...f, expYear: v }))}
                options={YEAR_OPTIONS.map((y) => ({ value: y, label: y }))}
                errors={completeState.fieldErrors?.expYear}
                placeholder="YYYY"
              />
              <Field
                name="cvv"
                label="CVV"
                value={paymentForm.cvv}
                onChange={(v) => setPaymentForm((f) => ({ ...f, cvv: digitsOnly(v, 4) }))}
                errors={completeState.fieldErrors?.cvv}
                maxLength={4}
                inputMode="numeric"
                placeholder="123"
              />
            </div>
          </section>

          <div className="flex flex-col items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:justify-between">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <CardBrandPill label="Visa">VISA</CardBrandPill>
              <CardBrandPill label="Mastercard">
                <span className="flex -space-x-2">
                  <span className="h-3.5 w-3.5 rounded-full bg-red-500" />
                  <span className="h-3.5 w-3.5 rounded-full bg-amber-400 opacity-90" />
                </span>
              </CardBrandPill>
              <CardBrandPill label="American Express">AMEX</CardBrandPill>
              <CardBrandPill label="Discover">DISC∅VER</CardBrandPill>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
              <div className="leading-tight">
                <div className="text-xs font-semibold text-zinc-700">Secure order</div>
                <div className="text-[10px] text-zinc-500">256-bit encryption</div>
              </div>
            </div>
          </div>

          {/* Add-ons inline */}
          {checkoutPage.addons.length > 0 && (
            <section className="space-y-2">
              <p className="text-sm font-semibold text-zinc-700">Add-ons</p>
              {checkoutPage.addons.map((addon) => {
                const checked = selectedAddonIds.includes(addon.id);
                return (
                  <label
                    key={addon.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-zinc-50 ${
                      checked ? "border-emerald-400 bg-emerald-50" : "border-zinc-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleAddon(addon.id, e.target.checked)}
                    />
                    <span className="flex-1 text-sm font-medium text-zinc-800">{addon.name}</span>
                    <span className="text-sm font-bold text-zinc-700">{formatCents(addon.priceCents)}</span>
                  </label>
                );
              })}
            </section>
          )}

          {/* Upgrade */}
          {checkoutPage.upgrade && (
            <section className="space-y-2">
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-zinc-50 ${
                  upgradeSelected ? "border-emerald-400 bg-emerald-50" : "border-zinc-200"
                }`}
              >
                <input
                  type="checkbox"
                  checked={upgradeSelected}
                  onChange={(e) => setUpgradeSelected(e.target.checked)}
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-zinc-800">Upgrade to {checkoutPage.upgrade.title}</span>
                  {checkoutPage.upgrade.description && (
                    <p className="text-xs text-zinc-500">{checkoutPage.upgrade.description}</p>
                  )}
                </div>
                <span className="text-sm font-bold text-zinc-700">{formatCents(checkoutPage.upgrade.priceCents)}</span>
              </label>
            </section>
          )}

          {(checkoutPage.showPromoCode || isPromoActive) && (
            <section>
              {promoCheck.status === "valid" ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-gradient-to-r from-emerald-50 to-white px-4 py-3">
                  <input type="hidden" name="promoCode" value={promoCheck.appliedCode ?? ""} />
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <Ticket className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-mono text-sm font-bold tracking-wide text-emerald-800">
                          {promoCheck.appliedCode}
                        </span>
                        <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                      </div>
                      <div className="text-xs font-medium text-emerald-700">{promoCheck.message} applied</div>
                    </div>
                  </div>
                  {!isPromoActive && (
                  <button
                    type="button"
                    onClick={handleEditPromo}
                    className="flex shrink-0 items-center gap-1 rounded px-2 py-1.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                  >
                    <PencilLine className="h-3.5 w-3.5" /> Change
                  </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Field
                        name="promoCode"
                        label="Promo Code (optional)"
                        value={paymentForm.promoCode}
                        onChange={(v) => {
                          setPaymentForm((f) => ({ ...f, promoCode: v }));
                          if (promoCheck.status !== "idle") setPromoCheck({ status: "idle" });
                        }}
                        errors={completeState.fieldErrors?.promoCode}
                        trailing={<Ticket className="h-4 w-4 text-zinc-300" />}
                        placeholder="SAVE20"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleValidatePromo}
                      disabled={promoCheck.status === "checking"}
                      className="h-10 shrink-0 rounded border border-zinc-300 px-4 text-sm font-bold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60"
                    >
                      {promoCheck.status === "checking" ? "Checking…" : "Apply"}
                    </button>
                  </div>
                  {promoCheck.status === "invalid" && <p className="mt-1.5 text-sm text-red-600">{promoCheck.message}</p>}
                </>
              )}
            </section>
          )}

          <div className="rounded-lg p-4 text-white" style={{ backgroundColor: primaryColor }}>
            <div className="mb-2 text-sm font-semibold tracking-wide uppercase opacity-90">Order Summary</div>
            <div className="space-y-1 text-sm opacity-90">
              {/* Device line */}
              {isPromoActive ? (
                <div className="flex items-baseline justify-between">
                  <span>{quantity}× {effectiveTitle} @ {formatWholeDollars(activePromotion.promoPriceCents)}/ea</span>
                  <div className="ml-2 flex items-baseline gap-2">
                    <span className="text-xs text-white/50 line-through">{formatCents(activePromotion.originalPriceCents * quantity)}</span>
                    <span className="font-medium">{formatCents(activePromotion.promoPriceCents * quantity)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between">
                  <span>{quantity}× {effectiveTitle} @ {formatWholeDollars(unitPrice)}/ea</span>
                  <span className="font-medium">{formatCents(unitPrice * quantity)}</span>
                </div>
              )}
              {/* Billing plan / listing line */}
              {selectedPlan?.chargeAtCheckout && (
                <div className="flex justify-between">
                  <span>+ {selectedPlan.label} ({planListingMultiplier} {planListingMultiplier === 1 ? "listing" : "listings"} × {formatWholeDollars(selectedPlan.priceCents)}/{recurringLabel})</span>
                  <span className="font-medium">{formatCents(selectedPlan.priceCents * planListingMultiplier)}</span>
                </div>
              )}
              {/* Add-ons */}
              {selectedAddons.map((a) => (
                <div key={a.id} className="flex justify-between">
                  <span>+ {a.name}</span>
                  <span className="font-medium">{formatCents(a.priceCents)}</span>
                </div>
              ))}
            </div>
            {/* During promo: show savings instead of subtotal/discount breakdown */}
            {isPromoActive ? (
              <div className="mt-2 space-y-0.5 border-t border-white/15 pt-2 text-sm">
                <div className="flex justify-between text-emerald-400">
                  <span className="flex items-center gap-1">
                    <Ticket className="h-3.5 w-3.5" /> You save
                  </span>
                  <span className="font-semibold">
                    {formatCents((activePromotion.originalPriceCents - activePromotion.promoPriceCents) * quantity)}
                  </span>
                </div>
              </div>
            ) : estimate.discountCents > 0 ? (() => {
              const displaySubtotal = selectedPlan?.chargeAtCheckout
                ? estimate.subtotalCents + estimate.recurringTotalCents
                : estimate.subtotalCents;
              return (
                <div className="mt-2 space-y-0.5 border-t border-white/15 pt-2 text-sm">
                  <div className="flex justify-between opacity-80">
                    <span>Subtotal</span>
                    <span>{formatCents(displaySubtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1 opacity-90">
                      <Ticket className="h-3.5 w-3.5" /> Promo ({promoCheck.appliedCode})
                    </span>
                    <span className="font-semibold text-emerald-400">-{formatCents(estimate.discountCents)}</span>
                  </div>
                </div>
              );
            })() : null}
            <div className="mt-2 flex justify-between border-t border-white/15 pt-2 text-lg font-semibold">
              <span>Total</span>
              <span>{formatCents(
                selectedPlan?.chargeAtCheckout
                  ? estimate.totalCents + estimate.recurringTotalCents
                  : estimate.totalCents
              )}</span>
            </div>
            {estimate.recurringTotalCents > 0 && !selectedPlan?.chargeAtCheckout && (
              <div className="mt-1 text-sm opacity-90">
                Then {formatCents(estimate.recurringTotalCents)}/{recurringLabel}
              </div>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                name="agree"
                checked={paymentForm.agree}
                onChange={(e) => setPaymentForm((f) => ({ ...f, agree: e.target.checked }))}
              />
              Agree to{" "}
              <a
                href="https://guestbox.tv/terms-of-service/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline transition-colors hover:text-blue-800"
              >
                Terms &amp; Conditions
              </a>
            </label>
            {completeState.fieldErrors?.agree && (
              <p className="mt-1 text-sm text-red-600">{completeState.fieldErrors.agree[0]}</p>
            )}
          </div>

          {completeState.status === "error" && completeState.message && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">{completeState.message}</div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setWizardStep(2);
                setDetailsSubStep(hasPlans ? "billing-cycle" : "address");
              }}
              className="flex-1 rounded-full bg-zinc-200 py-3 font-bold text-zinc-700 transition-colors hover:bg-zinc-300"
            >
              Previous
            </button>
            <button
              type="submit"
              disabled={completePending}
              className="flex-1 rounded-full py-3 font-bold text-white transition hover:brightness-110 active:brightness-95 disabled:opacity-60"
              style={{ backgroundColor: accentColor }}
            >
              {completePending ? "Processing…" : "Submit"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // =====================================================================
  // LAYOUT
  // =====================================================================
  const hasHero = !!checkoutPage.skinConfig.backgroundImageUrl;

  const stepContent = (
    <>
      {wizardStep === 1 && renderQtyStep()}
      {wizardStep === 2 && renderDetailsStep()}
      {wizardStep === 3 && renderPaymentStep()}
    </>
  );

  if (!hasHero) {
    return (
      <div className={`${montserrat.className} mx-auto max-w-2xl px-4 py-10`}>
        <StepIndicator step={wizardStep} accentColor={accentColor} />
        <div className="mt-10">{stepContent}</div>
        {completeState.status === "success" && completeState.redirectUrl && (
          <OrderSuccessModal redirectUrl={completeState.redirectUrl} accentColor={accentColor} />
        )}
      </div>
    );
  }

  return (
    <div className={montserrat.className}>

      {/* Zone 1: Header + checkout form — gradient + overlay */}
      <div className="relative">
        <div className="absolute inset-0 -z-20" style={{ background: "radial-gradient(ellipse at center, #05AEEF, #000000)" }} />
        <div className="absolute inset-0 -z-10 bg-black/75" />

      {/* Top bar: logo + secure checkout badge */}
      <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 sm:px-10 sm:py-4">
        {checkoutPage.skinConfig.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={checkoutPage.skinConfig.logoUrl} alt="GuestBox" className="h-8 w-auto shrink-0 sm:h-12" />
        ) : (
          <span className="text-lg font-bold text-white sm:text-xl">GuestBox</span>
        )}
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 backdrop-blur-sm sm:gap-3 sm:px-5 sm:py-2.5">
          <ShieldCheck className="h-5 w-5 text-white sm:h-7 sm:w-7" />
          <div className="leading-tight">
            <div className="text-xs font-semibold text-white sm:text-sm">Secure Checkout</div>
            <div className="text-[10px] text-cyan-400 sm:text-xs">Encrypted &amp; Safe</div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-10 pt-4">

        {checkoutPage.heroHtml ? (
          <>
            <div
              className={`${montserrat.className} mb-8 text-white ${checkoutPage.heroHtmlMobile ? "hidden sm:block" : ""}`}
              dangerouslySetInnerHTML={{ __html: checkoutPage.heroHtml }}
            />
            {checkoutPage.heroHtmlMobile && (
              <div
                className={`${montserrat.className} mb-8 text-white sm:hidden`}
                dangerouslySetInnerHTML={{ __html: checkoutPage.heroHtmlMobile }}
              />
            )}
          </>
        ) : (
          <div className="mb-8 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] sm:text-base" style={{ color: accentColor }}>
              ORDER NOW
            </p>
            <h1 className="text-3xl font-extrabold uppercase leading-tight text-white sm:text-5xl">
              TURN YOUR PROPERTY INTO A{" "}
              <span style={{ color: accentColor }}>REVENUE MACHINE</span>
            </h1>

            {checkoutPage.originalPriceCents != null && (
              <p className="mt-4 text-lg font-bold text-white sm:text-xl">
                Waived Setup Fee: Normally{" "}
                <span className="line-through opacity-80">{formatWholeDollars(checkoutPage.originalPriceCents)}</span>
              </p>
            )}

            <p className="mt-2 text-xl font-bold sm:text-2xl" style={{ color: accentColor }}>
              ONLY {formatWholeDollars(effectiveBasePriceCents)} today
            </p>

            {effectiveRecurringPriceCents != null && effectiveRecurringPriceCents > 0 && (
              <p className="mt-1 text-sm text-white/90">
                {formatWholeDollars(effectiveRecurringPriceCents)} /{recurringLabel === "yr" ? "YEAR" : "MONTH"}
              </p>
            )}
          </div>
        )}

        <StepIndicator step={wizardStep} accentColor={accentColor} />

        <div className="mt-8 rounded-lg bg-white p-6 shadow-xl sm:p-8">
          {stepContent}
        </div>
      </div>
      </div>{/* end Zone 1 */}

      {/* Zone 2: Features + footer — same gradient + overlay */}
      <div className="relative">
        <div className="absolute inset-0 -z-20" style={{ background: "radial-gradient(ellipse at center, #05AEEF, #000000)" }} />
        <div className="absolute inset-0 -z-10 bg-black/75" />

      {/* Features section */}
      <div className="px-6 pt-16 pb-12 sm:px-10 lg:px-16 xl:px-24">
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:gap-8">
          {/* Mockup images */}
          {checkoutPage.mockupImageUrl && (
            <div className="w-full lg:w-1/2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={checkoutPage.mockupImageUrl} alt="" className="w-full max-w-none" />
            </div>
          )}

          {/* Text + feature grid */}
          <div className="flex-1">
            <h2 className={`${montserrat.className} mb-4 text-xl font-extrabold tracking-tight text-white sm:text-4xl`}>
              EVERYTHING YOU NEED TO{" "}
              <span style={{ color: accentColor }}>ELEVATE</span> EVERY STAY
            </h2>
            <p className="mb-8 text-sm leading-relaxed text-white/80 sm:text-base">
              GuestBox transforms any property TV into an intelligent guest experience hub. From
              streaming apps and local recommendations to personalized welcome screens and
              revenue-generating promotions, everything guests need is available in one beautifully
              designed interface.
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { icon: Tv, title: "Monetize TVs", sub: "Increase your revenue" },
                { icon: ThumbsUp, title: "Delight Every Guest", sub: "Premium entertainment" },
                { icon: Settings, title: "Fully Managed", sub: "We handle everything" },
                { icon: Truck, title: "In-Stock", sub: "Ships Immediately" },
                { icon: Zap, title: "Setup In Minutes", sub: "Plug and play" },
                { icon: Lock, title: "Secure Checkout", sub: "Your data is protected" },
              ].map((f) => (
                <div key={f.title} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-3 backdrop-blur-sm">
                  <f.icon className="h-5 w-5 shrink-0 text-white/70" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white sm:text-sm">{f.title}</div>
                    <div className="text-[10px] text-white/50 sm:text-xs">{f.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="py-4 text-center text-xs text-white/60">
© {new Date().getFullYear()} GuestBox Inc. All rights reserved. |{" "}
        <a href="https://guestbox.tv/contact" className="underline transition-colors hover:text-white">
          Contact Us
        </a>
      </div>
      </div>{/* end Zone 2 */}

      {completeState.status === "success" && completeState.redirectUrl && (
        <OrderSuccessModal redirectUrl={completeState.redirectUrl} accentColor={accentColor} />
      )}
    </div>
  );
}

function StepIndicator({ step, accentColor }: { step: 1 | 2 | 3; accentColor: string }) {
  const steps: { number: 1 | 2 | 3; label: string }[] = [
    { number: 1, label: "QTY" },
    { number: 2, label: "DETAILS" },
    { number: 3, label: "PAYMENT" },
  ];

  return (
    <div className="mx-auto flex w-full items-start justify-center">
      {steps.map((s, i) => {
        const isFirst = i === 0;
        const isLast = i === steps.length - 1;
        return (
          <div key={s.number} className={`flex items-start ${i < steps.length - 1 ? "flex-1" : ""}`}>
            <div
              className={`relative flex h-9 shrink-0 ${
                isFirst ? "w-12 justify-end" : isLast ? "w-12 justify-start" : "w-9"
              }`}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
                style={{ backgroundColor: s.number <= step ? accentColor : "rgba(255,255,255,0.25)" }}
              >
                {s.number}
              </div>
              <span
                className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 text-sm font-medium tracking-wide whitespace-nowrap text-white/90"
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="mt-[17px] h-0.5 flex-1"
                style={{ backgroundColor: s.number < step ? accentColor : "rgba(255,255,255,0.25)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CardBrandPill({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      title={label}
      aria-label={label}
      className="flex h-8 min-w-[3.25rem] items-center justify-center rounded-md border border-zinc-300 bg-white px-2 text-[10px] font-bold tracking-wide text-zinc-500"
    >
      {children}
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  value,
  onChange,
  errors,
  maxLength,
  inputMode,
  trailing,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  errors?: string[];
  maxLength?: number;
  inputMode?: "numeric";
  trailing?: React.ReactNode;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm text-[#18181a]">
        {label}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          inputMode={inputMode}
          placeholder={placeholder}
          className={`h-10 w-full rounded border px-3 transition-colors focus:border-zinc-400 focus:outline-none ${trailing ? "pr-10" : ""}`}
        />
        {trailing && <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">{trailing}</div>}
      </div>
      {errors?.[0] && <p className="mt-1 text-sm text-red-600">{errors[0]}</p>}
    </div>
  );
}

function SelectField({
  name,
  label,
  value,
  onChange,
  options,
  errors,
  placeholder,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  errors?: string[];
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm text-[#18181a]">
        {label}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded border bg-white px-3 transition-colors focus:border-zinc-400 focus:outline-none"
      >
        {placeholder && (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {errors?.[0] && <p className="mt-1 text-sm text-red-600">{errors[0]}</p>}
    </div>
  );
}
