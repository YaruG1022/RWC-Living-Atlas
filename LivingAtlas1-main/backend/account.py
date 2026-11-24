"""
account
    profile account
    upload account
    profile cards           --Adjust query to be post referenced

"""

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, Response, UploadFile, File
from database import conn, cur, get_request_connection, release_request_connection
from pydantic import BaseModel, Field, StrictBool
from typing import Dict, Any
from contextlib import contextmanager
import json
import logging
import psycopg2

import urllib.parse
import requests
# import smtplib
# from email.mime.multipart import MIMEMultipart
# from email.mime.text import MIMEText

import os
from hmac import compare_digest
from sessions import (
    bearer_token, consume_reset_token, hash_password, invalid_session, issue_token,
    optional_bearer_token, require_account, require_admin, revoke_session, revoke_user_sessions,
)

# Email provider credentials must be configured in the environment.
SENDGRID_API_KEY = os.environ.get("CEREO_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "")
RESEND_API_KEY = (os.environ.get("RESEND_API_KEY") or os.environ.get("CEREO_API_KEY") or "").strip()
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "noreply@cereo-livingatlas.com")

account_router = APIRouter()
logger = logging.getLogger(__name__)

# Model for password reset
class ResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=6)
    reset_token: str | None = Field(default=None, min_length=1)

    class Config:
        extra = "forbid"

# Model for forgot password request
class ForgotPasswordRequest(BaseModel):
    email: str

# Model for signup notification request
class SignupNotificationRequest(BaseModel):
    username: str
    email: str
    desired_access_level: str

# Model for user feedback submission
class FeedbackRequest(BaseModel):
    name: str
    email: str
    message: str


class UserPreferencesUpsertRequest(BaseModel):
    email: str
    preferences: Dict[str, Any] = {}

class UpdateUsernameRequest(BaseModel):
    email: str
    new_username: str

class UpdateBioRequest(BaseModel):
    email: str
    bio: str

BIO_MAX_LENGTH = 300

#Retrieve names and emails of all users for the administration page
class User(BaseModel):
    name: str
    email: str

def send_recovery_email(recipient_email, token):
    # Carry the credential in a fragment so the frontend server never receives it.
    fragment = urllib.parse.urlencode({"token": token})
    reset_url = f"https://rwc-living-atlas.netlify.app/reset-password#{fragment}"
    body = f"""
        <p>Use this link to reset your Living Atlas password.</p>
        <p><a href="{reset_url}">Reset password</a></p>
        <p>If you did not request a reset, you can ignore this email.</p>
    """
    try:
        send_via_resend(recipient_email, "Password Reset Request", body)
    except Exception:
        logger.warning("Password recovery email could not be delivered")


def send_via_sendgrid(recipient_email, subject, body):
    """Send email using SendGrid API"""
    print("DEBUG: Sending via SendGrid API...")
    
    payload = {
        "personalizations": [
            {
                "to": [{"email": recipient_email}],
                "subject": subject
            }
        ],
        "from": {"email": SENDER_EMAIL, "name": "Living Atlas"},
        "content": [
            {
                "type": "text/html",
                "value": body
            }
        ]
    }
    
    headers = {
        "Authorization": f"Bearer {SENDGRID_API_KEY}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(
        "https://api.sendgrid.com/v3/mail/send",
        json=payload,
        headers=headers,
        timeout=30
    )
    
    if response.status_code == 202:
        print(f"DEBUG: SendGrid email sent successfully!")
        return True
    else:
        error_detail = response.text
        print(f"DEBUG: SendGrid failed with status {response.status_code}: {error_detail}")
        raise Exception(f"SendGrid returned {response.status_code}: {error_detail}")


def send_via_gmail_smtp(recipient_email, subject, body):
    """Gmail SMTP is temporarily disabled."""
    raise Exception("Gmail SMTP is disabled. Resend is active.")


def send_via_resend(recipient_email, subject, body):
    """Send email using Resend API over HTTPS."""
    resend_api_key = (os.environ.get("RESEND_API_KEY") or os.environ.get("CEREO_API_KEY") or "").strip()
    resend_from_email = os.environ.get("RESEND_FROM_EMAIL", "noreply@cereo-livingatlas.com").strip()

    if not resend_api_key:
        raise Exception("Missing RESEND_API_KEY environment variable")

    if not resend_from_email:
        raise Exception("Missing RESEND_FROM_EMAIL environment variable")

    payload = {
        "from": f"Living Atlas <{resend_from_email}>" if "<" not in resend_from_email else resend_from_email,
        "to": [recipient_email],
        "subject": subject,
        "html": body,
    }

    headers = {
        "Authorization": f"Bearer {resend_api_key}",
        "Content-Type": "application/json",
    }

    response = requests.post("https://api.resend.com/emails", json=payload, headers=headers, timeout=30)
    if response.status_code not in (200, 201):
        raise Exception(f"Resend returned {response.status_code}: {response.text}")

    return True


def send_signup_notification(username, email, desired_access_level):
        """Send signup notification email to admin via active email provider."""
        admin_email = "wsu.cereoatlas25@gmail.com"

        subject = "New User Signup Request"
        body = f"""
        <html>
            <body>
                <p>A new user has requested access:</p>
                <ul>
                    <li><strong>Username:</strong> {username}</li>
                    <li><strong>Email:</strong> {email}</li>
                    <li><strong>Desired Access Level:</strong> {desired_access_level}</li>
                </ul>
            </body>
        </html>
        """
        send_via_resend(admin_email, subject, body)


@account_router.post("/submit-feedback")
async def submit_feedback(request: FeedbackRequest):
    try:
        feedback_recipient = "wsu.cereoatlas25@gmail.com"
        subject = f"User Feedback from {request.name}"
        body = f"""
        <html>
            <body>
                <p><strong>Name:</strong> {request.name}</p>
                <p><strong>Email:</strong> {request.email}</p>
                <p><strong>Message:</strong></p>
                <p>{request.message}</p>
            </body>
        </html>
        """
        send_via_resend(feedback_recipient, subject, body)
        return {"success": True, "message": "Feedback submitted successfully."}
    except Exception as e:
        print(f"DEBUG: Exception in submit_feedback: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to submit feedback: {str(e)}")


@account_router.post("/sendSignupNotification")
async def send_signup_notification_endpoint(request: SignupNotificationRequest):
        if not request.username or not request.email or not request.desired_access_level:
                raise HTTPException(status_code=400, detail="Missing required fields")

        try:
                send_signup_notification(request.username, request.email, request.desired_access_level)
                return {"success": True, "message": "Signup notification sent to admin."}
        except Exception as e:
                # Preserve signup flow even when notification email fails.
                return {"success": False, "message": f"Signup saved but email notification failed: {str(e)}"}


@account_router.get("/user_preferences")
def get_user_preferences(email: str):
    try:
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")

        cur.execute("SELECT preferences FROM user_preferences WHERE user_email = %s", (email,))
        row = cur.fetchone()

        if not row or row[0] is None:
            conn.commit()
            return {"email": email, "preferences": {}}

        preferences = row[0]
        if isinstance(preferences, str):
            preferences = json.loads(preferences)

        if not isinstance(preferences, dict):
            preferences = {}

        conn.commit()
        return {"email": email, "preferences": preferences}
    except HTTPException:
        raise
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        return {"error": str(e)}


@account_router.post("/user_preferences")
async def upsert_user_preferences(payload: UserPreferencesUpsertRequest):
    try:
        email = (payload.email or '').strip()
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")

        preferences = payload.preferences or {}
        if not isinstance(preferences, dict):
            raise HTTPException(status_code=400, detail="preferences must be an object")

        # Validate user exists
        cur.execute("SELECT 1 FROM users WHERE email = %s", (email,))
        if cur.fetchone() is None:
            raise HTTPException(status_code=404, detail="User not found")

        cur.execute(
            """
            INSERT INTO user_preferences (user_email, preferences, created_at, updated_at)
            VALUES (%s, %s::jsonb, NOW(), NOW())
            ON CONFLICT (user_email) DO UPDATE
            SET preferences = COALESCE(user_preferences.preferences, '{}'::jsonb) || EXCLUDED.preferences,
                updated_at = NOW()
            RETURNING preferences
            """,
            (email, json.dumps(preferences))
        )
        row = cur.fetchone()
        conn.commit()

        merged_preferences = row[0] if row else {}
        if isinstance(merged_preferences, str):
            merged_preferences = json.loads(merged_preferences)

        return {"success": True, "email": email, "preferences": merged_preferences}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        return {"success": False, "error": str(e)}


class UserRoleUpdateRequest(BaseModel):
    email: str
    is_admin: StrictBool


@contextmanager
def account_management_cursor():
    """Give each management request its own recoverable transaction."""
    connection = get_request_connection()
    if connection is None:
        raise HTTPException(status_code=503, detail="User database is temporarily unavailable. Please try again.")
    try:
        with connection, connection.cursor() as cursor:
            yield cursor
    except HTTPException:
        raise
    except psycopg2.errors.ForeignKeyViolation:
        raise HTTPException(status_code=409, detail="This user still owns linked content. Reassign or remove it before deleting the user.")
    except Exception:
        raise HTTPException(status_code=500, detail="Unable to complete the user management request. Please try again.")
    finally:
        release_request_connection(connection)


@account_router.post("/list_database")
def list_database(token: str = Depends(bearer_token)):
    with account_management_cursor() as cursor:
        require_admin(cursor, token)
        cursor.execute("SELECT username, email, COALESCE(is_admin, false), created_at, last_online_at FROM users")
        rows = cursor.fetchall()
        return {"users": [
            {"name": row[0], "email": row[1], "is_admin": row[2], "created_at": row[3], "last_online_at": row[4]}
            for row in rows
        ]}


@account_router.post("/fetch_signup_requests")
def fetch_signup_requests(token: str = Depends(bearer_token)):
    with account_management_cursor() as cursor:
        require_admin(cursor, token)
        cursor.execute("SELECT username, email, pass, sponsormessage, desiresadmin FROM signupdata")
        return {"signUpRequests": [
            {
                "name": row[0],
                "email": row[1],
                "password": row[2],
                "sponsor_message": row[3],
                "desired_access_level": row[4],
            }
            for row in cursor.fetchall()
        ]}


@account_router.get("/userRole")
def get_user_role(email: str):
    with account_management_cursor() as cursor:
        cursor.execute("SELECT is_admin FROM users WHERE email = %s", (email,))
        row = cursor.fetchone()
        return {"is_admin": row[0]} if row else {"error": "User not found"}


@account_router.post("/edit_user_role")
def edit_user_role(user_info: UserRoleUpdateRequest, token: str = Depends(bearer_token)):
    with account_management_cursor() as cursor:
        require_admin(cursor, token)
        # Serialize role changes so concurrent requests cannot demote every admin.
        cursor.execute("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE")
        require_admin(cursor, token)
        cursor.execute("SELECT COALESCE(is_admin, false) FROM users WHERE email = %s", (user_info.email,))
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="User not found")
        if row[0] and not user_info.is_admin:
            cursor.execute("SELECT COUNT(*) FROM users WHERE is_admin = TRUE")
            if cursor.fetchone()[0] <= 1:
                raise HTTPException(status_code=409, detail="The last admin must keep the Admin role. Promote another user first.")
        cursor.execute("UPDATE users SET is_admin = %s WHERE email = %s", (user_info.is_admin, user_info.email))
    return {"success": True, "message": "User role updated successfully."}


@account_router.post("/delete_user/{email}")
def delete_user(email: str, token: str = Depends(bearer_token)):
    with account_management_cursor() as cursor:
        require_admin(cursor, token)
        cursor.execute("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE")
        require_admin(cursor, token)
        cursor.execute("SELECT COALESCE(is_admin, false) FROM users WHERE email = %s FOR UPDATE", (email,))
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="User not found")
        if row[0]:
            raise HTTPException(status_code=409, detail="Admin users cannot be deleted. Change their role first.")
        cursor.execute("DELETE FROM users WHERE email = %s", (email,))
    return {"success": True, "message": "User deleted successfully."}


@account_router.post("/deny_request/{email}")
def deny_request(email: str, token: str = Depends(bearer_token)):
    with account_management_cursor() as cursor:
        require_admin(cursor, token)
        cursor.execute("DELETE FROM signupdata WHERE email = %s", (email,))
    return {"success": True, "message": f"Request with email '{email}' has been denied and deleted successfully."}


@account_router.post("/forgot-password")
def forgot_password(request: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    with account_management_cursor() as cursor:
        cursor.execute("SELECT UserID, Email FROM Users WHERE Email = %s FOR UPDATE", (request.email,))
        account = cursor.fetchone()
        if account:
            token = issue_token(cursor, account[0], purpose="password_reset")
    if account:
        background_tasks.add_task(send_recovery_email, account[1], token)
    return {"success": True, "message": "If an account matches that address, a password reset email will be sent."}


@account_router.post("/reset-password")
def reset_password(request: ResetPasswordRequest, token: str | None = Depends(optional_bearer_token)):
    if request.reset_token is None and not token:
        raise invalid_session()

    with account_management_cursor() as cursor:
        cursor.execute("LOCK TABLE Users IN ROW EXCLUSIVE MODE")
        if request.reset_token is not None:
            user_id = consume_reset_token(cursor, request.reset_token)
        else:
            user_id, _, _ = require_account(cursor, token)
            cursor.execute("SELECT UserID FROM Users WHERE UserID = %s FOR UPDATE", (user_id,))
            if cursor.fetchone() is None:
                raise invalid_session()
            # A concurrent reset may revoke this session before we acquire the user lock.
            require_account(cursor, token)

        salt = os.urandom(32)
        cursor.execute(
            "UPDATE Users SET HashedPassword = %s, Salt = %s WHERE UserID = %s",
            (hash_password(request.new_password, salt), salt, user_id),
        )
        revoke_user_sessions(cursor, user_id)
    return {"success": True, "message": "Password has been reset successfully."}


class AccountLoginRequest(BaseModel):
    email: str
    password: str


def verify_login(cursor, email, password):
    # Match the table-before-row order used by role changes.
    cursor.execute("LOCK TABLE Users IN ROW EXCLUSIVE MODE")
    cursor.execute(
        """
        SELECT UserID, Username, Email, COALESCE(Is_Admin, FALSE), Salt, HashedPassword
        FROM Users WHERE Email = %s FOR UPDATE
        """,
        (email,),
    )
    account = cursor.fetchone()
    if account is None or not compare_digest(hash_password(password, account[4]), account[5]):
        return None
    cursor.execute("UPDATE Users SET Last_Online_At = statement_timestamp() WHERE UserID = %s", (account[0],))
    return account[:4]


@account_router.get("/profileAccount")
def profileAccount(email: str, password: str, response: Response):
    # Legacy clients can read the profile shape, while login uses the POST body.
    response.headers["Cache-Control"] = "no-store"
    with account_management_cursor() as cursor:
        account = verify_login(cursor, email, password)
        return {"Account Information": [account[1:]] if account else []}


@account_router.post("/profileAccount")
def sign_in(request: AccountLoginRequest, response: Response, previous_token=Depends(optional_bearer_token)):
    response.headers["Cache-Control"] = "no-store"
    with account_management_cursor() as cursor:
        account = verify_login(cursor, request.email, request.password)
        if account is None:
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        revoke_session(cursor, previous_token)
        token = issue_token(cursor, account[0])
        return {"Account Information": [account[1:]], "session_token": token}


@account_router.delete("/session", status_code=204)
def sign_out(token=Depends(bearer_token)):
    with account_management_cursor() as cursor:
        revoke_session(cursor, token)




@account_router.post("/uploadAccount")
def make_account(
    name: str = Form(None),
    email: str = Form(None),
    password: str = Form(None),
    token: str = Depends(bearer_token),
):
    with account_management_cursor() as cursor:
        require_account(cursor, token)
        if not (name and email and password):
            return {"success": False, "message": "All fields must be filled in"}

        cursor.execute("LOCK TABLE Users IN SHARE ROW EXCLUSIVE MODE")
        cursor.execute("SELECT 1 FROM Users WHERE Email = %s", (email,))
        if cursor.fetchone():
            return {"success": False, "message": "Email must be unique"}

        cursor.execute("SELECT 1 FROM Users WHERE Username = %s", (name,))
        if cursor.fetchone():
            return {"success": False, "message": "Username must be unique"}

        cursor.execute("SELECT COALESCE(MAX(UserID), 0) + 1 FROM Users")
        user_id = cursor.fetchone()[0]
        salt = os.urandom(32)
        cursor.execute(
            "INSERT INTO Users (UserID, Username, HashedPassword, Email, Salt) VALUES (%s, %s, %s, %s, %s)",
            (user_id, name, hash_password(password, salt), email, salt),
        )
    return {"success": True, "message": "New account added successfully"}


@account_router.post("/uploadSignup")
async def signup_data(
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    sponsor_message: str = Form(None),
    desired_access_level: str = Form("regular")
):
    connection = None
    try:
        if username and email and password:
            connection = get_request_connection()
            if connection is None:
                return {"success": False, "message": "Database connection unavailable"}
            # Keep the email check and insert together; the database's unique
            # indexes enforce both email and generated ID across all writers.
            with connection.cursor() as signup_cur:
                signup_cur.execute("SELECT COUNT(*) FROM SignupData WHERE Email = %s", (email,))
                if signup_cur.fetchone()[0] > 0:
                    connection.rollback()
                    return {"success": False, "message": "Email must be unique"}

                desires_admin = str(desired_access_level).lower() == "admin"
                signup_cur.execute(
                    "INSERT INTO SignupData (Username, Email, Pass, SponsorMessage, DesiresAdmin) VALUES (%s, %s, %s, %s, %s)",
                    (username, email, password, sponsor_message, desires_admin),
                )
            connection.commit()

            return {"success": True, "message": "New signup data added successfully"}

        return {"success": False, "message": "All fields must be filled in"}
    except Exception as e:
        if connection is not None and not connection.closed:
            connection.rollback()
        if isinstance(e, psycopg2.errors.UniqueViolation):
            return {"success": False, "message": "Email must be unique"}
        return {"success": False, "message": str(e)}
    finally:
        if connection is not None:
            release_request_connection(connection)




@account_router.get("/getProfileImage")
async def get_profile_image(email: str):
    try:
        cur.execute("SELECT profile_image FROM users WHERE email = %s", (email,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return {"success": True, "profile_image": row[0] or ""}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@account_router.post("/uploadProfileImage")
async def upload_profile_image(email: str = Form(...), image: UploadFile = File(...)):
    try:
        cur.execute("SELECT username FROM users WHERE email = %s", (email,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")

        from endpoint_files.images import save_uploaded_file
        image_url = save_uploaded_file(image)

        cur.execute("UPDATE users SET profile_image = %s WHERE email = %s", (image_url, email))
        conn.commit()
        return {"success": True, "message": "Profile image updated.", "profile_image": image_url}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@account_router.get("/getBio")
async def get_bio(email: str):
    try:
        cur.execute("SELECT bio FROM users WHERE email = %s", (email,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return {"success": True, "bio": row[0] or ""}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@account_router.post("/updateBio")
async def update_bio(request: UpdateBioRequest):
    try:
        if len(request.bio) > BIO_MAX_LENGTH:
            raise HTTPException(status_code=400, detail=f"Bio must be {BIO_MAX_LENGTH} characters or less.")
        cur.execute("SELECT username FROM users WHERE email = %s", (request.email,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="User not found")
        cur.execute("UPDATE users SET bio = %s WHERE email = %s", (request.bio, request.email))
        conn.commit()
        return {"success": True, "message": "Bio updated successfully.", "bio": request.bio}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@account_router.post("/updateUsername")
async def update_username(request: UpdateUsernameRequest):
    try:
        cur.execute("SELECT username FROM users WHERE email = %s", (request.email,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="User not found")
        cur.execute("UPDATE users SET username = %s WHERE email = %s", (request.new_username, request.email))
        conn.commit()
        return {"success": True, "message": "Username updated successfully.", "username": request.new_username}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@account_router.get("/profileCards")
def profileCards(username: str):
    cur.execute("""
        SELECT 
            u.Username,
            u.Email,
            c.Title,
            cat.CategoryLabel,
            c.DatePosted,
            c.Description,
            c.Organization,
            c.Funding,
            c.Link,
            STRING_AGG(DISTINCT t.TagLabel, ', ') AS TagLabels,
            c.Latitude,
            c.Longitude,
            c.Thumbnail_Link,
            -- Multi-image support: aggregate images from CardImages table
            COALESCE(
                json_agg(
                    DISTINCT jsonb_build_object(
                        'url', ci.ImageURL,
                        'alt', ci.AltText,
                        'order', ci.DisplayOrder
                    )
                    ORDER BY ci.DisplayOrder ASC
                ) FILTER (WHERE ci.ImageID IS NOT NULL),
                '[]'
            ) AS images,
            COALESCE(
                json_agg(
                    DISTINCT jsonb_build_object(
                        'fileID', f.FileID,
                        'filename', f.FileName,
                        'fileLink', f.FileLink,
                        'fileEXT', f.FileExtension
                    )
                ) FILTER (WHERE f.FileID IS NOT NULL),
                '[]'
            ) AS files
        FROM Cards c
        INNER JOIN Categories cat ON c.CategoryID = cat.CategoryID
        LEFT JOIN CardImages ci ON c.CardID = ci.CardID
        LEFT JOIN Files f ON c.CardID = f.CardID
        LEFT JOIN CardTags ct ON c.CardID = ct.CardID
        LEFT JOIN Tags t ON ct.TagID = t.TagID
        INNER JOIN Users u ON c.UserID = u.UserID
        WHERE u.Username = %s
        GROUP BY c.CardID, cat.CategoryLabel, u.Username, u.Email, c.Thumbnail_Link
        ORDER BY c.CardID DESC;
    """, (username,))

    rows = cur.fetchall()
    columns = [
        "username", "email", "title", "category", "date", "description", "org",
        "funding", "link", "tags", "latitude", "longitude", "thumbnail_link", "images", "files"
    ]
    data = [dict(zip(columns, row)) for row in rows]
    return {"data": data}


