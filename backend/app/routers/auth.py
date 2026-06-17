import os
import hmac
import hashlib
import requests
from fastapi import APIRouter, HTTPException, Cookie, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

_APP_NAME = "state-machine-simulator"

# Firebase Identity Toolkit REST endpoint for server-side email/password sign-in.
_SIGN_IN_URL = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword"
_REST_TIMEOUT = 10


class LoginRequest(BaseModel):
    email: str
    password: str


def _compute_token(secret: str) -> str:
    return hmac.new(
        secret.encode(), f"{_APP_NAME}-auth".encode(), hashlib.sha256
    ).hexdigest()


def _verify_with_firebase(email: str, password: str, api_key: str) -> str:
    """Validate email/password server-side via Identity Toolkit REST.

    Returns the authenticated email on success. Raises HTTPException with a
    user-facing message on failure. The password is never logged.
    """
    try:
        resp = requests.post(
            _SIGN_IN_URL,
            params={"key": api_key},
            json={"email": email, "password": password, "returnSecureToken": True},
            timeout=_REST_TIMEOUT,
        )
    except requests.RequestException:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="認証サービスに接続できませんでした",
        )

    if resp.status_code == 200:
        return resp.json().get("email", email)

    try:
        error_message = resp.json().get("error", {}).get("message", "")
    except ValueError:
        error_message = ""

    if error_message in ("EMAIL_NOT_FOUND", "INVALID_PASSWORD", "INVALID_LOGIN_CREDENTIALS"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="メールアドレスまたはパスワードが正しくありません",
        )
    if error_message.startswith("TOO_MANY_ATTEMPTS_TRY_LATER"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="ログイン試行が多すぎます。しばらく待ってから再試行してください",
        )
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="認証に失敗しました",
    )


@router.post("/session")
def create_session(request: LoginRequest):
    auth_secret = os.getenv("AUTH_SECRET")
    api_key = os.getenv("FIREBASE_API_KEY")
    allowed_emails_str = os.getenv("ALLOWED_USER_EMAILS", "")
    allowed_emails = [e.strip() for e in allowed_emails_str.split(",") if e.strip()]

    if not auth_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AUTH_SECRET not configured",
        )
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="FIREBASE_API_KEY not configured",
        )

    email = _verify_with_firebase(request.email, request.password, api_key)

    if allowed_emails and email not in allowed_emails:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not allowed",
        )

    token = _compute_token(auth_secret)
    is_production = os.getenv("APP_ENV", "local") == "production"

    response = JSONResponse(content={"success": True, "email": email})
    response.set_cookie(
        key="auth_token",
        value=token,
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=7 * 24 * 60 * 60,
        path="/",
    )
    return response


@router.post("/logout")
def logout():
    response = JSONResponse(content={"success": True})
    response.delete_cookie(key="auth_token", path="/")
    return response


@router.get("/me")
def me(auth_token: str = Cookie(None)):
    auth_secret = os.getenv("AUTH_SECRET")
    if not auth_secret or not auth_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    expected = hmac.new(
        auth_secret.encode(), f"{_APP_NAME}-auth".encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(auth_token, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    return {"status": "authenticated"}
