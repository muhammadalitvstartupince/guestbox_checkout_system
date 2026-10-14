-- CreateTable
CREATE TABLE "checkout_page_logs" (
    "id" UUID NOT NULL,
    "checkout_page_id" UUID NOT NULL,
    "admin_user_id" UUID,
    "action" TEXT NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkout_page_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "checkout_page_logs" ADD CONSTRAINT "checkout_page_logs_checkout_page_id_fkey" FOREIGN KEY ("checkout_page_id") REFERENCES "checkout_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_page_logs" ADD CONSTRAINT "checkout_page_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
