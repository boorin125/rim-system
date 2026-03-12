-- DropIndex
DROP INDEX "incidents_incident_code_key";

-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "ticket_number" TEXT,
ALTER COLUMN "incident_code" DROP NOT NULL;

-- Data Migration: Convert INC-YYYY-XXXX to WATYYMM0XXX format
-- Example: INC-2025-0001 -> WAT26010001 (January 2026)
UPDATE "incidents"
SET "ticket_number" =
  'WAT' ||
  SUBSTRING(EXTRACT(YEAR FROM "created_at")::TEXT FROM 3 FOR 2) ||
  LPAD(EXTRACT(MONTH FROM "created_at")::TEXT, 2, '0') ||
  LPAD(SUBSTRING("incident_code" FROM '\d+$'), 4, '0')
WHERE "incident_code" IS NOT NULL;

-- Add unique constraint to ticket_number
CREATE UNIQUE INDEX "incidents_ticket_number_key" ON "incidents"("ticket_number");
