import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from jose import jwt

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    password: str

@router.post("/login")
async def login(request: LoginRequest):
    expected_password = os.getenv("AUTH_PASSWORD")
    if not expected_password:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AUTH_PASSWORD not configured"
        )
    
    if request.password != expected_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )
    
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT_SECRET not configured"
        )
    
    # JWT payload: { "sub": "owner", "exp": <now + 24h> }
    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    to_encode = {"sub": "owner", "exp": expire}
    encoded_jwt = jwt.encode(to_encode, secret, algorithm="HS256")
    
    return {"access_token": encoded_jwt, "token_type": "bearer"}

@router.post("/logout")
async def logout():
    return {"message": "logged out"}
