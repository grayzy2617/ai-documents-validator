from typing import Optional, List
from pydantic import BaseModel, EmailStr
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    status: bool = True

class UserCreate(UserBase):
    password: str
    role: Optional[str] = "GIAO_VIEN"
    department: Optional[str] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    status: Optional[bool] = None
    role: Optional[str] = None
    department: Optional[str] = None

class UserOut(UserBase):
    id: int
    created_at: datetime
    role: Optional[str] = "GIAO_VIEN"
    department: Optional[str] = None
    
    class Config:
        from_attributes = True

class SystemConfigBase(BaseModel):
    config_key: str
    config_value: str
    description: Optional[str] = None

class SystemConfigCreate(SystemConfigBase):
    pass

class SystemConfigOut(SystemConfigBase):
    id: int
    
    class Config:
        from_attributes = True
