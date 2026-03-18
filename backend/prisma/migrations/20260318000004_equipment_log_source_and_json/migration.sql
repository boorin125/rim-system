-- CreateEnum
CREATE TYPE "EquipmentLogSource" AS ENUM ('MANUAL', 'PM', 'INCIDENT', 'IMPORT', 'RETIREMENT');

-- AlterEnum
ALTER TYPE "EquipmentLogAction" ADD VALUE 'COMPONENT_REPLACED';

-- AlterTable: change old_value/new_value from TEXT to JSONB, add source + source_id
ALTER TABLE "equipment_logs"
  ADD COLUMN "source"    "EquipmentLogSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "source_id" TEXT;

-- Convert existing text columns to JSONB (wrap plain text in JSON string if not already JSON)
ALTER TABLE "equipment_logs"
  ALTER COLUMN "old_value" TYPE JSONB USING
    CASE WHEN "old_value" IS NULL THEN NULL
         WHEN "old_value" ~ '^[\[{"]' THEN "old_value"::JSONB
         ELSE to_jsonb("old_value")
    END,
  ALTER COLUMN "new_value" TYPE JSONB USING
    CASE WHEN "new_value" IS NULL THEN NULL
         WHEN "new_value" ~ '^[\[{"]' THEN "new_value"::JSONB
         ELSE to_jsonb("new_value")
    END;

-- CreateIndex
CREATE INDEX "equipment_logs_source_idx" ON "equipment_logs"("source");
