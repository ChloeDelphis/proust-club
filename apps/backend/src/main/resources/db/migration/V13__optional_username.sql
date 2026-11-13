-- Public identity is collected only when a social feature needs it.
ALTER TABLE users ALTER COLUMN username DROP NOT NULL;
