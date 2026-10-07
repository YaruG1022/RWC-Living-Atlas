"""
Populate ArcGIS services database table with data from JSON files
This script should be run once to initialize the database with ArcGIS service data
"""

import os
import json
import psycopg2
from psycopg2.extras import execute_values

def get_db_connection():
    """Get database connection using the same settings as the main app"""
    try:
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        return conn
    except Exception as e:
        print(f"Database connection failed: {e}")
        return None

def load_json_data():
    """Load ArcGIS services data from JSON files"""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    client_src_dir = os.path.join(current_dir, "..", "client", "src")
    
    json_files = {
        'washington': 'arcgis_services_wa.json',
        'idaho': 'arcgis_services_id.json', 
        'oregon': 'arcgis_services_or.json'
    }
    
    all_services = []
    
    for state, filename in json_files.items():
        filepath = os.path.join(client_src_dir, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                services = json.load(f)
                for service in services:
                    # Ensure state field is set correctly
                    service['state'] = state
                    all_services.append(service)
                print(f"Loaded {len(services)} services for {state}")
        except FileNotFoundError:
            print(f"Warning: {filepath} not found, skipping {state}")
        except json.JSONDecodeError as e:
            print(f"Error parsing {filepath}: {e}")
    
    return all_services

def create_table_if_not_exists(conn):
    """Create the arcgis_services table if it doesn't exist"""
    with open('create_arcgis_services_table.sql', 'r') as f:
        sql = f.read()
    
    cur = conn.cursor()
    try:
        cur.execute(sql)
        conn.commit()
        print("✓ ArcGIS services table created/verified")
    except Exception as e:
        print(f"Error creating table: {e}")
        conn.rollback()
    finally:
        cur.close()

def populate_services(conn, services):
    """Populate the database with ArcGIS services data"""
    cur = conn.cursor()
    
    try:
        # Clear existing data
        cur.execute("DELETE FROM arcgis_services")
        print("✓ Cleared existing ArcGIS services data")
        
        # Prepare data for insertion
        insert_data = []
        for service in services:
            insert_data.append((
                service.get('key', ''),
                service.get('label', ''),
                service.get('url', ''),
                service.get('folder', 'Root'),
                service.get('type', ''),
                service.get('state', '')
            ))
        
        # Bulk insert
        insert_sql = """
            INSERT INTO arcgis_services (service_key, label, url, folder, type, state)
            VALUES %s
            ON CONFLICT (service_key, state, type) DO UPDATE SET
                label = EXCLUDED.label,
                url = EXCLUDED.url,
                folder = EXCLUDED.folder,
                updated_at = CURRENT_TIMESTAMP
        """
        
        execute_values(cur, insert_sql, insert_data, page_size=100)
        conn.commit()
        
        # Get counts by state
        cur.execute("""
            SELECT state, COUNT(*) 
            FROM arcgis_services 
            GROUP BY state 
            ORDER BY state
        """)
        
        results = cur.fetchall()
        print("\n✓ Database populated successfully!")
        print("Services by state:")
        for state, count in results:
            print(f"  {state}: {count} services")
            
        # Get total count
        cur.execute("SELECT COUNT(*) FROM arcgis_services")
        total = cur.fetchone()[0]
        print(f"  Total: {total} services")
        
    except Exception as e:
        print(f"Error populating database: {e}")
        conn.rollback()
    finally:
        cur.close()

def main():
    print("🚀 Starting ArcGIS services database population...")
    
    # Load JSON data
    print("\n1. Loading data from JSON files...")
    services = load_json_data()
    
    if not services:
        print("❌ No services loaded. Exiting.")
        return
    
    print(f"✓ Loaded {len(services)} total services")
    
    # Connect to database
    print("\n2. Connecting to database...")
    conn = get_db_connection()
    
    if not conn:
        print("❌ Database connection failed. Exiting.")
        return
    
    print("✓ Database connected")
    
    try:
        # Create table
        print("\n3. Creating/verifying database table...")
        create_table_if_not_exists(conn)
        
        # Populate data
        print("\n4. Populating database...")
        populate_services(conn, services)
        
        print("\n🎉 ArcGIS services database population completed successfully!")
        print("\nYou can now use the backend API endpoints:")
        print("  GET /arcgis/services")
        print("  GET /arcgis/services?state=washington")
        print("  GET /arcgis/services?state=idaho&type=MapServer")
        
    finally:
        conn.close()
        print("\n✓ Database connection closed")

if __name__ == "__main__":
    main()