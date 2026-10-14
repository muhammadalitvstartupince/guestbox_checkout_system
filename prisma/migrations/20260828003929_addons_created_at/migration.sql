-- The old checkout_addons table (now renamed to addons) never had a
-- created_at column; the new global Addon model adds one.
ALTER TABLE "addons" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
