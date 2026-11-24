"""Store and check account-bound, single-use email verification challenges."""

import hashlib
import hmac
import secrets

from fastapi import HTTPException


CODE_LIFETIME_SECONDS = 600
SEND_COOLDOWN_SECONDS = 60
MAX_CODE_ATTEMPTS = 5


def ensure_email_two_factor_schema(cursor):
    cursor.execute("""
        ALTER TABLE Users ADD COLUMN IF NOT EXISTS EmailTwoFactorEnabled BOOLEAN NOT NULL DEFAULT FALSE;

        CREATE TABLE IF NOT EXISTS EmailTwoFactorChallenges (
            UserID INT NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
            Purpose TEXT NOT NULL CHECK (Purpose IN ('login', 'enrollment')),
            ChallengeHash TEXT UNIQUE,
            CodeDigest TEXT,
            ExpiresAt TIMESTAMPTZ NOT NULL,
            NextSendAt TIMESTAMPTZ NOT NULL,
            FailedAttempts INT NOT NULL DEFAULT 0,
            AttemptWindowEndsAt TIMESTAMPTZ NOT NULL,
            PRIMARY KEY (UserID, Purpose)
        );
    """)


def challenge_hash(challenge_id):
    return hashlib.sha256(challenge_id.encode("ascii")).hexdigest()


def _code_digest(challenge_id, code):
    # The high-entropy challenge ID is only held by the client. Its stored hash
    # cannot be used to check guesses against the low-entropy email code.
    return hmac.new(challenge_id.encode("ascii"), code.encode("ascii"), "sha256").hexdigest()


def _generate_code():
    return f"{secrets.randbelow(1_000_000):06d}"


def _retry_later(detail, seconds):
    return HTTPException(
        status_code=429, detail=detail,
        headers={"Retry-After": str(seconds), "Cache-Control": "no-store"},
    )


def expired_challenge():
    return HTTPException(
        status_code=410, detail="This verification request expired or was replaced. Start again to request a new code.",
        headers={"Cache-Control": "no-store"},
    )


def _attempt_limit(seconds):
    return _retry_later("Too many incorrect codes. Wait before requesting a new code.", seconds)


def _enforce_send_limits(failed_attempts, window_seconds, send_seconds):
    if failed_attempts >= MAX_CODE_ATTEMPTS and window_seconds > 0:
        raise _attempt_limit(max(window_seconds, send_seconds))
    if send_seconds > 0:
        raise _retry_later("Please wait before requesting another verification code.", send_seconds)


def create_challenge(cursor, user_id, purpose):
    """Replace a challenge under the caller's user lock without resetting the attempt budget."""
    cursor.execute(
        """
        SELECT FailedAttempts,
               CEIL(EXTRACT(EPOCH FROM AttemptWindowEndsAt - statement_timestamp()))::INT,
               CEIL(EXTRACT(EPOCH FROM NextSendAt - statement_timestamp()))::INT
        FROM EmailTwoFactorChallenges WHERE UserID = %s AND Purpose = %s
        """,
        (user_id, purpose),
    )
    existing = cursor.fetchone()
    if existing:
        _enforce_send_limits(*existing)

    challenge_id = secrets.token_urlsafe(32)
    code = _generate_code()
    cursor.execute(
        """
        INSERT INTO EmailTwoFactorChallenges AS c
            (UserID, Purpose, ChallengeHash, CodeDigest, ExpiresAt, NextSendAt, AttemptWindowEndsAt)
        VALUES (%s, %s, %s, %s,
                statement_timestamp() + %s * interval '1 second',
                statement_timestamp() + %s * interval '1 second',
                statement_timestamp() + %s * interval '1 second')
        ON CONFLICT (UserID, Purpose) DO UPDATE
        SET ChallengeHash = EXCLUDED.ChallengeHash, CodeDigest = EXCLUDED.CodeDigest,
            ExpiresAt = EXCLUDED.ExpiresAt, NextSendAt = EXCLUDED.NextSendAt,
            FailedAttempts = CASE WHEN c.AttemptWindowEndsAt > statement_timestamp() THEN c.FailedAttempts ELSE 0 END,
            AttemptWindowEndsAt = CASE WHEN c.AttemptWindowEndsAt > statement_timestamp()
                                       THEN c.AttemptWindowEndsAt ELSE EXCLUDED.AttemptWindowEndsAt END
        """,
        (user_id, purpose, challenge_hash(challenge_id), _code_digest(challenge_id, code),
         CODE_LIFETIME_SECONDS, SEND_COOLDOWN_SECONDS, CODE_LIFETIME_SECONDS),
    )
    return challenge_id, code


def discard_challenge(cursor, challenge_id):
    cursor.execute(
        """
        UPDATE EmailTwoFactorChallenges SET ChallengeHash = NULL, CodeDigest = NULL
        WHERE ChallengeHash = %s
        """,
        (challenge_hash(challenge_id),),
    )


def clear_challenges(cursor, user_id):
    cursor.execute(
        """
        UPDATE EmailTwoFactorChallenges SET ChallengeHash = NULL, CodeDigest = NULL
        WHERE UserID = %s
        """,
        (user_id,),
    )


def _lock_active_challenge(cursor, user_id, purpose, challenge_id):
    cursor.execute(
        """
        SELECT CodeDigest, FailedAttempts,
               CEIL(EXTRACT(EPOCH FROM AttemptWindowEndsAt - statement_timestamp()))::INT,
               CEIL(EXTRACT(EPOCH FROM NextSendAt - statement_timestamp()))::INT
        FROM EmailTwoFactorChallenges
        WHERE UserID = %s AND Purpose = %s AND ChallengeHash = %s
          AND ExpiresAt > statement_timestamp()
        FOR UPDATE
        """,
        (user_id, purpose, challenge_hash(challenge_id)),
    )
    return cursor.fetchone()


def resend_challenge(cursor, user_id, purpose, challenge_id):
    """Replace the code without extending the password verification window or resetting attempts."""
    challenge = _lock_active_challenge(cursor, user_id, purpose, challenge_id)
    if challenge is None:
        raise expired_challenge()
    previous_digest, failed_attempts, window_seconds, send_seconds = challenge
    _enforce_send_limits(failed_attempts, window_seconds, send_seconds)

    code = _generate_code()
    digest = _code_digest(challenge_id, code)
    while hmac.compare_digest(previous_digest, digest):
        code = _generate_code()
        digest = _code_digest(challenge_id, code)

    cursor.execute(
        """
        UPDATE EmailTwoFactorChallenges
        SET CodeDigest = %s, NextSendAt = statement_timestamp() + %s * interval '1 second'
        WHERE UserID = %s AND Purpose = %s AND ExpiresAt > statement_timestamp()
        RETURNING CEIL(EXTRACT(EPOCH FROM ExpiresAt - statement_timestamp()))::INT
        """,
        (digest, SEND_COOLDOWN_SECONDS, user_id, purpose),
    )
    expiry = cursor.fetchone()
    if expiry is None:
        raise expired_challenge()
    return code, expiry[0]


def verify_challenge(cursor, user_id, purpose, challenge_id, code):
    """Consume a valid challenge or record a failed attempt while the user is locked.

    Return errors so the caller can commit the attempt before returning an error response.
    """
    challenge = _lock_active_challenge(cursor, user_id, purpose, challenge_id)
    if challenge is None:
        return expired_challenge()

    digest, failed_attempts, window_seconds, send_seconds = challenge
    if failed_attempts >= MAX_CODE_ATTEMPTS and window_seconds > 0:
        return _attempt_limit(max(window_seconds, send_seconds))

    if hmac.compare_digest(digest, _code_digest(challenge_id, code)):
        cursor.execute(
            "DELETE FROM EmailTwoFactorChallenges WHERE UserID = %s AND Purpose = %s",
            (user_id, purpose),
        )
        return None

    cursor.execute(
        """
        UPDATE EmailTwoFactorChallenges
        SET FailedAttempts = CASE WHEN AttemptWindowEndsAt > statement_timestamp() THEN FailedAttempts + 1 ELSE 1 END,
            AttemptWindowEndsAt = CASE WHEN AttemptWindowEndsAt > statement_timestamp() THEN AttemptWindowEndsAt
                                       ELSE statement_timestamp() + %s * interval '1 second' END
        WHERE UserID = %s AND Purpose = %s
        RETURNING FailedAttempts, CEIL(EXTRACT(EPOCH FROM AttemptWindowEndsAt - statement_timestamp()))::INT
        """,
        (CODE_LIFETIME_SECONDS, user_id, purpose),
    )
    failed_attempts, window_seconds = cursor.fetchone()
    if failed_attempts >= MAX_CODE_ATTEMPTS:
        return _attempt_limit(max(window_seconds, send_seconds))
    return HTTPException(
        status_code=401, detail="Incorrect verification code.", headers={"Cache-Control": "no-store"},
    )
