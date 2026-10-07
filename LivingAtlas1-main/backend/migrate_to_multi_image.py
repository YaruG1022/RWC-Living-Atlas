"""
Database Migration Script: Multi-Image Support
This script safely migrates existing thumbnail data to the new CardImages table.
Preserves all existing data and adds backward compatibility.
"""

import os
import psycopg2
from psycopg2 import OperationalError, sql

# Database connection (same as in database.py)
def get_connection():
    try:
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        print("✓ Database Connection Success!")
        return conn
    except OperationalError as e:
        print(f"✗ Unable to connect to the database: {e}")
        return None


def execute_migration():
    """Execute the migration steps"""
    conn = get_connection()
    if not conn:
        return False

    cur = conn.cursor()
    
    try:
        # Step 1: Create CardImages table
        print("\n[Step 1] Creating CardImages table...")
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS CardImages (
            ImageID SERIAL PRIMARY KEY,
            CardID INT NOT NULL,
            ImageURL VARCHAR(255) NOT NULL,
            DisplayOrder INT NOT NULL DEFAULT 0,
            AltText VARCHAR(255),
            DateAdded DATE DEFAULT CURRENT_DATE,
            FOREIGN KEY (CardID) REFERENCES Cards(CardID) ON DELETE CASCADE
        );
        """
        cur.execute(create_table_sql)
        print("✓ CardImages table created (or already exists)")

        # Step 2: Create index
        print("\n[Step 2] Creating index for CardImages...")
        create_index_sql = """
        CREATE INDEX IF NOT EXISTS idx_cardimages_cardid 
        ON CardImages(CardID, DisplayOrder);
        """
        cur.execute(create_index_sql)
        print("✓ Index created successfully")

        # Step 3: Check existing CardImages
        print("\n[Step 3] Checking existing CardImages data...")
        cur.execute("SELECT COUNT(*) FROM CardImages;")
        existing_count = cur.fetchone()[0]
        print(f"  Existing CardImages records: {existing_count}")

        # Step 4: Migrate Thumbnail_Link data
        print("\n[Step 4] Migrating Thumbnail_Link data from Cards table...")
        migrate_sql = """
        INSERT INTO CardImages (CardID, ImageURL, DisplayOrder, AltText, DateAdded)
        SELECT 
            c.CardID,
            c.Thumbnail_Link,
            0 AS DisplayOrder,
            c.Title AS AltText,
            CURRENT_DATE AS DateAdded
        FROM Cards c
        WHERE c.Thumbnail_Link IS NOT NULL 
          AND TRIM(c.Thumbnail_Link) != ''
          AND NOT EXISTS (
            SELECT 1 FROM CardImages ci WHERE ci.CardID = c.CardID
          )
        ON CONFLICT DO NOTHING;
        """
        cur.execute(migrate_sql)
        migrated = cur.rowcount
        print(f"✓ Migrated {migrated} thumbnail records to CardImages table")

        # Step 5: Verify migration
        print("\n[Step 5] Verifying migration...")
        cur.execute("""
        SELECT 
            COUNT(*) as total_images,
            COUNT(DISTINCT CardID) as cards_with_images
        FROM CardImages;
        """)
        total_images, cards_with_images = cur.fetchone()
        print(f"✓ Total images in CardImages: {total_images}")
        print(f"✓ Cards with images: {cards_with_images}")

        # Step 6: Check for cards without images
        print("\n[Step 6] Checking for cards without images...")
        cur.execute("""
        SELECT COUNT(*) FROM Cards c
        WHERE NOT EXISTS (SELECT 1 FROM CardImages ci WHERE ci.CardID = c.CardID);
        """)
        cards_without_images = cur.fetchone()[0]
        print(f"  Cards without images: {cards_without_images}")

        # Commit all changes
        conn.commit()
        
        print("\n" + "="*60)
        print("✓ MIGRATION COMPLETED SUCCESSFULLY!")
        print("="*60)
        print("\nSummary:")
        print(f"  - CardImages table: {'Created' if existing_count == 0 else 'Already existed'}")
        print(f"  - Records migrated: {migrated}")
        print(f"  - Total images: {total_images}")
        print(f"  - Cards with images: {cards_with_images}")
        print("\nNote: Thumbnail_Link column in Cards table is preserved")
        print("      for backward compatibility.\n")
        
        return True

    except Exception as e:
        conn.rollback()
        print(f"\n✗ Migration failed: {e}")
        print("Rolled back all changes.")
        return False
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    print("Starting Database Migration for Multi-Image Support...\n")
    success = execute_migration()
    exit(0 if success else 1)
