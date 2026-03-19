-- Add visibleToRoles column to knowledge_articles
-- Empty array = visible to all roles; non-empty = only roles listed (and higher roles) can see

ALTER TABLE knowledge_articles
  ADD COLUMN IF NOT EXISTS visible_to_roles "UserRole"[] NOT NULL DEFAULT '{}';
