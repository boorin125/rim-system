-- Migration: Fix equipment table + add missing tables for production
-- This migration is safe to run even if some changes already exist (uses IF NOT EXISTS / DO blocks)

-- =========================================================
-- 1. Fix equipment.category: ENUM → TEXT
-- =========================================================
DO $$
BEGIN
  -- Check if category column is still an enum type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment'
      AND column_name = 'category'
      AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE "equipment" ALTER COLUMN "category" TYPE TEXT;
  END IF;
END $$;

-- =========================================================
-- 2. Add ip_address column to equipment (if missing)
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE "equipment" ADD COLUMN "ip_address" TEXT;
  END IF;
END $$;

-- =========================================================
-- 3. Add image_path column to equipment (if missing)
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'image_path'
  ) THEN
    ALTER TABLE "equipment" ADD COLUMN "image_path" TEXT;
  END IF;
END $$;

-- =========================================================
-- 4. Add REPLACED_OUT, REPLACED_IN to EquipmentLogAction enum (if missing)
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'REPLACED_OUT'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'EquipmentLogAction')
  ) THEN
    ALTER TYPE "EquipmentLogAction" ADD VALUE 'REPLACED_OUT';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'REPLACED_IN'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'EquipmentLogAction')
  ) THEN
    ALTER TYPE "EquipmentLogAction" ADD VALUE 'REPLACED_IN';
  END IF;
END $$;

-- =========================================================
-- 5. Create AuditModule enum (if missing)
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuditModule') THEN
    CREATE TYPE "AuditModule" AS ENUM ('INCIDENT', 'STORE', 'EQUIPMENT', 'USER', 'SYSTEM');
  END IF;
END $$;

-- =========================================================
-- 6. Create AuditAction enum (if missing)
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuditAction') THEN
    CREATE TYPE "AuditAction" AS ENUM (
      'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'ASSIGN', 'REASSIGN',
      'RESOLVE', 'CONFIRM', 'REOPEN', 'CANCEL', 'TRANSFER',
      'IMPORT', 'EXPORT', 'LOGIN', 'LOGOUT'
    );
  END IF;
END $$;

-- =========================================================
-- 7. Create audit_logs table (if missing)
-- =========================================================
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" SERIAL NOT NULL,
    "module" "AuditModule" NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Add foreign key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'audit_logs' AND constraint_name = 'audit_logs_user_id_fkey'
  ) THEN
    ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes for audit_logs
CREATE INDEX IF NOT EXISTS "audit_logs_module_idx" ON "audit_logs"("module");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- =========================================================
-- 8. Add equipment_retirement_requests table (if missing)
-- =========================================================
CREATE TABLE IF NOT EXISTS "equipment_retirement_requests" (
    "id" SERIAL NOT NULL,
    "equipment_id" INTEGER NOT NULL,
    "requested_by" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approved_by" INTEGER,
    "approval_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "equipment_retirement_requests_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'equipment_retirement_requests'
      AND constraint_name = 'equipment_retirement_requests_equipment_id_fkey'
  ) THEN
    ALTER TABLE "equipment_retirement_requests"
      ADD CONSTRAINT "equipment_retirement_requests_equipment_id_fkey"
      FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'equipment_retirement_requests'
      AND constraint_name = 'equipment_retirement_requests_requested_by_fkey'
  ) THEN
    ALTER TABLE "equipment_retirement_requests"
      ADD CONSTRAINT "equipment_retirement_requests_requested_by_fkey"
      FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "equipment_retirement_requests_equipment_id_idx"
  ON "equipment_retirement_requests"("equipment_id");
CREATE INDEX IF NOT EXISTS "equipment_retirement_requests_requested_by_idx"
  ON "equipment_retirement_requests"("requested_by");
CREATE INDEX IF NOT EXISTS "equipment_retirement_requests_status_idx"
  ON "equipment_retirement_requests"("status");
