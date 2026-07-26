import asyncio
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

async def test_db():
    engine = create_async_engine("sqlite+aiosqlite:///storage/reforge.db")
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        from app.models.user import User
        result = await session.execute(select(User).where(User.email == "test_1784965737@example.com"))
        user = result.scalar_one_or_none()
        print(f"User in DB: {user.email}, hash: {user.hashed_password}")
        
        from app.utils.auth import verify_password
        print(f"Verify 'Password123': {verify_password('Password123', user.hashed_password)}")

if __name__ == "__main__":
    asyncio.run(test_db())
