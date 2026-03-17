-- Migration: Fix auto-increment sequences for tables that may have been pre-populated
-- Resets sequences to MAX(id)+1 to prevent unique constraint violations on id

DO $$
DECLARE
  tbl TEXT;
  seq TEXT;
  max_id BIGINT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'incident_assignees',
    'incident_history',
    'notifications',
    'user_role_assignments',
    'audit_logs',
    'equipment_retirement_requests',
    'comments',
    'spare_parts'
  ]) LOOP
    -- Check if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
      -- Get the sequence name
      seq := pg_get_serial_sequence(tbl, 'id');
      IF seq IS NOT NULL THEN
        EXECUTE format('SELECT COALESCE(MAX(id), 0) FROM %I', tbl) INTO max_id;
        PERFORM setval(seq, max_id + 1, false);
      END IF;
    END IF;
  END LOOP;
END $$;
