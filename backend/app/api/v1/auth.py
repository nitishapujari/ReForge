"""
ReForge — Auth API Routes.

Handles user registration and login.
"""

from datetime import timedelta
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm
from typing import Annotated
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import SessionDep, CurrentUser
from app.models.user import User
from app.utils.auth import verify_password, get_password_hash, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


class UserRegister(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict


@router.post("/register")
async def register(user_in: UserRegister, db: SessionDep):
    """Register a new user with email and password."""
    # Ensure email is lowercase for case-insensitive matching
    email_lower = str(user_in.email).lower()
    
    try:
        new_user = User(
            first_name=user_in.first_name,
            last_name=user_in.last_name,
            email=email_lower,
            hashed_password=get_password_hash(user_in.password),
            provider="credentials"
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        
        # Auto-login after registration
        access_token_expires = timedelta(days=7)
        access_token = create_access_token(
            subject=new_user.id, expires_delta=access_token_expires
        )
        return {
            "success": True,
            "access_token": access_token,
            "token_type": "bearer",
            "user": {"id": new_user.id, "email": new_user.email, "first_name": new_user.first_name, "last_name": new_user.last_name}
        }
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": {
                    "code": "EMAIL_EXISTS",
                    "message": "A user with this email already exists."
                }
            }
        )


@router.post("/login")
async def login(credentials: UserLogin, db: SessionDep):
    """Authenticate a user and return a JWT."""
    email_lower = str(credentials.email).lower()
    result = await db.execute(select(User).where(User.email == email_lower))
    user = result.scalar_one_or_none()
    
    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_CREDENTIALS",
                    "message": "Incorrect email or password."
                }
            },
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_CREDENTIALS",
                    "message": "Incorrect email or password."
                }
            },
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token_expires = timedelta(days=7)
    access_token = create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    
    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "first_name": user.first_name, "last_name": user.last_name}
    }


@router.post("/swagger-login", include_in_schema=False)
async def swagger_login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: SessionDep):
    """Dedicated login endpoint for Swagger UI's OAuth2 Password flow."""
    # OAuth2PasswordRequestForm uses 'username', which we map to our 'email' field
    credentials = UserLogin(email=form_data.username, password=form_data.password)
    return await login(credentials, db)


@router.get("/me")
async def get_me(current_user: CurrentUser):
    """Get the current authenticated user's profile."""
    return {
        "success": True,
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "provider": current_user.provider,
            "created_at": current_user.created_at
        }
    }
