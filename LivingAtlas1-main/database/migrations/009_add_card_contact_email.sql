-- A project contact need not be the account that owns the card.
-- NULL preserves the existing owner's email as the display fallback.
ALTER TABLE Cards ADD COLUMN IF NOT EXISTS ContactEmail VARCHAR(255);
