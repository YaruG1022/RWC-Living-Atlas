"""Issue and verify opaque, revocable account credentials."""

import hashlib
import re
import secrets

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer


_bearer = HTTPBearer(auto_error=False)
_token_format = re.compile(r"[A-Za-z0-9_-]{43}")
_token_lifetimes = {"session": "7 days", "password_reset": "30 minutes"}


def invalid_session():
    return HTTPException(
        status_code=401,
        detail="Sign in again or request a new password reset link.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def optional_bearer_token(credentials=Depends(_bearer)):
    return credentials.credentials if credentials else None


def bearer_token(token=Depends(optional_bearer_token)):
    if not token or not _token_format.fullmatch(token):
        raise invalid_session()
    return token


def _token_hash(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_password(password, salt):
    # Keep compatibility with passwords already stored by Living Atlas.
    return hashlib.sha256(password.encode("utf-8") + bytes(salt) + b"xe5Dx93xefx16x9ax12wy").hexdigest()


def issue_token(cursor, user_id, purpose="session"):
    duration = _token_lifetimes[purpose]
    cursor.execute(
        """
        DELETE FROM AccountTokens
        WHERE UserID = %s AND (ExpiresAt <= statement_timestamp() OR Purpose = 'password_reset' AND Purpose = %s)
        """,
        (user_id, purpose),
    )
    token = secrets.token_urlsafe(32)
    cursor.execute(
        """
        INSERT INTO AccountTokens (TokenHash, UserID, Purpose, ExpiresAt)
        VALUES (%s, %s, %s, statement_timestamp() + %s::interval)
        """,
        (_token_hash(token), user_id, purpose, duration),
    )
    return token


def require_account(cursor, token):
    if not token or not _token_format.fullmatch(token):
        raise invalid_session()
    cursor.execute(
        """
        SELECT u.UserID, u.Email, COALESCE(u.Is_Admin, FALSE)
        FROM AccountTokens t
        JOIN Users u ON u.UserID = t.UserID
        WHERE t.TokenHash = %s AND t.Purpose = 'session' AND t.ExpiresAt > statement_timestamp()
        """,
        (_token_hash(token),),
    )
    account = cursor.fetchone()
    if account is None:
        raise invalid_session()
    return account


def require_admin(cursor, token):
    account = require_account(cursor, token)
    if not account[2]:
        raise HTTPException(status_code=403, detail="Administrator permission is required.")
    return account


def revoke_session(cursor, token):
    if token and _token_format.fullmatch(token):
        cursor.execute(
            "DELETE FROM AccountTokens WHERE TokenHash = %s AND Purpose = 'session'",
            (_token_hash(token),),
        )


def consume_reset_token(cursor, token):
    if not token or not _token_format.fullmatch(token):
        raise invalid_session()
    token_hash = _token_hash(token)
    # Serialize reset and login credential changes by taking the user lock first.
    cursor.execute(
        """
        SELECT u.UserID FROM AccountTokens t JOIN Users u ON t.UserID = u.UserID
        WHERE t.TokenHash = %s AND t.Purpose = 'password_reset'
          AND t.ExpiresAt > statement_timestamp()
        FOR UPDATE OF u
        """,
        (token_hash,),
    )
    if cursor.fetchone() is None:
        raise invalid_session()
    cursor.execute(
        """
        DELETE FROM AccountTokens
        WHERE TokenHash = %s AND Purpose = 'password_reset' AND ExpiresAt > statement_timestamp()
        RETURNING UserID
        """,
        (token_hash,),
    )
    account = cursor.fetchone()
    if account is None:
        raise invalid_session()
    return account[0]


def revoke_user_sessions(cursor, user_id):
    cursor.execute("DELETE FROM AccountTokens WHERE UserID = %s", (user_id,))
