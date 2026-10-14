-- CreateEnum
CREATE TYPE "checkout_page_type" AS ENUM ('normal', 'sales');

-- CreateEnum
CREATE TYPE "billing_interval" AS ENUM ('monthly', 'annually', 'none');

-- CreateEnum
CREATE TYPE "checkout_page_status" AS ENUM ('draft', 'live', 'archived');

-- CreateEnum
CREATE TYPE "discount_type" AS ENUM ('percent', 'fixed');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('pending', 'paid', 'failed');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skins" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout_pages" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "checkout_page_type" NOT NULL DEFAULT 'normal',
    "title" TEXT NOT NULL,
    "skin_id" UUID NOT NULL,
    "zoho_item_id" TEXT,
    "zoho_recurring_item_id" TEXT,
    "base_price_cents" INTEGER NOT NULL,
    "recurring_price_cents" INTEGER,
    "billing_interval" "billing_interval" NOT NULL DEFAULT 'none',
    "show_promo_code" BOOLEAN NOT NULL DEFAULT false,
    "success_redirect_url" TEXT NOT NULL,
    "fail_redirect_url" TEXT NOT NULL,
    "webhook_url" TEXT,
    "status" "checkout_page_status" NOT NULL DEFAULT 'draft',
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkout_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout_addons" (
    "id" UUID NOT NULL,
    "checkout_page_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_cents" INTEGER NOT NULL,
    "zoho_item_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "checkout_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "discount_type" "discount_type" NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "applies_to_checkout_page_id" UUID,
    "max_redemptions" INTEGER,
    "times_redeemed" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "checkout_page_id" UUID NOT NULL,
    "promo_code_id" UUID,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address_line1" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "card_last4" TEXT NOT NULL,
    "card_brand" TEXT,
    "card_number_encrypted" TEXT NOT NULL,
    "card_cvv_encrypted" TEXT NOT NULL,
    "card_hash_key" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amount_cents" INTEGER NOT NULL,
    "recurring_amount_cents" INTEGER,
    "auth_net_response_code" TEXT,
    "auth_net_auth_code" TEXT,
    "auth_net_transaction_id" TEXT,
    "auth_net_message" TEXT,
    "status" "order_status" NOT NULL DEFAULT 'pending',
    "zoho_synced" BOOLEAN NOT NULL DEFAULT false,
    "zoho_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_addons" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "checkout_addon_id" UUID NOT NULL,
    "price_cents" INTEGER NOT NULL,

    CONSTRAINT "order_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_access_audit_log" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,

    CONSTRAINT "card_access_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "skins_slug_key" ON "skins"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "checkout_pages_slug_key" ON "checkout_pages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- AddForeignKey
ALTER TABLE "checkout_pages" ADD CONSTRAINT "checkout_pages_skin_id_fkey" FOREIGN KEY ("skin_id") REFERENCES "skins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_pages" ADD CONSTRAINT "checkout_pages_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_addons" ADD CONSTRAINT "checkout_addons_checkout_page_id_fkey" FOREIGN KEY ("checkout_page_id") REFERENCES "checkout_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_applies_to_checkout_page_id_fkey" FOREIGN KEY ("applies_to_checkout_page_id") REFERENCES "checkout_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_checkout_page_id_fkey" FOREIGN KEY ("checkout_page_id") REFERENCES "checkout_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_addons" ADD CONSTRAINT "order_addons_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_addons" ADD CONSTRAINT "order_addons_checkout_addon_id_fkey" FOREIGN KEY ("checkout_addon_id") REFERENCES "checkout_addons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_access_audit_log" ADD CONSTRAINT "card_access_audit_log_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_access_audit_log" ADD CONSTRAINT "card_access_audit_log_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
