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
    # Migrate the former shared flag only to the creator's personal preference.
    # Run the seed once, so restarts never undo a user's explicit hidden choice.
    cursor.execute("SELECT to_regclass('card_link_visibility') IS NOT NULL")
    visibility_exists = cursor.fetchone()[0]
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS card_link_visibility (
            link_id INTEGER NOT NULL REFERENCES CardArcGISLinks(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
            is_visible BOOLEAN NOT NULL DEFAULT FALSE,
            PRIMARY KEY (link_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS card_link_visibility_user_idx ON card_link_visibility(user_id);
    """)
    if not visibility_exists:
        cursor.execute("""
            INSERT INTO card_link_visibility (link_id,user_id,is_visible)
            SELECT link.id,card.UserID,TRUE FROM CardArcGISLinks link
            JOIN Cards card ON card.CardID=link.card_id WHERE link.is_visible
            ON CONFLICT (link_id,user_id) DO NOTHING
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
