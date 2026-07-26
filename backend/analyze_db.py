import asyncio
import os
from sqlalchemy import text
from app.config import get_settings
from app.models.database import get_session_factory, init_db

async def analyze():
    # Show how the DB URL resolves based on the environment variables currently loaded
    settings = get_settings()
    db_url = settings.DATABASE_URL
    print(f"Original DATABASE_URL from settings: {db_url.replace(db_url.split('@')[0], '***') if '@' in db_url else db_url}")
    
    if "postgres" not in db_url.lower():
        print("Fallback to SQLite triggered: 'postgres' not in db_url.lower()")
        db_url = "sqlite+aiosqlite:///storage/reforge.db"
    else:
        print("Fallback NOT triggered. Using original DATABASE_URL.")
    
    print(f"Resolved db_url: {db_url.replace(db_url.split('@')[0], '***') if '@' in db_url else db_url}")
    print(f"Is it SQLite? {'sqlite' in db_url.lower()}")
    print(f"Is it PostgreSQL? {'postgres' in db_url.lower()}")

    if 'sqlite' in db_url.lower():
        db_path = "storage/reforge.db"
        print(f"\nSQLite file check: {db_path} exists? {os.path.exists(db_path)}")
        if os.path.exists(db_path):
            print(f"Size: {os.path.getsize(db_path)} bytes")
            print(f"Modified: {os.path.getmtime(db_path)}")

    await init_db(db_url)
    session_maker = get_session_factory()
    
    async with session_maker() as session:
        # Check users
        result = await session.execute(text("SELECT COUNT(*) FROM users"))
        user_count = result.scalar()
        print(f"\nTotal users in DB: {user_count}")
        
        result = await session.execute(text("SELECT COUNT(*) FROM users WHERE email = 'test@example.com'"))
        test_user = result.scalar()
        print(f"test@example.com exists? {test_user > 0}")
        
        # Check documents
        try:
            result = await session.execute(text("SELECT COUNT(*) FROM documents"))
            doc_count = result.scalar()
            print(f"Total documents in DB: {doc_count}")
        except Exception as e:
            print(f"Could not query documents: {e}")
            
        # Check chat sessions
        try:
            result = await session.execute(text("SELECT COUNT(*) FROM chat_sessions"))
            chat_count = result.scalar()
            print(f"Total chat sessions in DB: {chat_count}")
        except Exception as e:
            print(f"Could not query chat_sessions: {e}")

if __name__ == "__main__":
    asyncio.run(analyze())
