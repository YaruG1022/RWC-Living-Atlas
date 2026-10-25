def ensure_card_link_schema(cursor):
    """Prepare storage at startup; backfill legacy source identities only once."""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS CardArcGISLinks (
            id SERIAL PRIMARY KEY,
            card_id INTEGER NOT NULL REFERENCES Cards(CardID) ON DELETE CASCADE,
            service_key TEXT NOT NULL, layer_id INTEGER, sublayer_index INTEGER,
            display_name TEXT NOT NULL, item_type TEXT NOT NULL,
            state_code TEXT NOT NULL, folder_name TEXT NOT NULL,
            is_visible BOOLEAN NOT NULL DEFAULT FALSE
        );
        ALTER TABLE CardArcGISLinks ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT FALSE;
    """)
    cursor.execute("""SELECT EXISTS (
        SELECT 1 FROM pg_attribute WHERE attrelid='CardArcGISLinks'::regclass
        AND attname='custom_layer_id' AND NOT attisdropped
    )""")
    if cursor.fetchone()[0]:
        return
    cursor.execute("""
        ALTER TABLE CardArcGISLinks ADD COLUMN custom_layer_id INTEGER
            REFERENCES user_custom_layers(id) ON DELETE SET NULL;
        UPDATE CardArcGISLinks link SET custom_layer_id=custom.id
        FROM Cards card, Users owner, user_custom_layers custom
        WHERE link.card_id=card.CardID AND card.UserID=owner.UserID
            AND custom.user_email=owner.Email AND custom.service_key=link.service_key
            AND link.item_type='uploaded_custom' AND link.custom_layer_id IS NULL;
        WITH unique_sources AS (
            SELECT service_key, MIN(id) AS asset_id FROM user_custom_layers
            GROUP BY service_key HAVING COUNT(*)=1
        )
        UPDATE CardArcGISLinks link SET custom_layer_id=source.asset_id
        FROM unique_sources source WHERE link.custom_layer_id IS NULL
            AND link.item_type='uploaded_custom' AND link.service_key=source.service_key;
    """)
