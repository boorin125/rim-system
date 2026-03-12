-- AlterTable: Make ticket_number NOT NULL and drop incident_code
ALTER TABLE "incidents"
  ALTER COLUMN "ticket_number" SET NOT NULL,
  DROP COLUMN "incident_code";
