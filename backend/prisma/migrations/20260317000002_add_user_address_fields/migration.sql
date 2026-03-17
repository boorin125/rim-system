-- AddColumn: sub_district, district, province to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sub_district" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "district" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "province" TEXT;
