import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/lib/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { DEFAULT_EMAIL_SETTINGS } from "../src/lib/email/settings";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  // One skin, styled like the Roku hero mockup (full-bleed background photo
  // + logo). CheckoutForm switches into the hero layout automatically
  // whenever a skin's config has backgroundImageUrl set.
  const skin = await prisma.skin.upsert({
    where: { slug: "default" },
    update: {
      name: "Default",
      config: {
        colors: { primary: "#0d1b2a", accent: "#00b4d8", success: "#28a745", danger: "#ef4444" },
        font: "Arial, sans-serif",
        backgroundImageUrl: "/pages_Images/AdobeStock_415564278-1.jpeg",
        logoUrl: "/pages_Images/GuestBox-Logo-5v2.png",
      },
    },
    create: {
      slug: "default",
      name: "Default",
      config: {
        colors: { primary: "#0d1b2a", accent: "#00b4d8", success: "#28a745", danger: "#ef4444" },
        font: "Arial, sans-serif",
        backgroundImageUrl: "/pages_Images/AdobeStock_415564278-1.jpeg",
        logoUrl: "/pages_Images/GuestBox-Logo-5v2.png",
      },
    },
  });

  // Modeled on the legacy Roku+Apple sales page (__docs/roku-apple-14thJulySale-2026-order-form.php)
  // — the first real checkout page to migrate, per docs/checkout-system-plan.md §12 item 7.
  // Recurring price is a placeholder until the real monthly plan price is confirmed.
  const checkoutPage = await prisma.checkoutPage.upsert({
    where: { slug: "roku-apple-launch-package" },
    update: {},
    create: {
      slug: "roku-apple-launch-package",
      type: "sales",
      title: "Roku + Apple TV Channel Launch Package",
      mockupImageUrl: "/pages_Images/3-Beginners-Device.png",
      skinId: skin.id,
      zohoItemId: "1298609000079595342",
      zohoRecurringItemId: "1298609000079595342",
      basePriceCents: 129900,
      recurringPriceCents: 4900,
      billingInterval: "monthly",
      showPromoCode: true,
      successRedirectUrl: "https://tvstartup.com/welcome",
      failRedirectUrl: "https://tvstartup.com/channel-launch-package-1/",
      status: "draft",
    },
  });

  // Price tiers — quantity-based pricing for the checkout page.
  const tierCount = await prisma.priceTier.count({ where: { checkoutPageId: checkoutPage.id } });
  if (tierCount === 0) {
    await prisma.priceTier.createMany({
      data: [
        { checkoutPageId: checkoutPage.id, minQty: 1, maxQty: 4, priceCents: 14900, zohoItemId: "1298609000079595342", isBase: true, sortOrder: 0 },
        { checkoutPageId: checkoutPage.id, minQty: 5, maxQty: 9, priceCents: 13900, zohoItemId: "1298609000079595342", sortOrder: 1 },
        { checkoutPageId: checkoutPage.id, minQty: 10, maxQty: null, priceCents: 12900, zohoItemId: "1298609000079595342", sortOrder: 2 },
      ],
    });
    console.log("Seeded 3 price tiers for the sample checkout page.");
  }

  // Billing plans — monthly/annual recurring options.
  const planCount = await prisma.billingPlan.count({ where: { checkoutPageId: checkoutPage.id } });
  if (planCount === 0) {
    await prisma.billingPlan.createMany({
      data: [
        { checkoutPageId: checkoutPage.id, interval: "monthly", label: "Monthly Plan", priceCents: 2400, chargeAtCheckout: false, isDefault: true, sortOrder: 0 },
        { checkoutPageId: checkoutPage.id, interval: "annually", label: "Annual Plan", priceCents: 24900, chargeAtCheckout: true, isDefault: false, sortOrder: 1 },
      ],
    });
    console.log("Seeded 2 billing plans for the sample checkout page.");
  }

  // Add-ons are a global pool now — only seed them (and attach to the
  // sample page) if none exist yet, so re-running never duplicates or
  // clobbers admin-managed add-ons.
  const addonCount = await prisma.addon.count();
  if (addonCount === 0) {
    const [channelBranding, appleTvAddon, expedite] = await Promise.all([
      prisma.addon.create({
        data: {
          name: "Channel Branding",
          description: "Custom branded channel design",
          priceCents: 9900,
          zohoItemId: "1298609000054849105",
        },
      }),
      prisma.addon.create({
        data: {
          name: "Apple TV Add-On",
          description: "Expand your channel to Apple TV",
          priceCents: 9900,
          zohoItemId: "1298609000062490049",
        },
      }),
      prisma.addon.create({
        data: { name: "Expedite My Order", description: "Priority processing for faster launch", priceCents: 7900 },
      }),
    ]);

    await prisma.checkoutPageAddon.createMany({
      data: [
        { checkoutPageId: checkoutPage.id, addonId: channelBranding.id, sortOrder: 0 },
        { checkoutPageId: checkoutPage.id, addonId: appleTvAddon.id, sortOrder: 1 },
        { checkoutPageId: checkoutPage.id, addonId: expedite.id, sortOrder: 2 },
      ],
    });
    console.log("Seeded 3 global add-ons and attached them to the sample checkout page.");
  }

  await prisma.promoCode.upsert({
    where: { code: "WELCOME10" },
    update: {},
    create: {
      code: "WELCOME10",
      discountType: "percent",
      discountValue: 10,
      appliesToCheckoutPageId: checkoutPage.id,
      isActive: true,
    },
  });

  console.log(`Seeded skin "${skin.slug}", checkout page "${checkoutPage.slug}", and promo code "WELCOME10".`);

  const adminEmail = process.env.ADMIN_SEED_EMAIL;
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await hashPassword(adminPassword);
    const admin = await prisma.adminUser.upsert({
      where: { email: adminEmail.toLowerCase() },
      update: {},
      create: {
        email: adminEmail.toLowerCase(),
        passwordHash,
        name: "Admin",
        role: "admin",
      },
    });
    console.log(`Seeded admin user "${admin.email}" (password set from ADMIN_SEED_PASSWORD).`);
  } else {
    console.log("ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD not set — skipped admin user seed.");
  }

  // Singleton row, admin-editable from here on — only create it if it
  // doesn't exist yet, so re-running the seed never clobbers admin edits.
  const existingEmailSettings = await prisma.emailSettings.findFirst();
  if (!existingEmailSettings) {
    await prisma.emailSettings.create({ data: DEFAULT_EMAIL_SETTINGS });
    console.log("Seeded default email settings row.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
