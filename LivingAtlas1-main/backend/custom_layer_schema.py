"""Custom-layer schema changes run once at backend startup, never per request."""


def ensure_custom_layer_schema(cursor):
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_custom_layers (
            id SERIAL PRIMARY KEY,
            user_email VARCHAR(255) NOT NULL,
            service_key VARCHAR(255) NOT NULL,
            label VARCHAR(255) NOT NULL,
            url TEXT NOT NULL,
            folder VARCHAR(255) DEFAULT 'Root',
            type VARCHAR(50) NOT NULL DEFAULT 'MapServer',
            state VARCHAR(50) DEFAULT '',
            sort_order INTEGER DEFAULT 0,
            layer_order TEXT DEFAULT NULL,
            geojson TEXT DEFAULT NULL,
            saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_user_custom_layer UNIQUE (user_email, service_key)
        );
        ALTER TABLE user_custom_layers
            ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
        ALTER TABLE user_custom_layers
            ADD COLUMN IF NOT EXISTS layer_order TEXT DEFAULT NULL;
        ALTER TABLE user_custom_layers
            ADD COLUMN IF NOT EXISTS geojson TEXT DEFAULT NULL;
        CREATE TABLE IF NOT EXISTS user_custom_folders (
            id SERIAL PRIMARY KEY,
            user_email VARCHAR(255) NOT NULL,
            folder_name VARCHAR(255) NOT NULL,
            sort_order INTEGER DEFAULT 0,
            CONSTRAINT unique_user_folder UNIQUE (user_email, folder_name)
        );
    """)
