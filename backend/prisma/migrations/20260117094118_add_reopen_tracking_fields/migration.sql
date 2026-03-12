-- AlterTable: Add reopen tracking fields to incidents table
ALTER TABLE "incidents"
  ADD COLUMN "reopen_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_reopened_at" TIMESTAMP,
  ADD COLUMN "last_reopened_by_id" INTEGER,
  ADD COLUMN "reopen_reason" TEXT;

-- AddForeignKey: Link last_reopened_by to users table
ALTER TABLE "incidents"
  ADD CONSTRAINT "incidents_last_reopened_by_id_fkey"
  FOREIGN KEY ("last_reopened_by_id")
  REFERENCES "users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- CreateIndex: Index for better query performance
CREATE INDEX "incidents_last_reopened_at_idx" ON "incidents"("last_reopened_at");
CREATE INDEX "incidents_reopen_count_idx" ON "incidents"("reopen_count");
