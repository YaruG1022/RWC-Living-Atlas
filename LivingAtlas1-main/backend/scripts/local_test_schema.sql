-- Columns in the current app that are absent from the original base schema.
ALTER TABLE Cards ADD COLUMN IF NOT EXISTS Name VARCHAR(255);
ALTER TABLE Cards ADD COLUMN IF NOT EXISTS Thumbnail_Link TEXT;
ALTER TABLE Files ADD COLUMN IF NOT EXISTS file_link TEXT;
