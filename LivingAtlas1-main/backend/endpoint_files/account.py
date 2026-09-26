"""
account
    profile account
    upload account
    profile cards           --Adjust query to be post referenced

"""
import os
import hashlib
import secrets
import smtplib
from fastapi import APIRouter, Form, UploadFile, File
from pydantic import BaseModel
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from database import conn, cur
import urllib.parse
import requests

# Email configuration for Gmail
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = "cereo.atlas@gmail.com"
SENDER_PASSWORD = "yqbr duhc ytcv ydjq"

# SMTP_SERVER = "smtp.gmail.com"
# SMTP_PORT = 465
# SENDER_EMAIL = "cereofullstack@gmail.com"
# SENDER_PASSWORD = "ljun kiiz ngod ypjv"

account_router = APIRouter()

from fastapi import HTTPException

import os 

# Health check endpoint for debugging
@account_router.get("/health")
async def health_check():
    print("DEBUG: Health check endpoint called")
    return {"status": "OK", "message": "Account router is working"}

# Debug endpoint to test email configuration
@account_router.get("/email-config")
async def email_config_check():
    print("DEBUG: Email config check called")
    return {
        "smtp_server": SMTP_SERVER,
        "smtp_port": SMTP_PORT,
        "sender_email": SENDER_EMAIL,
        "password_configured": "Yes" if SENDER_PASSWORD else "No"
    }

# Pydantic model for the signup notification request
class SignupNotificationRequest(BaseModel):
    username: str
    email: str
    desired_access_level: str

# Function to send notification email to admin
def send_signup_notification(username, email, desired_access_level):
    try:
        msg = MIMEMultipart()
        msg['From'] = SENDER_EMAIL
        msg['To'] = 'cereo@wsu.edu'  # Admin email
        msg['Subject'] = "New User Signup Request"

        # Email body content
        body = f"A new user has requested access:\n\nUsername: {username}\nEmail: {email}\nDesired Access Level: {desired_access_level}"
        msg.attach(MIMEText(body, 'plain'))

        # Send the email using Gmail's SMTP server
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()  # Enable TLS encryption
        server.login(SENDER_EMAIL, SENDER_PASSWORD)

        server.sendmail(SENDER_EMAIL, 'silas.peterson@wsu.edu', msg.as_string())
        server.quit()

        print(f"Signup notification email sent successfully to silas.peterson@wsu.edu!")
    except smtplib.SMTPException as smtp_error:
        print(f"SMTP error occurred: {smtp_error}")
    except Exception as e:
        print(f"Failed to send email: {e}")

# New endpoint to handle sending signup email notification
@account_router.post("/sendSignupNotification")
async def send_signup_notification_endpoint(request: SignupNotificationRequest):
    if not request.username or not request.email or not request.desired_access_level:
        raise HTTPException(status_code=400, detail="Missing required fields")

    # Call the function to send email to admin
    send_signup_notification(request.username, request.email, request.desired_access_level)

    return {"message": "Signup notification sent to admin."}


# Model for password reset
class ResetPasswordRequest(BaseModel):
    email: str
    new_password: str


# Helper function to hash the password (same as current setup)
def hash_password(password: str, salt: bytes) -> str:
    pepper = bytes("xe5Dx93xefx16x9ax12wy", 'utf-8')
    return hashlib.sha256(bytes(password, 'utf-8') + salt + pepper).hexdigest()

# Reset password endpoint
@account_router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    try:
        # Extract email and new_password from the request
        email = request.email
        new_password = request.new_password

        # Check if the email exists in the database
        cur.execute("SELECT userid FROM users WHERE email = %s", (email,))
        user = cur.fetchone()

        if not user:
            raise HTTPException(status_code=400, detail="Invalid email")

        # Generate a new salt for the new password
        new_salt = os.urandom(32)

        # Hash the new password with the new salt
        hashed_password = hash_password(new_password, new_salt)

        # Update the password and salt in the database
        cur.execute(
            "UPDATE users SET hashedpassword = %s, salt = %s WHERE email = %s",
            (hashed_password, new_salt, email)
        )
        conn.commit()

        return {"success": True, "message": "Password has been reset successfully"}

    except Exception as e:
        return {"success": False, "message": str(e)}


def get_short_url(long_url):
    # Using Bitly's API
    print(f"DEBUG: Starting URL shortening for: {long_url}")
    BITLY_API_URL = "https://api-ssl.bitly.com/v4/shorten"
    headers = {"Authorization": "Bearer 9b023a4be0d1aa1f667eae09b3b7e959af52acf2", "Content-Type": "application/json"}
    data = {"long_url": long_url}
    
    print(f"DEBUG: Making request to Bitly API: {BITLY_API_URL}")
    print(f"DEBUG: Request data: {data}")
    
    try:
        response = requests.post(BITLY_API_URL, json=data, headers=headers)
        print(f"DEBUG: Bitly API response status: {response.status_code}")
        print(f"DEBUG: Bitly API response text: {response.text}")
        
        if response.status_code == 200 or response.status_code == 201:
            short_link = response.json()["link"]
            print(f"DEBUG: Successfully shortened URL to: {short_link}")
            return short_link
        else:
            print(f"DEBUG: Error shortening URL - Status: {response.status_code}, Response: {response.text}")
            return long_url  # Fallback to long URL
    except Exception as e:
        print(f"DEBUG: Exception in get_short_url: {e}")
        print(f"DEBUG: Using fallback long URL")
        return long_url
    
# Helper function to send the recovery email
def send_recovery_email(recipient_email):
    try:
        print(f"DEBUG: Starting send_recovery_email for {recipient_email}")
        print(f"DEBUG: SMTP config - Server: {SMTP_SERVER}, Port: {SMTP_PORT}")
        print(f"DEBUG: Sender email: {SENDER_EMAIL}")
        
        msg = MIMEMultipart()
        msg['From'] = SENDER_EMAIL
        msg['To'] = recipient_email
        msg['Subject'] = "Password Reset Request"
        print(f"DEBUG: Email headers set")

        # Construct the long URL with the recipient's email
        encoded_email = urllib.parse.quote(recipient_email)
        long_url = f"https://willowy-twilight-157839.netlify.app/reset-password?email={encoded_email}"
        print(f"DEBUG: Long URL created: {long_url}")
        
        # Get a short URL from the dynamic URL shortener (e.g., Bitly)
        print(f"DEBUG: Getting short URL from Bitly...")
        short_reset_url = get_short_url(long_url)
        print(f"DEBUG: Short URL received: {short_reset_url}")

        # Email body content with hyperlink
        body = f"""
        <html>
            <body>
                <p>Hi,<br><br>
                You requested a password reset. Click the link below to reset your password:<br><br>
                <a href="{short_reset_url}">Reset Password</a><br><br>
                If you did not request this, please ignore this email.
                </p>
            </body>
        </html>
        """

        msg.attach(MIMEText(body, 'html'))
        print(f"DEBUG: Email body attached")

        # Send the email using Gmail's SMTP server
        print(f"DEBUG: Connecting to SMTP server...")
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        print(f"DEBUG: Connected to SMTP server")
        
        server.starttls()
        print(f"DEBUG: TLS encryption enabled")
        
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        print(f"DEBUG: Successfully logged into SMTP server as {SENDER_EMAIL}")

        server.sendmail(SENDER_EMAIL, recipient_email, msg.as_string())
        print(f"DEBUG: Email sent via SMTP")
        
        server.quit()
        print(f"DEBUG: SMTP connection closed")

        print(f"DEBUG: Recovery email sent successfully to {recipient_email}!")
    except smtplib.SMTPException as smtp_error:
        print(f"DEBUG: SMTP error occurred: {smtp_error}")
        print(f"DEBUG: SMTP error type: {type(smtp_error)}")
        import traceback
        print(f"DEBUG: SMTP error traceback: {traceback.format_exc()}")
    except Exception as e:
        print(f"DEBUG: General error in send_recovery_email: {e}")
        print(f"DEBUG: Error type: {type(e)}")
        import traceback
        print(f"DEBUG: Error traceback: {traceback.format_exc()}")

# Password recovery endpoint
# Create a model for the request body
class ForgotPasswordRequest(BaseModel):
    email: str

# Password recovery endpoint
@account_router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    try:
        print(f"DEBUG: Forgot password endpoint called")
        email = request.email  # Extract the email from the request body
        print(f"DEBUG: Received email: {email}")
        
        # Verify if the email exists in the database
        print(f"DEBUG: Checking if email exists in database...")
        cur.execute(f"SELECT email FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        print(f"DEBUG: Database query result: {user}")

        if not user:
            print(f"DEBUG: Email {email} not found in database")
            return {"success": False, "message": "Email not found"}

        print(f"DEBUG: Email found in database, sending recovery email...")
        # Send the recovery email
        send_recovery_email(email)
        print(f"DEBUG: Recovery email function completed")

        return {"success": True, "message": "Recovery email sent"}
    except Exception as e:
        print(f"DEBUG: Exception in forgot_password endpoint: {str(e)}")
        print(f"DEBUG: Exception type: {type(e)}")
        import traceback
        print(f"DEBUG: Full traceback: {traceback.format_exc()}")
        return {"success": False, "message": str(e)}



#Retrieve names and emails of all users for the administration page
class User(BaseModel):
    name: str
    email: str
@account_router.post("/list_database")
async def list_database():
    try:
        # Query the database to retrieve the names, emails, and Is_Admin status of all users
        cur.execute("SELECT username, email, COALESCE(is_admin, false) FROM users")
        rows = cur.fetchall()

        # Convert the query result into a list of dictionaries
        users = [{"name": row[0], "email": row[1], "is_admin": row[2]} for row in rows]
        

        return {"users": users}
    except Exception as e:
        return {"error": str(e)}


@account_router.post("/fetch_signup_requests")
async def fetch_signup_requests():
    try:
        # Query the database to retrieve sign-up requests
        cur.execute("SELECT username, email, pass, sponsormessage, desiresadmin FROM signupdata")
        rows = cur.fetchall()

        # Convert the query result into a list of dictionaries
        sign_up_requests = [{"name": row[0], "email": row[1], "password": row[2], "sponsor_message": row[3], "desired_access_level": row[4]} for row in rows]

        return {"signUpRequests": sign_up_requests}
    except Exception as e:
        return {"error": str(e)}




# Define a dependency to get the current user's role
@account_router.get("/userRole")
def get_user_role(email: str):
    try:
        # Query the database to retrieve the is_admin status of the user with the given email
        cur.execute(f"SELECT is_admin FROM users WHERE email = '{email}'")
        row = cur.fetchone()  # Assuming only one row per user
    
        if row:
            is_admin = row[0]
            return {"is_admin": is_admin}
        else:
            return {"error": "User not found"}
    except Exception as e:
        return {"error": str(e)}



# Define the edit_user_role endpoint
@account_router.post("/edit_user_role")
async def edit_user_role(user_info: dict):
    try:
        email = user_info.get('email')
        is_admin = user_info.get('is_admin')

        # Update the is_admin status of the user with the provided email
        cur.execute("UPDATE Users SET is_admin = %s WHERE email = %s", (is_admin, email))
        conn.commit()  # Commit the transaction
        
        return {"message": f"User role updated successfully."}
    except Exception as e:
        return {"error": str(e)}



# Define the delete_user endpoint
@account_router.post("/delete_user/{email}")
async def delete_user(email: str):
    try:
        # Query the database to get the role of the user with the provided email
        cur.execute("SELECT is_admin FROM Users WHERE email = %s", (email,))
        row = cur.fetchone()
        
        if row is None:
            return {"error": "User not found"}
        
        is_admin = row[0]
        
        if is_admin:
            return {"error": "Admin users cannot be deleted"}
        
        # Execute SQL query to delete the user with the provided email
        cur.execute("DELETE FROM Users WHERE email = %s", (email,))
        conn.commit()  # Commit the transaction
        
        return {"message": f"User with email '{email}' has been deleted successfully."}
    except Exception as e:
        return {"error": str(e)}



@account_router.post("/deny_request/{email}")
async def deny_request(email: str):
    try:
        # Delete the request with the provided email from the signupdata table
        cur.execute("DELETE FROM signupdata WHERE email = %s", (email,))
        conn.commit()  # Commit the transaction
        return {"success": True, "message": f"Request with email '{email}' has been denied and deleted successfully."}
    except Exception as e:
        return {"success": False, "message": str(e)}





class UpdateUsernameRequest(BaseModel):
    email: str
    new_username: str

class UpdateBioRequest(BaseModel):
    email: str
    bio: str

BIO_MAX_LENGTH = 300

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
        row = cur.fetchone()
        if not row:
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
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        cur.execute("UPDATE users SET username = %s WHERE email = %s", (request.new_username, request.email))
        conn.commit()
        return {"success": True, "message": "Username updated successfully.", "username": request.new_username}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))


#This takes the users email and password and then returns the account information to show for the profile page
@account_router.get("/profileAccount")
def profileAccount(email: str, password: str):
    # Get the salt from the db
    cur.execute(f"SELECT salt FROM users WHERE email = '{email}'")
    rows = cur.fetchall()
    if rows:
        # Convert the given password and the pepper (which is hardcoded) into bytes, concatenate the password, salt, and pepper together
        # Hash all of that so that it matches the password stored in the db
        password = hashlib.sha256(bytes(password, 'utf-8') + rows[0][0] + bytes("xe5Dx93xefx16x9ax12wy", 'utf-8')).hexdigest()
        # Retrieve the information after the user has been authenticated
        cur.execute(f"SELECT username, email, is_admin FROM users WHERE email = '{email}' AND hashedpassword = '{password}'")
        rows = cur.fetchall()
        return {"Account Information": rows}



@account_router.post("/uploadSignup")
async def signup_data(
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    sponsor_message: str = Form(None),
    desires_admin: bool = Form(False)
):
    try:
        if username and email and password:
            # Find the maximum SignupID in the table and increment it
            cur.execute("SELECT MAX(SignupID) FROM SignupData")
            max_signup_id = cur.fetchone()[0] or 0
            signup_id = max_signup_id + 1
            
            # Check if email already exists
            cur.execute(f"SELECT COUNT(*) FROM SignupData WHERE Email = '{email}'")
            if cur.fetchone()[0] > 0:
                return {"success": False, "message": "Email must be unique"}
            
            # Insert data into SignupData table
            cur.execute("INSERT INTO SignupData (SignupID, Username, Email, Pass, SponsorMessage, DesiresAdmin) VALUES (%s, %s, %s, %s, %s, %s)", (signup_id, username, email, password, sponsor_message, desires_admin))
            conn.commit()
            
            return {"success": True, "message": "New signup data added successfully"}
        else:
            return {"success": False, "message": "All fields must be filled in"}
    except Exception as e:
        return {"success": False, "message": str(e)}





@account_router.post("/uploadAccount")
async def upload_account(
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    role: bool = Form(...),  
):
    try:
        # Convert role parameter to boolean

        if username and email and password:
            # Check if email already exists
            cur.execute(f"SELECT userid FROM users WHERE email = '{email}'")
            if cur.fetchone():
                return {"success": False, "message": "Email must be unique"}

            # Get the maximum existing user ID and increment it
            cur.execute("SELECT MAX(userid) FROM users")
            max_userid = cur.fetchone()[0] or 0
            userid = max_userid + 1

            # Generate salt and hash password
            salt = os.urandom(32)
            hashpass = hashlib.sha256(bytes(password, 'utf-8') + salt + bytes("xe5Dx93xefx16x9ax12wy", 'utf-8')).hexdigest()

            # Insert user data into the database
            cur.execute("INSERT INTO users (userid, username, hashedpassword, email, salt, is_admin) VALUES (%s, %s, %s, %s, %s, %s)", (userid, username, hashpass, email, salt, role))
            conn.commit()
            return {"success": True, "message": "New account added successfully"}
        else:
            return {"success": False, "message": "All fields must be filled in"}
    except Exception as e:
        return {"success": False, "message": str(e)}






@account_router.get("/profileCards")
def profileCards(username: str):
    cur.execute(f"""
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
            COALESCE(
                json_agg(
                    DISTINCT jsonb_build_object(
                        'fileid', f.fileid,
                        'filename', f.filename,
                        'file_link', f.file_link,
                        'fileextension', f.fileextension,
                        'filesize', f.filesize,
                        'datesubmitted', f.datesubmitted
                    )
                ) FILTER (WHERE f.fileid IS NOT NULL),
                '[]'
            ) AS files
        FROM Cards c
        INNER JOIN Categories cat ON c.CategoryID = cat.CategoryID
        LEFT JOIN Files f ON c.CardID = f.CardID
        LEFT JOIN CardTags ct ON c.CardID = ct.CardID
        LEFT JOIN Tags t ON ct.TagID = t.TagID
        INNER JOIN Users u ON c.UserID = u.UserID
        WHERE u.Username = %s
        GROUP BY c.CardID, cat.CategoryLabel, u.Username, u.Email
        ORDER BY c.CardID DESC;
    """, (username,))

    rows = cur.fetchall()
    columns = [
        "username", "email", "title", "category", "date", "description", "org", 
        "funding", "link", "tags", "latitude", "longitude", "files"
    ]
    data = [dict(zip(columns, row)) for row in rows]
    return {"data": data}


