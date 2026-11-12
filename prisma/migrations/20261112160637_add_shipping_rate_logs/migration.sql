-- CreateTable
CREATE TABLE "shipping_rate_logs" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "request" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_rate_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "shipping_rate_logs" ADD CONSTRAINT "shipping_rate_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
