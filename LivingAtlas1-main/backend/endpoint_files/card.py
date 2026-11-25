"""
card
    delete card
    download file      
    upload form         

"""

from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, Query
from database import conn, cur
from typing import Optional
import logging
import psycopg2
import os
import uuid
import json
import re
import tempfile
from endpoint_files.description_attachments import parse_attachment_tokens, resolve_attachment_token
from database import get_connection, get_request_connection, release_request_connection
from sessions import bearer_token, require_account
from .file_utils import compress_file #importing my function that handles compressing files for use in /uploadForm


card_router = APIRouter()
logger = logging.getLogger(__name__)

from . import azure_storage
DEFAULT_THUMBNAIL_URL = azure_storage.build_url("thumbnails/default_cereo_thumbnail.png")


# Function to delete a blob from Azure Blob Storage (images container)
def delete_from_bucket(blob_name):
    try:
        azure_storage.delete_blob(blob_name)
        print(f"File: {blob_name} deleted.")
    except Exception as e:
        print(e)
        return

# Function to upload a local file to Azure Blob Storage (images container)
def upload_to_bucket(destination_path, local_path, file_type, bucket_name):
    try:
        with open(local_path, "rb") as f:
            data = f.read()
        url = azure_storage.upload_bytes(destination_path, data, file_type, bucket_name)
        print(f"[UPLOAD SUCCESS] {destination_path}")
        return url
    except Exception as e:
        print(f"[UPLOAD ERROR] {e}")
        return False

# Function to upload a thumbnail image to Azure Blob Storage and return its URL
def upload_image(file: Optional[UploadFile]) -> str:
    if not file:
        return DEFAULT_THUMBNAIL_URL

    allowed_extensions = {"png", "jpg", "jpeg", "gif", "webp", "bmp"}
    if '.' not in file.filename or file.filename.rsplit('.', 1)[1].lower() not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Invalid thumbnail file type. Allowed: PNG, JPG, JPEG, GIF, WebP")

    from .image_processing import prepare_image
    _, display, _, _ = prepare_image(file)
    try:
        return azure_storage.upload_bytes(f"thumbnails/{uuid.uuid4()}.webp", display, 'image/webp')
    except Exception:
        raise HTTPException(status_code=503, detail="Image storage is unavailable. Please retry.")


@card_router.post("/create-card")
async def create_card(
    title: str = Form(...),
    description: str = Form(...),
    thumbnail: UploadFile = File(None)
):
    thumbnail_link = upload_image(thumbnail) if thumbnail else DEFAULT_THUMBNAIL_URL
    cur.execute("INSERT INTO Cards (title, description, thumbnail_link) VALUES (%s, %s, %s)",
                (title, description, thumbnail_link))
    conn.commit()
    return {"message": "Card created successfully", "thumbnail_link": thumbnail_link}

@card_router.delete("/deleteCard")
async def deleteCard(username: str, title: str, card_id: Optional[int] = Query(None, gt=0),
                     token=Depends(bearer_token)):
    connection = get_request_connection()
    if connection is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable")
    try:
        with connection, connection.cursor() as cursor:
            requester_id, _, requester_is_admin = require_account(cursor, token)

            # Keep the saved owner and title as a guard against stale views.
            # The legacy card allocator can reuse the highest deleted ID.
            lookup = """
                SELECT c.CardID, c.Thumbnail_Link, c.UserID
                FROM Cards c
                JOIN Users u ON c.UserID = u.UserID
                WHERE u.Username = %s AND c.Title = %s
            """
            params = (username, title)
            if card_id is not None:
                lookup += " AND c.CardID = %s"
                params += (card_id,)
            cursor.execute(lookup + " LIMIT 2 FOR UPDATE OF c", params)
            matches = cursor.fetchall()
            if not matches:
                raise HTTPException(status_code=404, detail="Card not found")
            target_id, thumbnail_url, owner_id = matches[0]
            if not requester_is_admin and requester_id != owner_id:
                raise HTTPException(status_code=403, detail="You do not have permission to delete this card")
            if len(matches) > 1:
                raise HTTPException(status_code=409, detail="More than one card matches. Refresh the card list and try again.")

            cursor.execute("DELETE FROM Favorites WHERE CardID = %s", (target_id,))
            cursor.execute("DELETE FROM CardTags WHERE CardID = %s", (target_id,))
            cursor.execute("DELETE FROM Files WHERE CardID = %s RETURNING File_Link", (target_id,))
            assets = {url for (url,) in cursor.fetchall()}
            cursor.execute("DELETE FROM CardImages WHERE CardID = %s RETURNING ImageURL, OriginalURL", (target_id,))
            assets.update(url for image in cursor.fetchall() for url in image)
            assets.add(thumbnail_url)
            cursor.execute("DELETE FROM Cards WHERE CardID = %s", (target_id,))

            # Older uploads can reference the same backing file from several cards.
            assets = {
                url for url in assets
                if url and url not in {'/CEREO-logo.png', 'CEREO-logo.png'}
                and not url.endswith('/thumbnails/default_cereo_thumbnail.png')
            }
            if assets:
                urls = list(assets)
                cursor.execute("""
                    SELECT Thumbnail_Link FROM Cards WHERE Thumbnail_Link = ANY(%s)
                    UNION
                    SELECT File_Link FROM Files WHERE File_Link = ANY(%s)
                    UNION
                    SELECT ImageURL FROM CardImages WHERE ImageURL = ANY(%s)
                    UNION
                    SELECT OriginalURL FROM CardImages WHERE OriginalURL = ANY(%s)
                """, (urls, urls, urls, urls))
                assets.difference_update(url for (url,) in cursor.fetchall())
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to delete card")
        raise HTTPException(status_code=500, detail="Failed to delete card. Please try again.")
    finally:
        release_request_connection(connection)

    # Only remove assets after their card transaction has committed.
    for url in assets:
        try:
            azure_storage.delete_from_url(url)
        except Exception:
            logger.warning("Could not remove an asset for deleted card %s", target_id)
    return {"Success": "The card is deleted"}

@card_router.delete("/deleteFile")
async def delete_file(fileID: int):
    """
    Deletes a file from both the database and Azure Blob Storage.
    """
    try:
        # Get file info
        cur.execute("SELECT file_link FROM Files WHERE fileid = %s", (fileID,))
        result = cur.fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="File not found")

        file_link = result[0]

        # Delete from Azure Blob
        try:
            azure_storage.delete_from_url(file_link)
            print(f"[FILE DELETE] Deleted from Azure: {file_link}")
        except Exception as e:
            print(f"[WARN] Could not delete from Azure: {e}")

        # Delete from DB
        cur.execute("DELETE FROM Files WHERE fileid = %s", (fileID,))
        conn.commit()

        return {"success": True, "message": f"File {fileID} deleted successfully."}

    except Exception as e:
        conn.rollback()
        print(f"[DELETE FILE ERROR] {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting file: {e}")

@card_router.post("/bookmarkCard")
async def bookmark_card(username: str = Form(...), cardID: int = Form(...)):
    try:
        print(f"[BOOKMARK] Incoming request: username={username}, cardID={cardID}")
        cur.execute("""
            INSERT INTO Favorites (UserID, CardID)
            SELECT u.UserID, %s
            FROM Users u
            WHERE LOWER(u.Username) = LOWER(%s)
            ON CONFLICT DO NOTHING
        """, (cardID, username))
        conn.commit()
        return {"message": "Card bookmarked successfully"}
    except Exception as e:
        print(f"[BOOKMARK ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@card_router.post("/unbookmarkCard")
async def unbookmark_card(username: str = Form(...), cardID: int = Form(...)):
    try:
        print(f"[UNBOOKMARK] Incoming request: username={username}, card_id={cardID}")
        cur.execute("""
            DELETE FROM Favorites
            WHERE UserID = (SELECT UserID FROM Users WHERE LOWER(Username) = LOWER(%s))
              AND CardID = %s
        """, (username, cardID))
        conn.commit()
        return {"message": "Card removed from bookmarks"}
    except Exception as e:
        print(f"[UNBOOKMARK ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@card_router.get("/getBookmarkedCards")
def get_bookmarked_cards(username: str):
    try:
        username = username.strip()
        cur.execute("SELECT UserID FROM Users WHERE LOWER(Username) = LOWER(%s)", (username,))
        result = cur.fetchone()

        if not result:
            return {"bookmarkedCards": []}

        user_id = result[0]
        cur.execute("""
            SELECT c.CardID AS "cardID"
            FROM Favorites f
            JOIN Cards c ON f.CardID = c.CardID
            WHERE f.UserID = %s
        """, (user_id,))

        rows = cur.fetchall()
        columns = ["cardID"]
        data = [dict(zip(columns, row)) for row in rows]
        return {"bookmarkedCards": data}

    except Exception as e:
        print(f"[EXCEPTION] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@card_router.get("/downloadFile")
def downloadFile(fileID: int):
    """Return attachment bytes; headers on redirects do not force downloads."""
    connection = get_request_connection()
    if connection is None:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable")
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT filename, file_link, fileextension FROM files WHERE fileid = %s", (fileID,))
            result = cursor.fetchone()
    finally:
        release_request_connection(connection)
    if result is None:
        raise HTTPException(status_code=404, detail="File not found in the database")
    from .attachment_download import attachment_response
    return attachment_response(*result)

@card_router.get("/card/{card_id}")
def get_card_by_id(card_id: int):
    """
    Fetch a single card's thumbnail_link by CardID.
    Called by the frontend when a card is rendered without a thumbnail.
    """
    try:
        # Use a request-local cursor to avoid cross-request result corruption.
        with conn.cursor() as local_cur:
            local_cur.execute("SELECT Thumbnail_Link FROM Cards WHERE CardID = %s", (card_id,))
            result = local_cur.fetchone()
        if result is None:
            raise HTTPException(status_code=404, detail="Card not found")
        return {"thumbnail_link": result[0]}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[GET CARD] Error fetching card {card_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@card_router.get("/allCards")
def allCards(viewer_email: Optional[str] = None,
             limit: Optional[int] = Query(None, ge=1, le=500),
             offset: int = Query(0, ge=0)):
    """
    Fetch all cards and their associated data (tags, files, etc.),
    while cleaning up filenames to remove the '.zip' suffix for display.
    If viewer_email is provided, private cards from other users are excluded.
    """
    connection = None
    try:
        connection = get_request_connection()
        if connection is None:
            raise HTTPException(status_code=503, detail="Database connection unavailable")

        with connection.cursor() as local_cur:
            local_cur.execute("""
            SELECT
                u.Username,
                u.Email,
                COALESCE(c.ContactEmail, u.Email) AS contact_email,
                COALESCE(c.Name, '') AS Name,
                c.Title,
                c.CardID,
                cat.CategoryLabel,
                COALESCE(c.DatePosted, CURRENT_DATE) AS DatePosted,
                c.Description,
                c.Organization,
                c.Funding,
                c.Link,
                COALESCE(c.LinkText, '') AS LinkText,
                STRING_AGG(DISTINCT t.TagLabel, ', ') AS TagLabels,
                c.Latitude,
                c.Longitude,
                c.Thumbnail_Link,
                COALESCE(c.LocationType, 'point') AS LocationType,
                COALESCE(c.PolygonFillColor, '#0077c0') AS PolygonFillColor,
                COALESCE(c.PolygonLineStyle, 'solid') AS PolygonLineStyle,
                COALESCE(
                    (
                        SELECT json_agg(
                            jsonb_build_object(
                                'imageID', ci.ImageID,
                                'url', ci.ImageURL,
                                'original_url', COALESCE(ci.OriginalURL, ci.ImageURL),
                                'width', ci.ImageWidth, 'height', ci.ImageHeight,
                                'presentation', ci.Presentation,
                                'displayOrder', ci.DisplayOrder,
                                'alt', ci.AltText
                            )
                            ORDER BY ci.DisplayOrder ASC, ci.ImageID ASC
                        )
                        FROM CardImages ci
                        WHERE ci.CardID = c.CardID
                    ),
                    '[]'
                ) AS images,
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'fileid', f.fileid,
                            'filename', f.filename,
                            'file_link', f.file_link,
                            'fileextension', f.fileextension
                        )
                    ) FILTER (WHERE f.fileid IS NOT NULL),
                    '[]'
                ) AS files,
                COALESCE(
                    (
                        SELECT json_agg(
                            jsonb_build_object(
                                'lat', pv.Latitude,
                                'lng', pv.Longitude,
                                'ring', COALESCE(pv.RingIndex, 0),
                                'fillColor', COALESCE(pv.FillColor, c.PolygonFillColor, '#0077c0'),
                                'fillOpacity', COALESCE(pv.FillOpacity, 0.2),
                                'lineStyle', COALESCE(pv.LineStyle, c.PolygonLineStyle, 'solid'),
                                'icon', pv.Icon,
                                'markerColor', pv.FillColor,
                                'markerOpacity', pv.FillOpacity
                            )
                            ORDER BY COALESCE(pv.RingIndex, 0) ASC, pv.VertexOrder ASC
                        )
                        FROM CardPolygonVertices pv
                        WHERE pv.CardID = c.CardID
                    ),
                    '[]'
                ) AS polygon_vertices,
                COALESCE(c.is_public, TRUE) AS is_public,
                COALESCE(c.GalleryLayout, 'featured') AS gallery_layout,
                c.GalleryImageIDs AS gallery_image_ids
            FROM Cards c
            INNER JOIN Categories cat ON c.CategoryID = cat.CategoryID
            LEFT JOIN Files f ON c.CardID = f.CardID
            LEFT JOIN CardTags ct ON c.CardID = ct.CardID
            LEFT JOIN Tags t ON ct.TagID = t.TagID
            INNER JOIN Users u ON c.UserID = u.UserID
            WHERE (COALESCE(c.is_public, TRUE) = TRUE OR u.Email = %(viewer_email)s)
            GROUP BY
                c.CardID,
                cat.CategoryLabel,
                u.Username,
                u.Email,
                c.Name
            ORDER BY c.CardID DESC
            LIMIT %(limit)s OFFSET %(offset)s;
        """, {"viewer_email": viewer_email, "limit": limit, "offset": offset})

            rows = local_cur.fetchall()

        columns = [
            "username", "email", "contact_email", "name", "title", "cardID", "category", "date", "description",
            "org", "funding", "link", "link_text", "tags", "latitude", "longitude", "thumbnail_link",
            "location_type", "polygon_fill_color", "polygon_line_style", "images", "files", "polygon_vertices",
            "is_public", "gallery_layout", "gallery_image_ids"
        ]

        data = [dict(zip(columns, row)) for row in rows]

        # Clean up filenames for display — remove .zip suffix
        for card in data:
            if isinstance(card.get("files"), list):
                for file in card["files"]:
                    if file.get("filename") and file["filename"].lower().endswith(".zip"):
                        file["filename"] = file["filename"][:-4]  # strip ".zip"

        return {"data": data}

    except HTTPException:
        raise
    except Exception as e:
        print(f"An error occurred while fetching all cards: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if connection is not None:
            release_request_connection(connection)
    
from .file_utils import compress_file
import tempfile

@card_router.post("/uploadForm")
async def upload_form(
    update: Optional[bool] = Form(False),
    title: str = Form(...),
    email: str = Form(...),
    contact_email: Optional[str] = Form(None),
    defer_images: bool = Form(False),
    image_presentations: Optional[str] = Form(None),
    username: str = Form(...),
    name: str = Form(...),
    original_username: Optional[str] = Form(None),
    original_email: Optional[str] = Form(None),
    original_title: Optional[str] = Form(None),
    session_token: str = Depends(bearer_token),
    cardID: Optional[int] = Form(None, gt=0),
    is_public: Optional[str] = Form("true"),
    gallery_layout: Optional[str] = Form(None),
    gallery_image_ids: Optional[str] = Form(None),
    category: Optional[str] = Form("None"),
    latitude: Optional[str] = Form(None),
    longitude: Optional[str] = Form(None),
    location_type: Optional[str] = Form("point"),
    polygon_coordinates: Optional[str] = Form(None),
    polygon_fill_color: Optional[str] = Form(None),
    polygon_fill_opacity: Optional[str] = Form(None),
    polygon_line_style: Optional[str] = Form(None),
    multipoint_coordinates: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    description_file_tokens: Optional[str] = Form(None),
    funding: Optional[str] = Form(None),
    org: Optional[str] = Form(None),
    link: Optional[str] = Form(None),
    link_text: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    files: Optional[list[UploadFile]] = File(None),
    thumbnail: Optional[UploadFile] = File(None),
    thumbnail_link: Optional[str] = Form(None),
    images: Optional[list[UploadFile]] = File(None)
):
    """
    Create or update a Card with metadata, thumbnail, and optional files.
    Ensures uploaded files are compressed, stored in Azure, and recorded in the database.
    email identifies the owning account; contact_email is independent project metadata.
    """
    from .image_presentation import parse_presentation
    presentations = {}
    if image_presentations is not None:
        try:
            parsed = json.loads(image_presentations)
            if not isinstance(parsed, dict) or len(parsed) > 30:
                raise ValueError()
            for key, value in parsed.items():
                if not key.isdecimal() or int(key) <= 0:
                    raise ValueError()
                presentations[int(key)] = parse_presentation(value)
        except (ValueError, TypeError):
            raise HTTPException(422, 'Invalid image framing selection.')
    if contact_email is not None:
        contact_email = contact_email.strip()
        if len(contact_email) > 255 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", contact_email):
            raise HTTPException(status_code=422, detail="Enter a valid contact email (up to 255 characters).")
    if gallery_layout is not None and gallery_layout not in {
        'multi', 'featured', 'grid-1', 'grid-2', 'grid-3', 'grid-4', 'grid-5', 'grid-6', 'grid-7', 'grid-8', 'slideshow'
    }:
        raise HTTPException(status_code=422, detail="Invalid gallery layout")
    selected_image_ids = None
    if gallery_image_ids is not None:
        try:
            selected_image_ids = json.loads(gallery_image_ids)
        except (ValueError, TypeError):
            raise HTTPException(status_code=422, detail="Invalid gallery image selection")
        if (not isinstance(selected_image_ids, list) or len(selected_image_ids) > 6
                or any(type(image_id) is not int or image_id <= 0 for image_id in selected_image_ids)
                or len(set(selected_image_ids)) != len(selected_image_ids)):
            raise HTTPException(status_code=422, detail="Select at most 6 distinct card images")
    from endpoint_files.images import MAX_CARD_IMAGES
    if images and len(images) > MAX_CARD_IMAGES:
        raise HTTPException(status_code=422, detail=f"A card can have at most {MAX_CARD_IMAGES} images")
    enable_commits = False
    thumbnail_asset = None
    metadata_committed = False
    try:
        attachment_tokens = parse_attachment_tokens(description_file_tokens, len(files or []), description)
    except (ValueError, TypeError) as error:
        raise HTTPException(status_code=422, detail=str(error))
    print(f"[UPLOAD] username={username}, email={email}, orig_username={original_username or ''}, orig_email={original_email or ''}")
    print(f"[UPLOAD] location_type={location_type}, polygon_fill_color={polygon_fill_color!r}, polygon_line_style={polygon_line_style!r}")
    print(f"[UPLOAD] polygon_coordinates (first 200 chars): {str(polygon_coordinates)[:200] if polygon_coordinates else 'None'}")

    upload_conn = get_request_connection()
    if upload_conn is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable")
    upload_cur = None
    try:
        upload_cur = upload_conn.cursor()
        requester_id, _, requester_is_admin = require_account(upload_cur, session_token)
        if update:
            lookup = """
                SELECT c.CardID, c.UserID, u.Username
                FROM Cards c JOIN Users u ON u.UserID = c.UserID
                WHERE u.Username = %s AND u.Email = %s AND c.Title = %s
            """
            params = (original_username, original_email, original_title or title)
            if cardID is not None:
                lookup += " AND c.CardID = %s"
                params += (cardID,)
            upload_cur.execute(lookup + " LIMIT 2 FOR UPDATE OF c", params)
            matches = upload_cur.fetchall()
            if not matches:
                raise HTTPException(
                    status_code=404,
                    detail="Card not found for update. Refresh the project list and try again.",
                )
            nextcardid, userID, current_username = matches[0]
            if requester_id != userID and not requester_is_admin:
                raise HTTPException(status_code=403, detail="You do not have permission to edit this card")
            if len(matches) > 1:
                raise HTTPException(status_code=409, detail="More than one card matches. Refresh the project list and try again.")
            if username != current_username:
                if not requester_is_admin:
                    raise HTTPException(status_code=403, detail="Only an admin can change the project creator")
                upload_cur.execute("SELECT UserID FROM Users WHERE username = %s AND email = %s", (username, email))
                new_owner = upload_cur.fetchone()
                if not new_owner:
                    raise HTTPException(
                        status_code=404,
                        detail="Card Creator username does not exist. Please enter a valid existing username.",
                    )
                userID = new_owner[0]
        else:
            upload_cur.execute(
                "SELECT userID FROM Users WHERE username = %s AND email = %s",
                (username, email)
            )
            user_row = upload_cur.fetchone()
            if not user_row:
                raise HTTPException(status_code=404, detail="No account matches this username and account email. Please sign in again before uploading.")
            if user_row[0] != requester_id:
                raise HTTPException(status_code=403, detail="Create the project with the account you are signed in to.")
            userID = requester_id
            upload_cur.execute("SELECT MAX(CardID) FROM Cards")
            maxcardid = upload_cur.fetchone()
            nextcardid = (maxcardid[0] or 0) + 1

        # --------------------------------------------------
        # Map category name to ID
        # --------------------------------------------------
        category_map = {"River": 1, "Watershed": 2, "Places": 3, "None": 4, "Other": 5}
        if category not in category_map:
            raise HTTPException(status_code=400, detail="Invalid category")
        categoryID = category_map[category]

        # --------------------------------------------------
        # Validate inputs
        # --------------------------------------------------
        if len(title) > 255:
            raise HTTPException(status_code=400, detail="Title exceeds 255 characters")

        # For polygon/image overlays, compute centroid from vertices if lat/lng not provided
        if (location_type in ("polygon", "image")) and polygon_coordinates and (not latitude or not longitude):
            try:
                parsed_coords = json.loads(polygon_coordinates)
                # Handle envelope format: { vertices: [...], fillColor, lineStyle }
                if isinstance(parsed_coords, dict) and "vertices" in parsed_coords:
                    verts = parsed_coords["vertices"]
                else:
                    verts = parsed_coords
                if len(verts) >= 3:
                    latitude_val = sum(float(v["lat"]) for v in verts) / len(verts)
                    longitude_val = sum(float(v["lng"]) for v in verts) / len(verts)
                else:
                    raise HTTPException(status_code=400, detail="Polygon must have at least 3 vertices")
            except (json.JSONDecodeError, KeyError):
                raise HTTPException(status_code=400, detail="Invalid polygon_coordinates format")
        elif latitude and longitude:
            try:
                latitude_val = float(latitude)
                longitude_val = float(longitude)
            except ValueError:
                raise HTTPException(status_code=400, detail="Latitude/Longitude must be numeric")
            if not (-90 <= latitude_val <= 90):
                raise HTTPException(status_code=400, detail="Latitude must be between -90 and 90")
            if not (-180 <= longitude_val <= 180):
                raise HTTPException(status_code=400, detail="Longitude must be between -180 and 180")
        else:
            raise HTTPException(status_code=400, detail="Either lat/lng or polygon coordinates are required")

        print(f"[VALIDATED] CardID={nextcardid}, category={categoryID}")

        # --------------------------------------------------
        # Upload thumbnail (custom or default)
        # --------------------------------------------------
        if thumbnail is not None:
            # User uploaded a new file
            if location_type == 'image':
                thumbnail_url = upload_image(thumbnail)
            else:
                from .images import save_image_asset
                thumbnail_asset = save_image_asset(thumbnail)
                thumbnail_url = thumbnail_asset['url']
        elif thumbnail_link:
            # User kept the existing thumbnail
            thumbnail_url = thumbnail_link
        else:
            # No thumbnail provided at all — use default
            thumbnail_url = None if update else DEFAULT_THUMBNAIL_URL

        print(f"[THUMBNAIL HANDLING] Using thumbnail URL: {thumbnail_url}")

        # --------------------------------------------------
        # Insert or update card metadata
        # --------------------------------------------------
        enable_commits = False
        if update:
            upload_cur.execute("""
                UPDATE Cards
                SET Name=%s, Title=%s, Latitude=%s, Longitude=%s, CategoryID=%s,
                    Description=%s, Organization=%s, Funding=%s, Link=%s, LinkText=%s,
                    Thumbnail_Link=COALESCE(%s, Thumbnail_Link), UserID=%s,
                    LocationType=%s, PolygonFillColor=%s, PolygonLineStyle=%s,
                    is_public=%s, ContactEmail=COALESCE(%s, ContactEmail), GalleryLayout=COALESCE(%s, GalleryLayout)
                WHERE CardID=%s
            """, (name, title, latitude_val, longitude_val, categoryID, description, org,
                  funding, link, link_text, thumbnail_url, userID, location_type or "point",
                  polygon_fill_color or '#0077c0', polygon_line_style or 'solid',
                  (is_public or 'true').lower() != 'false', contact_email, gallery_layout, nextcardid))
            if thumbnail_asset:
                from .images import reserve_image_slots
                reserve_image_slots(nextcardid, 1, cursor=upload_cur)
                upload_cur.execute("""
                    INSERT INTO CardImages (CardID, ImageURL, DisplayOrder, AltText, OriginalURL, ImageWidth, ImageHeight)
                    VALUES (%s, %s, (SELECT COALESCE(MAX(DisplayOrder), -1)+1 FROM CardImages WHERE CardID=%s), '', %s, %s, %s)
                """, (nextcardid, thumbnail_url, nextcardid, thumbnail_asset['original_url'], thumbnail_asset['width'], thumbnail_asset['height']))
            upload_cur.execute("DELETE FROM CardTags WHERE CardID=%s", (nextcardid,))
            # Delete old polygon vertices on update
            upload_cur.execute("DELETE FROM CardPolygonVertices WHERE CardID=%s", (nextcardid,))
        else:
            upload_cur.execute("""
                INSERT INTO Cards
                    (CardID, UserID, Name, Title, Latitude, Longitude, CategoryID,
                     Description, Organization, Funding, Link, LinkText, Thumbnail_Link, LocationType,
                     PolygonFillColor, PolygonLineStyle, is_public, ContactEmail, GalleryLayout)
                VALUES
                    (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (nextcardid, userID, name, title, latitude_val, longitude_val,
                  categoryID, description, org, funding, link, link_text, thumbnail_url, location_type or "point",
                  polygon_fill_color or '#0077c0', polygon_line_style or 'solid',
                  (is_public or 'true').lower() != 'false', contact_email if contact_email is not None else email, gallery_layout or 'featured'))

        # --------------------------------------------------
        # Handle overlay vertices (polygon/image)
        # --------------------------------------------------
        if presentations:
            upload_cur.execute("SELECT ImageID FROM CardImages WHERE CardID=%s", (nextcardid,))
            owned = {row[0] for row in upload_cur.fetchall()}
            if not set(presentations).issubset(owned):
                raise HTTPException(422, 'Framing can only be changed for this project’s images.')
            for image_id, presentation in presentations.items():
                upload_cur.execute("UPDATE CardImages SET Presentation=%s::jsonb WHERE CardID=%s AND ImageID=%s", (json.dumps(presentation), nextcardid, image_id))

        if selected_image_ids is not None:
            upload_cur.execute("SELECT ImageID FROM CardImages WHERE CardID=%s", (nextcardid,))
            owned_image_ids = {row[0] for row in upload_cur.fetchall()}
            if not set(selected_image_ids).issubset(owned_image_ids):
                raise HTTPException(status_code=422, detail="Selected images must belong to this card")
            upload_cur.execute("UPDATE Cards SET GalleryImageIDs=%s::jsonb WHERE CardID=%s", (json.dumps(selected_image_ids), nextcardid))
            from endpoint_files.images import sync_gallery_thumbnail
            sync_gallery_thumbnail(nextcardid, cursor=upload_cur)

        if location_type in ("polygon", "image") and polygon_coordinates:
            try:
                parsed = json.loads(polygon_coordinates)
                ring_styles = []
                # Support new envelope format: { vertices: [...], fillColor, lineStyle }
                # Extract style from JSON envelope when Form params are missing/default
                if isinstance(parsed, dict):
                    if not polygon_fill_color and parsed.get("fillColor"):
                        polygon_fill_color = parsed["fillColor"]
                    if not polygon_fill_opacity and parsed.get("fillOpacity") is not None:
                        polygon_fill_opacity = str(parsed["fillOpacity"])
                    if not polygon_line_style and parsed.get("lineStyle"):
                        polygon_line_style = parsed["lineStyle"]
                    if isinstance(parsed.get("ringStyles"), list):
                        ring_styles = parsed["ringStyles"]

                # Determine rings: new multi-ring format {rings: [[{lat,lng},...], ...]} or
                # legacy single-ring format {vertices: [{lat,lng},...]} or plain array
                if isinstance(parsed, dict) and "rings" in parsed:
                    rings = parsed["rings"]  # list of rings (each ring = list of vertices)
                elif isinstance(parsed, dict) and "vertices" in parsed:
                    rings = [parsed["vertices"]]  # single ring
                elif isinstance(parsed, list):
                    rings = [parsed]  # legacy plain array
                else:
                    rings = []

                if not polygon_fill_color and ring_styles and isinstance(ring_styles[0], dict):
                    polygon_fill_color = ring_styles[0].get("fillColor") or polygon_fill_color
                if not polygon_line_style and ring_styles and isinstance(ring_styles[0], dict):
                    polygon_line_style = ring_styles[0].get("lineStyle") or polygon_line_style

                minimum_vertices = 4 if location_type == "image" else 3
                # For polygon: require at least one ring with enough vertices
                all_vertices_flat = [v for ring in rings for v in ring]
                if not rings or len(all_vertices_flat) < minimum_vertices:
                    raise HTTPException(
                        status_code=400,
                        detail="Image overlay must have 4 vertices" if location_type == "image" else "Polygon must have at least 3 vertices"
                    )

                # Re-run UPDATE with the (possibly corrected) style values
                upload_cur.execute("""
                    UPDATE Cards SET PolygonFillColor=%s, PolygonLineStyle=%s WHERE CardID=%s
                """, (polygon_fill_color or '#0077c0', polygon_line_style or 'solid', nextcardid))

                total_inserted = 0
                for ring_idx, ring in enumerate(rings):
                    ring_style = ring_styles[ring_idx] if ring_idx < len(ring_styles) and isinstance(ring_styles[ring_idx], dict) else {}
                    ring_fill_color = ring_style.get("fillColor") or polygon_fill_color or '#0077c0'
                    ring_line_style = ring_style.get("lineStyle") or polygon_line_style or 'solid'
                    ring_fill_opacity_raw = ring_style.get("fillOpacity", polygon_fill_opacity)
                    try:
                        ring_fill_opacity = float(ring_fill_opacity_raw) if ring_fill_opacity_raw is not None else 0.2
                    except (TypeError, ValueError):
                        ring_fill_opacity = 0.2
                    for vertex_order, vertex in enumerate(ring):
                        v_lat = float(vertex["lat"])
                        v_lng = float(vertex["lng"])
                        if not (-90 <= v_lat <= 90) or not (-180 <= v_lng <= 180):
                            raise HTTPException(status_code=400, detail=f"Vertex {vertex_order} in ring {ring_idx} has invalid coordinates")
                        upload_cur.execute(
                            """
                            INSERT INTO CardPolygonVertices
                                (CardID, RingIndex, VertexOrder, Latitude, Longitude, FillColor, FillOpacity, LineStyle)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (nextcardid, ring_idx, vertex_order, v_lat, v_lng, ring_fill_color, ring_fill_opacity, ring_line_style)
                        )
                        total_inserted += 1
                print(f"[DB] Polygon vertices inserted: {total_inserted} points in {len(rings)} ring(s), fillColor={polygon_fill_color}, lineStyle={polygon_line_style}")
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid polygon_coordinates JSON format")

        # --------------------------------------------------
        # Handle multi-point cards (multiple markers, optional per-point icon)
        # --------------------------------------------------
        if location_type == "multipoint" and multipoint_coordinates:
            try:
                parsed_points = json.loads(multipoint_coordinates)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid multipoint_coordinates JSON format")

            if isinstance(parsed_points, dict) and isinstance(parsed_points.get("points"), list):
                parsed_points = parsed_points["points"]
            if not isinstance(parsed_points, list) or len(parsed_points) < 1:
                raise HTTPException(status_code=400, detail="Multi-point card must have at least one point")

            mp_inserted = 0
            for point_order, point in enumerate(parsed_points):
                p_lat = float(point["lat"])
                p_lng = float(point["lng"])
                if not (-90 <= p_lat <= 90) or not (-180 <= p_lng <= 180):
                    raise HTTPException(status_code=400, detail=f"Point {point_order} has invalid coordinates")
                p_icon = point.get("icon") if isinstance(point, dict) else None
                if isinstance(p_icon, str):
                    p_icon = p_icon[:60]
                p_color = point.get("color") if isinstance(point, dict) else None
                if isinstance(p_color, str):
                    p_color = p_color[:20]
                else:
                    p_color = None
                p_opacity = point.get("opacity") if isinstance(point, dict) else None
                try:
                    p_opacity = min(1.0, max(0.0, float(p_opacity))) if p_opacity is not None else None
                except (TypeError, ValueError):
                    p_opacity = None
                upload_cur.execute(
                    """
                    INSERT INTO CardPolygonVertices
                        (CardID, RingIndex, VertexOrder, Latitude, Longitude, Icon, FillColor, FillOpacity)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (nextcardid, 0, point_order, p_lat, p_lng, p_icon, p_color, p_opacity)
                )
                mp_inserted += 1
            print(f"[DB] Multi-point markers inserted: {mp_inserted} points")

        print("[DB] Card record inserted/updated")
        enable_commits = True

        # --------------------------------------------------
        # Handle Tags
        # --------------------------------------------------
        if tags:
            user_tags = [tag.strip() for tag in tags.split(",") if tag.strip()]
            upload_cur.execute("SELECT TagLabel FROM Tags")
            all_tag_list = upload_cur.fetchall()
            master_tags = set(tag[0] for tag in all_tag_list)
            new_tags = list(set(user_tags) - master_tags)
            existing_tags = list(set(user_tags) & master_tags)

            if new_tags:
                upload_cur.execute("SELECT MAX(TagID) FROM Tags")
                maxtagid = upload_cur.fetchone()
                start_id = (maxtagid[0] or 0) + 1
                new_tag_ids = [start_id + i for i in range(len(new_tags))]
                upload_cur.executemany("INSERT INTO Tags (TagID, TagLabel) VALUES (%s, %s)",
                                list(zip(new_tag_ids, new_tags)))
                upload_cur.executemany("INSERT INTO CardTags (CardID, TagID) VALUES (%s, %s)",
                                [(nextcardid, tag_id) for tag_id in new_tag_ids])

            if existing_tags:
                upload_cur.execute("SELECT TagID FROM Tags WHERE TagLabel IN %s", (tuple(existing_tags),))
                results = upload_cur.fetchall()
                upload_cur.executemany("INSERT INTO CardTags (CardID, TagID) VALUES (%s, %s)",
                                [(nextcardid, tag_id[0]) for tag_id in results])

            print("[DB] Tags processed successfully")

        # --------------------------------------------------
        # Handle file uploads (compress → upload → record)
        # --------------------------------------------------
        if files:
            print("[FILES] Beginning upload process...")
            for file_index, file in enumerate(files):
                try:
                    with tempfile.NamedTemporaryFile(delete=False) as tmp:
                        file.file.seek(0)
                        tmp.write(file.file.read())
                        tmp_path = tmp.name

                    zip_path = compress_file(tmp_path, original_name=file.filename)
                    zip_filename = os.path.basename(zip_path)
                    filesizeNEW = os.path.getsize(zip_path)

                    upload_cur.execute("SELECT MAX(FileID) FROM Files")
                    maxFileid = upload_cur.fetchone()
                    nextfileid = (maxFileid[0] or 0) + 1

                    safe_filename = os.path.splitext(os.path.basename(file.filename))[0]
                    destination_path = f"files/{username}/{uuid.uuid4().hex}/{safe_filename}.zip"

                    print(f"[UPLOAD] Uploading compressed file {zip_filename} → {destination_path}")
                    public_url = upload_to_bucket(destination_path, zip_path, "application/zip", azure_storage.AZURE_CONTAINER)
                    if not public_url:
                        raise Exception("Upload to Azure failed")


                    upload_cur.execute(
                        'INSERT INTO Files (fileid, CardID, filename, file_link, filesize, fileextension) '
                        'VALUES (%s, %s, %s, %s, %s, %s)',
                        (nextfileid, nextcardid, safe_filename, public_url, filesizeNEW, ".zip")
                    )

                    print(f"[DB] File record added: {safe_filename}")
                    description = resolve_attachment_token(description, attachment_tokens[file_index], nextfileid)
                    enable_commits = True

                except Exception as e:
                    upload_conn.rollback()
                    print(f"[FILE ERROR] {e}")
                    raise HTTPException(status_code=500, detail=f"File upload failed: {e}")
                finally:
                    for path in [tmp_path, zip_path]:
                        if os.path.exists(path):
                            os.remove(path)
            print("[FILES] Upload process complete.")
            upload_cur.execute('UPDATE cards SET description = %s WHERE cardid = %s', (description, nextcardid))

        # --------------------------------------------------
        # Final commit
        # --------------------------------------------------
        if enable_commits:
            upload_conn.commit()
            metadata_committed = True
            print("[COMMIT] All changes committed successfully")

        # --------------------------------------------------
        # Populate CardImages for newly created cards
        # --------------------------------------------------
        if not update and not defer_images and location_type == "image":
            try:
                from endpoint_files.images import save_image_asset as _save_img
                if images:
                    for idx, img_file in enumerate(images):
                        try:
                            asset = _save_img(img_file)
                            upload_cur.execute(
                                "INSERT INTO CardImages (CardID, ImageURL, DisplayOrder, AltText, OriginalURL, ImageWidth, ImageHeight) VALUES (%s, %s, %s, '', %s, %s, %s)",
                                (nextcardid, asset['url'], idx, asset['original_url'], asset['width'], asset['height'])
                            )
                        except Exception as img_err:
                            print(f"[IMAGE] Failed to upload image at index {idx}: {img_err}")
                upload_conn.commit()
                print(f"[IMAGES] Inserted gallery CardImages for new image-overlay card {nextcardid}")
            except Exception as img_err:
                print(f"[IMAGE] Failed to insert CardImages: {img_err}")
                try:
                    upload_conn.rollback()
                except Exception:
                    pass
        elif not update and not defer_images:
            try:
                from endpoint_files.images import save_image_asset as _save_img
                # Use the already-uploaded thumbnail as the first gallery image
                if thumbnail_asset:
                    upload_cur.execute(
                        "INSERT INTO CardImages (CardID, ImageURL, DisplayOrder, AltText, OriginalURL, ImageWidth, ImageHeight) VALUES (%s, %s, 0, '', %s, %s, %s)",
                        (nextcardid, thumbnail_url, thumbnail_asset['original_url'], thumbnail_asset['width'], thumbnail_asset['height'])
                    )
                else:
                    upload_cur.execute(
                        "INSERT INTO CardImages (CardID, ImageURL, DisplayOrder, AltText) VALUES (%s, %s, 0, '')",
                        (nextcardid, thumbnail_url)
                    )
                # Upload and insert any additional images (index 1+ since index 0 == thumbnail)
                if images and len(images) > 1:
                    for idx, img_file in enumerate(images[1:], start=1):
                        try:
                            asset = _save_img(img_file)
                            upload_cur.execute(
                                "INSERT INTO CardImages (CardID, ImageURL, DisplayOrder, AltText, OriginalURL, ImageWidth, ImageHeight) VALUES (%s, %s, %s, '', %s, %s, %s)",
                                (nextcardid, asset['url'], idx, asset['original_url'], asset['width'], asset['height'])
                            )
                        except Exception as img_err:
                            print(f"[IMAGE] Failed to upload image at index {idx}: {img_err}")
                upload_conn.commit()
                print(f"[IMAGES] Inserted CardImages for new card {nextcardid}")
            except Exception as img_err:
                print(f"[IMAGE] Failed to insert CardImages: {img_err}")
                try:
                    upload_conn.rollback()
                except Exception:
                    pass

        return {"message": "Card uploaded successfully", "card_id": nextcardid}

    except HTTPException:
        upload_conn.rollback()
        if thumbnail_asset and not metadata_committed:
            for url in (thumbnail_asset['url'], thumbnail_asset['original_url']):
                try:
                    azure_storage.delete_from_url(url)
                except Exception:
                    pass
        raise
    except Exception as e:
        upload_conn.rollback()
        if thumbnail_asset and not metadata_committed:
            for url in (thumbnail_asset['url'], thumbnail_asset['original_url']):
                try:
                    azure_storage.delete_from_url(url)
                except Exception:
                    pass
        print(f"[UPLOADFORM ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            if upload_cur is not None:
                upload_cur.close()
        finally:
            release_request_connection(upload_conn)
