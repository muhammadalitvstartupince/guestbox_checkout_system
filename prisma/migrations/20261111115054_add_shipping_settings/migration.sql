-- CreateTable
CREATE TABLE "shipping_settings" (
    "id" UUID NOT NULL,
    "warehouse_name" TEXT NOT NULL,
    "warehouse_street" TEXT NOT NULL,
    "warehouse_city" TEXT NOT NULL,
    "warehouse_state" TEXT NOT NULL,
    "warehouse_zip" TEXT NOT NULL,
    "warehouse_country" TEXT NOT NULL,
    "warehouse_phone" TEXT NOT NULL,
    "max_devices_per_box" INTEGER NOT NULL DEFAULT 20,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_package_tiers" (
    "id" UUID NOT NULL,
    "shipping_settings_id" UUID NOT NULL,
    "min_qty" INTEGER NOT NULL,
    "max_qty" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "length_in" DECIMAL(5,2) NOT NULL,
    "width_in" DECIMAL(5,2) NOT NULL,
    "height_in" DECIMAL(5,2) NOT NULL,
    "max_weight_lb" DECIMAL(5,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "shipping_package_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_weight_entries" (
    "id" UUID NOT NULL,
    "shipping_settings_id" UUID NOT NULL,
    "qty" INTEGER NOT NULL,
    "weight_lb" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "shipping_weight_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipping_weight_entries_shipping_settings_id_qty_key" ON "shipping_weight_entries"("shipping_settings_id", "qty");

-- AddForeignKey
ALTER TABLE "shipping_package_tiers" ADD CONSTRAINT "shipping_package_tiers_shipping_settings_id_fkey" FOREIGN KEY ("shipping_settings_id") REFERENCES "shipping_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_weight_entries" ADD CONSTRAINT "shipping_weight_entries_shipping_settings_id_fkey" FOREIGN KEY ("shipping_settings_id") REFERENCES "shipping_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default shipping settings
INSERT INTO "shipping_settings" ("id", "warehouse_name", "warehouse_street", "warehouse_city", "warehouse_state", "warehouse_zip", "warehouse_country", "warehouse_phone", "max_devices_per_box", "updated_at")
VALUES ('a0000000-0000-0000-0000-000000000001', 'GuestBox Fulfillment', '10045 County Road 254', 'Clyde', 'TX', '79510-6003', 'US', '+13259990000', 20, NOW());

-- Seed package tiers
INSERT INTO "shipping_package_tiers" ("id", "shipping_settings_id", "min_qty", "max_qty", "label", "length_in", "width_in", "height_in", "max_weight_lb", "sort_order") VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 1,  1,  'Small bubble mailer',   12,   8.5,  2,  2,  0),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 2,  2,  'Small bubble mailer',   12,   8.5,  4,  2,  1),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 3,  6,  'Large bubble mailer',   20,   14.5, 4,  5,  2),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 7,  14, 'Box',                   12,   12,   12, 12, 3),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 15, 20, 'GuestBox Original Box', 19,   9,    8,  15, 4);

-- Seed weight table (packed weight per device count)
INSERT INTO "shipping_weight_entries" ("id", "shipping_settings_id", "qty", "weight_lb") VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 1,  0.7),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 2,  1.5),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 3,  2.4),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 4,  3.1),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 5,  3.8),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 6,  4.5),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 7,  6.0),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 8,  6.7),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 9,  7.4),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 10, 8.1),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 11, 8.8),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 12, 9.5),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 13, 10.3),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 14, 11.0),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 15, 11.5),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 16, 12.2),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 17, 12.9),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 18, 13.6),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 19, 14.3),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 20, 15.0);
