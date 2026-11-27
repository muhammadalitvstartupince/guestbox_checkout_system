-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('draft', 'sent', 'paid', 'expired', 'voided');

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "token" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address_line1" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "country" TEXT,
    "subtotal_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3),
    "admin_notes" TEXT,
    "customer_notes" TEXT,
    "paid_at" TIMESTAMP(3),
    "card_last4" TEXT,
    "card_brand" TEXT,
    "card_number_encrypted" TEXT,
    "card_cvv_encrypted" TEXT,
    "card_expiry_encrypted" TEXT,
    "card_hash_key" TEXT NOT NULL DEFAULT '',
    "auth_net_response_code" TEXT,
    "auth_net_auth_code" TEXT,
    "auth_net_transaction_id" TEXT,
    "auth_net_message" TEXT,
    "zoho_synced" BOOLEAN NOT NULL DEFAULT false,
    "zoho_payload" JSONB,
    "zoho_response" JSONB,
    "status" "invoice_status" NOT NULL DEFAULT 'draft',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "checkout_page_id" UUID,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "zoho_item_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_events" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_token_key" ON "invoices"("token");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_checkout_page_id_fkey" FOREIGN KEY ("checkout_page_id") REFERENCES "checkout_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_events" ADD CONSTRAINT "invoice_events_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
