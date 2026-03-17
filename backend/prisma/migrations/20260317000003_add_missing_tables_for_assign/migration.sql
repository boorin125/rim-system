-- Migration: Add all missing tables/columns/enums for assign flow
-- Safe to run even if some items already exist (uses IF NOT EXISTS / DO blocks)

-- =========================================================
-- 1. Create SlaRegion enum (if missing)
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SlaRegion') THEN
    CREATE TYPE "SlaRegion" AS ENUM ('BANGKOK_METRO', 'PROVINCIAL');
  END IF;
END $$;

-- =========================================================
-- 2. Create ResolutionType enum (if missing)
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ResolutionType') THEN
    CREATE TYPE "ResolutionType" AS ENUM ('PHONE_SUPPORT', 'REMOTE_SUPPORT', 'ONSITE');
  END IF;
END $$;

-- =========================================================
-- 3. Create TechnicianType enum (if missing)
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TechnicianType') THEN
    CREATE TYPE "TechnicianType" AS ENUM ('INSOURCE', 'OUTSOURCE');
  END IF;
END $$;

-- =========================================================
-- 4. Create StoreType enum (if missing)
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StoreType') THEN
    CREATE TYPE "StoreType" AS ENUM ('PERMANENT', 'POP_UP', 'SEASONAL');
  END IF;
END $$;

-- =========================================================
-- 5. Create IncidentAction enum (if missing)
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncidentAction') THEN
    CREATE TYPE "IncidentAction" AS ENUM (
      'CREATED', 'UPDATED', 'STATUS_CHANGED', 'ASSIGNED', 'REASSIGNED',
      'UNASSIGNED', 'TECHNICIAN_RESPONDED', 'CHECKED_IN', 'RESOLVED',
      'RESOLUTION_UPDATED', 'TECH_CONFIRMED', 'CONFIRMED', 'CLOSED',
      'REOPENED', 'CANCELLED', 'COMMENTED', 'DELETED',
      'RETURN_JOB_CREATED', 'DIRECT_CLOSED', 'REQUESTED_ONSITE'
    );
  END IF;
END $$;

-- =========================================================
-- 6. Create NotificationType enum (if missing)
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
    CREATE TYPE "NotificationType" AS ENUM (
      'INCIDENT_CREATED', 'INCIDENT_ASSIGNED', 'INCIDENT_REASSIGNED',
      'INCIDENT_RESPONDED', 'INCIDENT_CHECKED_IN', 'INCIDENT_RESOLVED',
      'INCIDENT_CONFIRMED', 'INCIDENT_REOPENED', 'INCIDENT_CANCELLED',
      'COMMENT_ADDED', 'STATUS_CHANGED', 'SYSTEM_ALERT',
      'SLA_WARNING', 'SLA_BREACH', 'NEW_USER_REGISTERED'
    );
  END IF;
END $$;

-- =========================================================
-- 7. Add missing values to NotificationType (if already exists but missing values)
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'INCIDENT_ASSIGNED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'INCIDENT_ASSIGNED';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'INCIDENT_REASSIGNED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'INCIDENT_REASSIGNED';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SLA_WARNING' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'SLA_WARNING';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SLA_BREACH' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'SLA_BREACH';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'NEW_USER_REGISTERED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'NEW_USER_REGISTERED';
  END IF;
END $$;

-- =========================================================
-- 8. Add missing columns to users table
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'department') THEN
    ALTER TABLE "users" ADD COLUMN "department" TEXT;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'technician_type') THEN
    ALTER TABLE "users" ADD COLUMN "technician_type" "TechnicianType";
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'service_center') THEN
    ALTER TABLE "users" ADD COLUMN "service_center" TEXT;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'responsible_provinces') THEN
    ALTER TABLE "users" ADD COLUMN "responsible_provinces" TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar_path') THEN
    ALTER TABLE "users" ADD COLUMN "avatar_path" TEXT;
  END IF;
END $$;

-- =========================================================
-- 9. Add missing columns to stores table
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'sla_region') THEN
    ALTER TABLE "stores" ADD COLUMN "sla_region" "SlaRegion" NOT NULL DEFAULT 'BANGKOK_METRO';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'company') THEN
    ALTER TABLE "stores" ADD COLUMN "company" TEXT;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'area') THEN
    ALTER TABLE "stores" ADD COLUMN "area" TEXT;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'email') THEN
    ALTER TABLE "stores" ADD COLUMN "email" TEXT;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'store_type') THEN
    ALTER TABLE "stores" ADD COLUMN "store_type" "StoreType" NOT NULL DEFAULT 'PERMANENT';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'circuit_id') THEN
    ALTER TABLE "stores" ADD COLUMN "circuit_id" TEXT;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'router_ip') THEN
    ALTER TABLE "stores" ADD COLUMN "router_ip" TEXT;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'switch_ip') THEN
    ALTER TABLE "stores" ADD COLUMN "switch_ip" TEXT;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'access_point_ip') THEN
    ALTER TABLE "stores" ADD COLUMN "access_point_ip" TEXT;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'pc_server_ip') THEN
    ALTER TABLE "stores" ADD COLUMN "pc_server_ip" TEXT;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'pos_ip') THEN
    ALTER TABLE "stores" ADD COLUMN "pos_ip" TEXT;
  END IF;
END $$;

-- =========================================================
-- 10. Add missing columns to incidents table
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'resolution_type') THEN
    ALTER TABLE "incidents" ADD COLUMN "resolution_type" "ResolutionType";
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'scheduled_at') THEN
    ALTER TABLE "incidents" ADD COLUMN "scheduled_at" TIMESTAMP(3);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'scheduled_reason') THEN
    ALTER TABLE "incidents" ADD COLUMN "scheduled_reason" TEXT;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'ticket_number') THEN
    ALTER TABLE "incidents" ADD COLUMN "ticket_number" TEXT;
  END IF;
END $$;

-- =========================================================
-- 11. Create user_role_assignments table (if missing)
-- =========================================================
CREATE TABLE IF NOT EXISTS "user_role_assignments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'user_role_assignments' AND constraint_name = 'user_role_assignments_user_id_fkey') THEN
    ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "user_role_assignments_user_id_role_key" ON "user_role_assignments"("user_id", "role");
CREATE INDEX IF NOT EXISTS "user_role_assignments_user_id_idx" ON "user_role_assignments"("user_id");
CREATE INDEX IF NOT EXISTS "user_role_assignments_role_idx" ON "user_role_assignments"("role");

-- =========================================================
-- 12. Create incident_assignees table (if missing)
-- =========================================================
CREATE TABLE IF NOT EXISTS "incident_assignees" (
    "id" SERIAL NOT NULL,
    "incident_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked_in_at" TIMESTAMP(3),
    "check_in_latitude" DOUBLE PRECISION,
    "check_in_longitude" DOUBLE PRECISION,
    CONSTRAINT "incident_assignees_pkey" PRIMARY KEY ("id")
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'incident_assignees' AND constraint_name = 'incident_assignees_incident_id_fkey') THEN
    ALTER TABLE "incident_assignees" ADD CONSTRAINT "incident_assignees_incident_id_fkey"
      FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'incident_assignees' AND constraint_name = 'incident_assignees_user_id_fkey') THEN
    ALTER TABLE "incident_assignees" ADD CONSTRAINT "incident_assignees_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
-- Add missing columns to incident_assignees if table existed without them
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incident_assignees' AND column_name = 'checked_in_at') THEN
    ALTER TABLE "incident_assignees" ADD COLUMN "checked_in_at" TIMESTAMP(3);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incident_assignees' AND column_name = 'check_in_latitude') THEN
    ALTER TABLE "incident_assignees" ADD COLUMN "check_in_latitude" DOUBLE PRECISION;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incident_assignees' AND column_name = 'check_in_longitude') THEN
    ALTER TABLE "incident_assignees" ADD COLUMN "check_in_longitude" DOUBLE PRECISION;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "incident_assignees_incident_id_user_id_key" ON "incident_assignees"("incident_id", "user_id");
CREATE INDEX IF NOT EXISTS "incident_assignees_incident_id_idx" ON "incident_assignees"("incident_id");
CREATE INDEX IF NOT EXISTS "incident_assignees_user_id_idx" ON "incident_assignees"("user_id");

-- =========================================================
-- 13. Create incident_history table (if missing)
-- =========================================================
CREATE TABLE IF NOT EXISTS "incident_history" (
    "id" SERIAL NOT NULL,
    "incident_id" TEXT NOT NULL,
    "user_id" INTEGER,
    "action" "IncidentAction" NOT NULL,
    "old_status" "IncidentStatus",
    "new_status" "IncidentStatus",
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incident_history_pkey" PRIMARY KEY ("id")
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'incident_history' AND constraint_name = 'incident_history_incident_id_fkey') THEN
    ALTER TABLE "incident_history" ADD CONSTRAINT "incident_history_incident_id_fkey"
      FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'incident_history' AND constraint_name = 'incident_history_user_id_fkey') THEN
    ALTER TABLE "incident_history" ADD CONSTRAINT "incident_history_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "incident_history_incident_id_idx" ON "incident_history"("incident_id");
CREATE INDEX IF NOT EXISTS "incident_history_user_id_idx" ON "incident_history"("user_id");
CREATE INDEX IF NOT EXISTS "incident_history_created_at_idx" ON "incident_history"("created_at");

-- =========================================================
-- 14. Create notifications table (if missing)
-- =========================================================
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "incident_id" TEXT,
    "link" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'notifications' AND constraint_name = 'notifications_user_id_fkey') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'notifications' AND constraint_name = 'notifications_incident_id_fkey') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_incident_id_fkey"
      FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
-- Add link column if notifications table existed without it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'link') THEN
    ALTER TABLE "notifications" ADD COLUMN "link" TEXT;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications"("user_id");
CREATE INDEX IF NOT EXISTS "notifications_incident_id_idx" ON "notifications"("incident_id");
CREATE INDEX IF NOT EXISTS "notifications_is_read_idx" ON "notifications"("is_read");
CREATE INDEX IF NOT EXISTS "notifications_created_at_idx" ON "notifications"("created_at");
