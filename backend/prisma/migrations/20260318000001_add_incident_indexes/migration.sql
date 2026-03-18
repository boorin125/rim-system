-- Add performance indexes to incidents table
CREATE INDEX IF NOT EXISTS "incidents_status_idx" ON "incidents"("status");
CREATE INDEX IF NOT EXISTS "incidents_created_at_idx" ON "incidents"("created_at");
CREATE INDEX IF NOT EXISTS "incidents_priority_idx" ON "incidents"("priority");
CREATE INDEX IF NOT EXISTS "incidents_store_id_idx" ON "incidents"("store_id");
CREATE INDEX IF NOT EXISTS "incidents_category_idx" ON "incidents"("category");
CREATE INDEX IF NOT EXISTS "incidents_assignee_id_idx" ON "incidents"("assignee_id");
CREATE INDEX IF NOT EXISTS "incidents_status_created_at_idx" ON "incidents"("status", "created_at");
CREATE INDEX IF NOT EXISTS "incidents_status_priority_idx" ON "incidents"("status", "priority");
