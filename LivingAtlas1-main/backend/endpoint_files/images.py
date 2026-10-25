"""
Endpoint for multi-image support
Provides APIs to manage images in the CardImages table
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Body
from fastapi.responses import Response
from database import conn, cur
from typing import Optional
import os
import uuid
import datetime
import json
import re
import requests as _requests
from pathlib import Path
from . import azure_storage
from .image_processing import prepare_image, MAX_IMAGE_BYTES
from .image_presentation import parse_presentation

images_router = APIRouter()

# Configure image storage directory (used as local fallback only)
IMAGE_UPLOAD_DIR = "uploads/card_images"
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'}
MAX_FILE_SIZE = MAX_IMAGE_BYTES
IMAGE_FOLDER = "card_images"
MAX_CARD_IMAGES = 30


def reserve_image_slots(card_id: int, incoming_count: int):
    """Lock the card until commit so concurrent uploads cannot exceed its limit."""
    cur.execute("SELECT CardID FROM Cards WHERE CardID = %s FOR UPDATE", (card_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Card not found")
    cur.execute("SELECT COUNT(*) FROM CardImages WHERE CardID = %s", (card_id,))
    if cur.fetchone()[0] + incoming_count > MAX_CARD_IMAGES:
        raise HTTPException(status_code=422, detail=f"A card can have at most {MAX_CARD_IMAGES} images. Save pending deletions before adding more.")


def ensure_upload_dir():
    """Ensure local upload directory exists"""
    Path(IMAGE_UPLOAD_DIR).mkdir(parents=True, exist_ok=True)


def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def save_image_asset(file: UploadFile):
    if not allowed_file(file.filename):
        raise HTTPException(415, detail="Use a PNG, JPG, WebP, GIF or BMP image.")
    original, display, width, height = prepare_image(file)
    key = uuid.uuid4().hex
    source_name = f"{IMAGE_FOLDER}/originals/{key}.{file.filename.rsplit('.', 1)[1].lower()}"
    display_name = f"{IMAGE_FOLDER}/{key}.webp"
    uploaded = []
    try:
        original_url = azure_storage.upload_bytes(source_name, original, file.content_type or 'application/octet-stream')
        uploaded.append(original_url)
        url = azure_storage.upload_bytes(display_name, display, 'image/webp')
        uploaded.append(url)
        return {'url': url, 'original_url': original_url, 'width': width, 'height': height}
    except Exception:
        for url in uploaded:
            try:
                azure_storage.delete_from_url(url)
            except Exception:
                pass
        raise


def save_uploaded_file(file: UploadFile) -> str:
    return save_image_asset(file)['url']


@images_router.post('/imagePreview')
def image_preview(image: UploadFile = File(...)):
    # Fallback for browsers unable to decode very large originals. No blobs or
    # database records are created for an unsubmitted project preview.
    _, display, _, _ = prepare_image(image)
    return Response(display, media_type='image/webp')


def _should_sync_thumbnail_with_gallery(card_id: int) -> bool:
    cur.execute("SELECT COALESCE(LocationType, 'point') FROM Cards WHERE CardID = %s", (card_id,))
    row = cur.fetchone()
    return not row or row[0] != 'image'


def sync_gallery_thumbnail(card_id: int):
    if _should_sync_thumbnail_with_gallery(card_id):
        cur.execute("""
            UPDATE Cards c SET Thumbnail_Link = COALESCE((
                SELECT ImageURL FROM CardImages WHERE CardID = %s
                ORDER BY COALESCE(array_position(ARRAY(
                    SELECT jsonb_array_elements_text(COALESCE(c.GalleryImageIDs, '[]'::jsonb))
                ), ImageID::text), 2147483647), DisplayOrder, ImageID LIMIT 1
            ), '') WHERE CardID = %s
        """, (card_id, card_id))

@images_router.post("/uploadCardImage")
async def upload_card_image(
    cardID: int = Form(...),
    altText: str = Form(default=""),
    image: UploadFile = File(...),
    presentation: str = Form('{}'),
    upload_token: Optional[str] = Form(None)
):
    """
    Upload a new image for a card
    
    Args:
        cardID: Card ID
        altText: Alternative text for the image
        image: Image file
    
    Returns:
        Created image record with ImageID and ImageURL
    """
    asset = None
    framing = parse_presentation(presentation)
    if upload_token and not re.fullmatch(r'[A-Za-z0-9-]{1,64}', upload_token):
        raise HTTPException(422, 'Invalid image upload token.')
    try:
        if upload_token:
            cur.execute("SELECT CardID FROM Cards WHERE CardID=%s FOR UPDATE", (cardID,))
            if not cur.fetchone():
                raise HTTPException(404, 'Project not found.')
            cur.execute("SELECT ImageID, ImageURL, OriginalURL, ImageWidth, ImageHeight, Presentation FROM CardImages WHERE CardID=%s AND UploadToken=%s", (cardID, upload_token))
            existing = cur.fetchone()
            if existing:
                conn.rollback()
                return {'success': True, 'imageID': existing[0], 'imageURL': existing[1], 'original_url': existing[2], 'width': existing[3], 'height': existing[4], 'presentation': existing[5]}
        reserve_image_slots(cardID, 1)
        asset = save_image_asset(image)
        image_url = asset['url']
        
        # Get next display order
        cur.execute(
            "SELECT COALESCE(MAX(DisplayOrder), -1) FROM CardImages WHERE CardID = %s",
            (cardID,)
        )
        next_order = cur.fetchone()[0] + 1
        
        # Insert into CardImages
        cur.execute("""
            INSERT INTO CardImages (CardID, ImageURL, DisplayOrder, AltText, OriginalURL, ImageWidth, ImageHeight, Presentation, UploadToken)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)
            RETURNING ImageID
        """, (cardID, image_url, next_order, altText, asset['original_url'], asset['width'], asset['height'], json.dumps(framing), upload_token))
        
        image_id = cur.fetchone()[0]

        sync_gallery_thumbnail(cardID)
        conn.commit()
        
        return {
            "success": True,
            "imageID": image_id,
            "imageURL": image_url,
            **asset,
            "presentation": framing,
            "displayOrder": next_order,
            "altText": altText
        }
    
    except Exception as error:
        conn.rollback()
        if asset:
            for url in (asset['url'], asset['original_url']):
                try:
                    azure_storage.delete_from_url(url)
                except Exception:
                    pass
        if isinstance(error, HTTPException):
            raise
        raise HTTPException(503, 'Image could not be saved. Please retry this image.')

@images_router.post("/uploadCardImages")
async def upload_card_images(
    cardID: int = Form(...),
    altTexts: Optional[str] = Form(None),
    images: list[UploadFile] = File(...)
):
    """
    Upload multiple images for a card in one request.

    Args:
        cardID: Card ID
        altTexts: Optional delimiter-separated alt text values ("||" delimiter)
        images: List of image files

    Returns:
        Created image records with ImageID and ImageURL
    """
    saved_assets = []
    try:
        if not images:
            raise HTTPException(status_code=400, detail="No images provided")

        reserve_image_slots(cardID, len(images))

        alt_text_values = []
        if altTexts:
            alt_text_values = [text.strip() for text in altTexts.split("||")]

        cur.execute(
            "SELECT COALESCE(MAX(DisplayOrder), -1) FROM CardImages WHERE CardID = %s",
            (cardID,)
        )
        next_order = cur.fetchone()[0] + 1

        created_images = []
        for index, image in enumerate(images):
            asset = save_image_asset(image)
            saved_assets.append(asset)
            image_url = asset['url']
            alt_text = alt_text_values[index] if index < len(alt_text_values) else ""

            cur.execute(
                """
                INSERT INTO CardImages (CardID, ImageURL, DisplayOrder, AltText, OriginalURL, ImageWidth, ImageHeight)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING ImageID
                """,
                (cardID, image_url, next_order + index, alt_text, asset['original_url'], asset['width'], asset['height'])
            )
            image_id = cur.fetchone()[0]

            created_images.append({
                "imageID": image_id,
                "imageURL": image_url,
                "displayOrder": next_order + index,
                "altText": alt_text
            })

        sync_gallery_thumbnail(cardID)
        conn.commit()

        return {
            "success": True,
            "cardID": cardID,
            "images": created_images
        }

    except Exception as error:
        conn.rollback()
        for asset in saved_assets:
            for url in (asset['url'], asset['original_url']):
                try:
                    azure_storage.delete_from_url(url)
                except Exception:
                    pass
        if isinstance(error, HTTPException):
            raise
        raise HTTPException(503, 'Images could not be saved. Please retry.')


@images_router.delete("/deleteCardImage/{imageID}")
async def delete_card_image(imageID: int):
    """
    Delete an image by ID
    
    Args:
        imageID: Image ID to delete
    
    Returns:
        Success confirmation
    """
    try:
        # Get image details
        cur.execute("SELECT ImageURL, CardID, OriginalURL FROM CardImages WHERE ImageID = %s", (imageID,))
        result = cur.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Image not found")
        
        image_url, card_id = result[:2]
        original_url = result[2] if len(result) > 2 else None
        # Delete from database
        cur.execute("DELETE FROM CardImages WHERE ImageID = %s", (imageID,))
        
        # Delete the backing file from Azure Blob Storage (non-fatal on failure)
        try:
            # Default covers are shared assets; deleting their record is enough.
            if image_url not in {'/CEREO-logo.png', 'CEREO-logo.png'} and not image_url.endswith('/thumbnails/default_cereo_thumbnail.png'):
                azure_storage.delete_from_url(image_url)
            if original_url and original_url != image_url:
                azure_storage.delete_from_url(original_url)
        except Exception as az_err:
            print(f"[images] Azure delete failed (non-fatal): {az_err}")

        # Reorder remaining images
        cur.execute("""
            SELECT ImageID FROM CardImages 
            WHERE CardID = %s 
            ORDER BY DisplayOrder, ImageID
        """, (card_id,))        
        remaining_images = cur.fetchall()
        for idx, (img_id,) in enumerate(remaining_images):
            cur.execute(
                "UPDATE CardImages SET DisplayOrder = %s WHERE ImageID = %s",
                (idx, img_id)
            )

        sync_gallery_thumbnail(card_id)
        
        conn.commit()
        
        return {
            "success": True,
            "deleteImageID": imageID,
            "cardID": card_id
        }
    
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")

@images_router.put("/reorderCardImages")
async def reorder_card_images(cardID: int, imageOrder: list = Body(...)):
    """
    Reorder images for a card
    
    Args:
        cardID: Card ID (query parameter)
        imageOrder: List of ImageIDs in desired order (request body)
    
    Returns:
        Updated order confirmation
    """
    try:
        # Verify all images belong to this card
        placeholders = ','.join(['%s'] * len(imageOrder))
        cur.execute(f"""
            SELECT COUNT(*) FROM CardImages 
            WHERE CardID = %s AND ImageID = ANY(ARRAY[{placeholders}])
        """, [cardID] + imageOrder)
        
        if cur.fetchone()[0] != len(imageOrder):
            raise HTTPException(status_code=400, detail="Invalid image IDs for this card")
        
        # Update display order
        for display_idx, image_id in enumerate(imageOrder):
            cur.execute(
                "UPDATE CardImages SET DisplayOrder = %s WHERE ImageID = %s",
                (display_idx, image_id)
            )
        
        sync_gallery_thumbnail(cardID)
        conn.commit()
        
        return {
            "success": True,
            "cardID": cardID,
            "newOrder": imageOrder
        }
    
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Reorder failed: {str(e)}")

@images_router.get("/cardImages/{cardID}")
async def get_card_images(cardID: int):
    """
    Get all images for a card
    
    Args:
        cardID: Card ID
    
    Returns:
        List of images sorted by DisplayOrder
    """
    try:
        cur.execute("SELECT COALESCE(GalleryLayout, 'featured'), GalleryImageIDs FROM Cards WHERE CardID = %s", (cardID,))
        card = cur.fetchone()
        if not card:
            raise HTTPException(status_code=404, detail="Card not found")
        cur.execute("""
            SELECT ImageID, ImageURL, DisplayOrder, AltText, DateAdded, OriginalURL, ImageWidth, ImageHeight, Presentation
            FROM CardImages
            WHERE CardID = %s
            ORDER BY DisplayOrder ASC
        """, (cardID,))
        
        rows = cur.fetchall()
        images = [
            {
                "imageID": row[0],
                "url": row[1],
                "displayOrder": row[2],
                "alt": row[3],
                "dateAdded": str(row[4]) if row[4] else None,
                "original_url": row[5] if len(row) > 5 and row[5] else row[1],
                "width": row[6] if len(row) > 6 else None,
                "height": row[7] if len(row) > 7 else None,
                "presentation": row[8] if len(row) > 8 else None
            }
            for row in rows
        ]
        
        return {
            "cardID": cardID,
            "totalImages": len(images),
            "galleryLayout": card[0],
            "galleryImageIDs": card[1],
            "images": images
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


_MIME_MAP = {
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
    'gif': 'image/gif', 'webp': 'image/webp', 'bmp': 'image/bmp',
}


@images_router.get("/cardImageProxy/{image_id}")
async def proxy_card_image(image_id: int):
    """Fetch a card image by ID and return its bytes, bypassing client CORS restrictions."""
    cur.execute("SELECT ImageURL FROM CardImages WHERE ImageID = %s", (image_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Image not found")

    image_url = row[0]

    if image_url.startswith("http://") or image_url.startswith("https://"):
        try:
            resp = _requests.get(image_url, timeout=15)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0]
            return Response(content=resp.content, media_type=content_type)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to fetch image: {e}")
    else:
        filepath = image_url.lstrip("/")
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Image file not found")
        ext = filepath.rsplit(".", 1)[-1].lower()
        content_type = _MIME_MAP.get(ext, "image/jpeg")
        with open(filepath, "rb") as f:
            return Response(content=f.read(), media_type=content_type)


@images_router.get("/imageUrlProxy")
async def proxy_image_by_url(url: str):
    """Fetch an image from an arbitrary URL and return its bytes, bypassing client CORS restrictions."""
    if not url or not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=400, detail="Invalid or missing url parameter")
    try:
        resp = _requests.get(url, timeout=15)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0]
        return Response(content=resp.content, media_type=content_type)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch image: {e}")
