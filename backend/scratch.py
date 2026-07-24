import asyncio
from app.models.database import init_db, get_session_factory
from app.models.user import User
from app.utils.auth import get_password_hash, verify_password
from sqlalchemy import select

async def main():
    await init_db("sqlite+aiosqlite:///:memory:")
    factory = get_session_factory()
    async with factory() as session:
        # Register exactly as UserRegister does
        email = "Alice@example.com"
        pwd = "Alice@123"
        hashed = get_password_hash(pwd)
        u = User(email=email, hashed_password=hashed, first_name="A", last_name="A")
        session.add(u)
        await session.commit()
        
        # Test login query exactly as in auth.py
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            print("FAILED: User not found!")
            return
        
        # Verify password
        is_valid = verify_password(pwd, user.hashed_password)
        print(f"User found. Password valid? {is_valid}")

if __name__ == "__main__":
    asyncio.run(main())
