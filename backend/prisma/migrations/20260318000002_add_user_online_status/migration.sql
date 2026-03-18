-- Add online status tracking to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_online" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_login_today_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "users_is_online_idx" ON "users"("is_online");
