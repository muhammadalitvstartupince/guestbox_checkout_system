-- Convert admin_users.role from free-text to a fixed AdminRole enum
-- (admin | editor). Existing values are cast in place rather than
-- dropped/recreated, so current rows (all "admin" today) keep their role.
CREATE TYPE "admin_role" AS ENUM ('admin', 'editor');

ALTER TABLE "admin_users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "admin_users" ALTER COLUMN "role" TYPE "admin_role" USING ("role"::"admin_role");
ALTER TABLE "admin_users" ALTER COLUMN "role" SET DEFAULT 'admin';
