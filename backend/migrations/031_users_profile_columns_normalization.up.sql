-- Normalization patch:
-- Some environments may have skipped historical lower-numbered migrations
-- that introduced profile columns. Ensure required columns exist.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS full_name TEXT,
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;
