-- Originals are immutable; display framing never crops the stored source.
ALTER TABLE CardImages ADD COLUMN IF NOT EXISTS OriginalURL TEXT;
ALTER TABLE CardImages ADD COLUMN IF NOT EXISTS ImageWidth INT;
ALTER TABLE CardImages ADD COLUMN IF NOT EXISTS ImageHeight INT;
ALTER TABLE CardImages ADD COLUMN IF NOT EXISTS Presentation JSONB;
ALTER TABLE CardImages ADD COLUMN IF NOT EXISTS UploadToken VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS cardimages_upload_token ON CardImages (CardID, UploadToken);
