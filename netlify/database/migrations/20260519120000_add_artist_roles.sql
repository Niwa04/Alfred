ALTER TABLE members
ADD COLUMN IF NOT EXISTS artist_roles JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE planning_events
ADD COLUMN IF NOT EXISTS target_roles JSONB NOT NULL DEFAULT '[]'::jsonb;
