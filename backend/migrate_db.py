import sqlite3
import os

db_path = "storage/reforge.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()

try:
    # 1. Rename existing table
    c.execute("ALTER TABLE documents RENAME TO documents_old")
    
    # 2. Re-create the table without the UNIQUE constraint on file_hash
    # Need to get the schema of documents_old first to make sure it matches
    c.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='documents_old'")
    schema = c.fetchone()[0]
    
    # The schema will have `file_hash VARCHAR(64) UNIQUE`
    new_schema = schema.replace("UNIQUE", "").replace("documents_old", "documents", 1)
    
    c.execute(new_schema)
    
    # 3. Copy data
    c.execute("INSERT INTO documents SELECT * FROM documents_old")
    
    # 4. Drop old table
    c.execute("DROP TABLE documents_old")
    
    # Recreate the indices that were on documents
    c.execute("CREATE INDEX IF NOT EXISTS ix_documents_file_hash ON documents (file_hash)")
    c.execute("CREATE INDEX IF NOT EXISTS ix_documents_user_id ON documents (user_id)")
    
    conn.commit()
    print("Migration successful: Removed UNIQUE constraint on file_hash")
except Exception as e:
    conn.rollback()
    print(f"Migration failed: {e}")
finally:
    conn.close()
