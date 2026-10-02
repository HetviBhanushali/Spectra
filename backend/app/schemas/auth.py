"""
Pydantic schemas for authentication and users.
"""

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field


UserRole = Literal["ADMIN", "OPERATOR", "VIEWER"]


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: UserRole = "VIEWER"


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenData(BaseModel):
    user_id: str
    username: str
    role: UserRole
    exp: Optional[int] = None
