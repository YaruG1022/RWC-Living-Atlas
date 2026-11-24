"""Create an editable description draft without saving a card or its materials."""

import json
import os
from dataclasses import dataclass, field
from time import monotonic
from urllib.parse import urlparse

import requests
from fastapi import APIRouter, Depends, HTTPException, Request
from multipart.exceptions import MultipartParseError
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException, MultiPartParser

from card_description_links import read_link
from database import get_request_connection, release_request_connection
from sessions import bearer_token, require_account

from .card_description_sources import (
    IMAGE_EXTENSIONS, MAX_TEXT_CHARS, attachment_contents, image_data_url,
    read_document, read_limited, read_owned_blob, suffix,
)


router = APIRouter(tags=['cards'])
MAX_REQUEST_BYTES = 32 * 1024 * 1024
MAX_PENDING_IMAGES = 8
MAX_PENDING_FILES = 12
MAX_LINKS = 12
MAX_SOURCES = 24
MAX_TOTAL_TEXT_CHARS = 60_000
MAX_TOTAL_IMAGE_BYTES = 8 * 1024 * 1024
REQUEST_TOO_LARGE = 'Generation accepts at most 32 MiB of pending uploads per request.'
HELPER_UNAVAILABLE = 'AI description generation is temporarily unavailable. Try again later.'
DEFAULT_THUMBNAIL = '/thumbnails/default_cereo_thumbnail.png'


class UploadLimitExceeded(MultiPartException):
    pass


async def _bounded_body(request):
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_REQUEST_BYTES:
            raise UploadLimitExceeded(REQUEST_TOO_LARGE)
        yield chunk


def _field(form, name, default='', maximum=255):
    value = form.get(name, default)
    if not isinstance(value, str) or len(value) > maximum:
        raise HTTPException(422, f'Invalid {name} for description generation.')
    return value


def _json_list(form, name, maximum):
    try:
        entries = json.loads(_field(form, name, default='[]', maximum=64_000))
    except (ValueError, RecursionError) as error:
        raise HTTPException(422, f'Invalid {name} for description generation.') from error
    if not isinstance(entries, list) or len(entries) > maximum:
        raise HTTPException(422, f'Invalid {name} for description generation.')
    return entries


def _is_card_id(value):
    return type(value) is int and 0 < value <= 2_147_483_647


def _ids(form, name, maximum):
    values = _json_list(form, name, maximum)
    if any(not _is_card_id(value) for value in values):
        raise HTTPException(422, f'Invalid {name} for description generation.')
    return list(dict.fromkeys(values))


def _uploads(form, name, maximum):
    files = form.getlist(name)
    if len(files) > maximum or any(not isinstance(upload, UploadFile) for upload in files):
        raise HTTPException(422, f'Select at most {maximum} pending {name} for description generation.')
    return files


@router.post('/cards/generate-description')
async def generate_card_description(request: Request, session_token: str = Depends(bearer_token)):
    if request.headers.get('content-type', '').split(';', 1)[0].strip().lower() != 'multipart/form-data':
        raise HTTPException(415, 'Send description sources as multipart form data.')
    length = request.headers.get('content-length', '').lstrip('0')
    if length.isascii() and length.isdecimal() and (len(length) > 8 or int(length) > MAX_REQUEST_BYTES):
        raise HTTPException(413, REQUEST_TOO_LARGE)
    try:
        parser = MultiPartParser(request.headers, _bounded_body(request), max_files=20, max_fields=6)
        form = await parser.parse()
    except UploadLimitExceeded as error:
        raise HTTPException(413, REQUEST_TOO_LARGE) from error
    except (MultiPartException, MultipartParseError) as error:
        raise HTTPException(400, 'The description sources could not be read from the request.') from error
    try:
        return await run_in_threadpool(_generate_from_form, form, session_token)
    finally:
        await form.close()


def _saved_materials(session_token, card_id, image_ids, file_ids, include_thumbnail):
    connection = get_request_connection()
    if connection is None:
        raise HTTPException(503, 'The project database is temporarily unavailable.')
    try:
        with connection.cursor() as cursor:
            user_id, _, is_admin = require_account(cursor, session_token)
            if card_id is None:
                return '', {}, {}
            cursor.execute('SELECT UserID, Thumbnail_Link FROM Cards WHERE CardID = %s', (card_id,))
            card = cursor.fetchone()
            if card is None:
                raise HTTPException(404, 'Project not found.')
            owner_id, thumbnail = card
            if user_id != owner_id and not is_admin:
                raise HTTPException(403, 'You do not have permission to edit this project.')
            images = {}
            files = {}
            if image_ids:
                cursor.execute('SELECT ImageID, ImageURL, AltText FROM CardImages WHERE CardID = %s AND ImageID = ANY(%s)', (card_id, image_ids))
                images = {image_id: (url, alt) for image_id, url, alt in cursor.fetchall()}
            if file_ids:
                cursor.execute('SELECT FileID, FileName, File_Link, FileExtension FROM Files WHERE CardID = %s AND FileID = ANY(%s)', (card_id, file_ids))
                files = {file_id: (filename, url, extension) for file_id, filename, url, extension in cursor.fetchall()}
            return (thumbnail if include_thumbnail else ''), images, files
    finally:
        release_request_connection(connection)


def _label(value, fallback):
    return ' '.join((value or '').split())[:256] or fallback


@dataclass
class Evidence:
    sources: list = field(default_factory=list)
    images: list = field(default_factory=list)
    warnings: list = field(default_factory=list)
    text_remaining: int = MAX_TOTAL_TEXT_CHARS
    image_remaining: int = MAX_TOTAL_IMAGE_BYTES

    def add_text(self, label, content):
        text = content.strip()[:min(MAX_TEXT_CHARS, self.text_remaining)].strip()
        if len(self.sources) >= MAX_SOURCES or not self.text_remaining:
            raise ValueError('the draft has reached its text source limit')
        if not text:
            raise ValueError('the source contains no readable text')
        self.sources.append({'label': label, 'text': text})
        self.text_remaining -= len(text)

    def add_image(self, label, data):
        if len(self.images) >= MAX_PENDING_IMAGES:
            raise ValueError('the draft can use up to eight images')
        data_url, size = image_data_url(data)
        if size > self.image_remaining:
            raise ValueError('the draft has reached its combined image size limit')
        self.images.append({'label': label, 'data_url': data_url})
        self.image_remaining -= size

    def add_attachment(self, data, name, saved=False):
        for member_name, content in attachment_contents(data, name, saved=saved):
            label = _label(member_name, 'Attachment')
            try:
                if suffix(member_name) in IMAGE_EXTENSIONS:
                    self.add_image(label, content)
                else:
                    self.add_text(label, read_document(content, member_name))
            except ValueError as error:
                self.skip(label, error)

    def skip(self, label, error):
        reason = str(error).strip().rstrip('.')
        self.warnings.append(f'{label} was skipped. {reason[:1].upper()}{reason[1:]}.')


def _generate_from_form(form, session_token):
    title = _field(form, 'title').strip()
    links = _json_list(form, 'links', 250)
    image_ids = _ids(form, 'image_ids', 30)
    file_ids = _ids(form, 'file_ids', 24)
    new_images = _uploads(form, 'images', MAX_PENDING_IMAGES)
    new_files = _uploads(form, 'files', MAX_PENDING_FILES)
    thumbnail_field = _field(form, 'include_thumbnail', 'false', maximum=5)
    card_field = _field(form, 'card_id', maximum=10)
    card_id = int(card_field) if card_field.isascii() and card_field.isdecimal() else None
    include_thumbnail = thumbnail_field == 'true'
    if (card_field and not _is_card_id(card_id) or thumbnail_field not in {'true', 'false'}
            or card_id is None and (image_ids or file_ids or include_thumbnail)):
        raise HTTPException(422, 'Select the edited project for saved description sources.')
    if any(not isinstance(link, dict) or not isinstance(link.get('url'), str)
           or not isinstance(link.get('text', ''), str) for link in links):
        raise HTTPException(422, 'Invalid project links for description generation.')

    thumbnail, saved_images, saved_files = _saved_materials(session_token, card_id, image_ids, file_ids, include_thumbnail)
    helper_url, helper_token = _helper_settings()
    evidence = Evidence()
    collection_deadline = monotonic() + 30

    for upload in new_images:
        label = _label(upload.filename, 'Image')
        try:
            evidence.add_image(label, read_limited(upload.file))
        except ValueError as error:
            evidence.skip(label, error)

    handled_images = set()
    if thumbnail and DEFAULT_THUMBNAIL not in thumbnail:
        try:
            evidence.add_image('Project thumbnail', read_owned_blob(thumbnail, ('thumbnails', 'card_images')))
            handled_images.add(thumbnail)
        except ValueError as error:
            evidence.skip('Project thumbnail', error)

    for image_id in image_ids:
        url, alt = saved_images.get(image_id, (None, None))
        label = _label(alt, f'Saved image {image_id}')
        if url in handled_images:
            continue
        try:
            if not url:
                raise ValueError('it is unavailable on this project')
            if len(evidence.images) >= MAX_PENDING_IMAGES:
                raise ValueError('the draft can use up to eight images')
            if monotonic() >= collection_deadline:
                raise ValueError('the source collection time limit was reached')
            evidence.add_image(label, read_owned_blob(url, ('card_images',)))
            handled_images.add(url)
        except ValueError as error:
            evidence.skip(label, error)

    for index, link in enumerate(links[:MAX_LINKS], start=1):
        label = _label(link.get('text'), f'Link {index}')
        try:
            if monotonic() >= collection_deadline:
                raise ValueError('the source collection time limit was reached')
            url = link['url'].strip()
            if len(url) > 2_048:
                raise ValueError('the link address is too long')
            evidence.add_text(label, read_link(url))
        except ValueError as error:
            evidence.skip(label, error)
    if len(links) > MAX_LINKS:
        evidence.warnings.append('Generation used at most the first 12 links.')

    for upload in new_files:
        filename = upload.filename or 'Attachment'
        try:
            evidence.add_attachment(read_limited(upload.file), filename)
        except ValueError as error:
            evidence.skip(_label(filename, 'Attachment'), error)

    for file_id in file_ids:
        filename, url, extension = saved_files.get(file_id, (None, None, None))
        label = _label(filename, f'Saved file {file_id}')
        name = filename or label
        if extension and not name.lower().endswith(extension.lower()):
            name += extension
        try:
            if not url:
                raise ValueError('it is unavailable on this project')
            if monotonic() >= collection_deadline:
                raise ValueError('the source collection time limit was reached')
            evidence.add_attachment(read_owned_blob(url, ('files',)), name, saved=True)
        except ValueError as error:
            evidence.skip(label, error)

    if not evidence.sources and not evidence.images:
        detail = 'Add a readable project link, image, or supported attachment to generate a description.'
        if evidence.warnings:
            detail = ' '.join([detail, *evidence.warnings[:3]])
        raise HTTPException(422, detail)
    return {'description': _ask_helper(title, evidence, helper_url, helper_token), 'warnings': evidence.warnings}


def _helper_settings():
    base = os.environ.get('ATLAS_HELPER_URL', '').strip().rstrip('/')
    token = os.environ.get('ATLAS_DESCRIPTION_TOKEN', '').strip()
    try:
        parsed = urlparse(base)
        port = parsed.port
        transport_allowed = parsed.scheme == 'https' or (
            parsed.scheme == 'http' and parsed.hostname in {'127.0.0.1', 'localhost', '::1'}
        )
        if (not transport_allowed or not base.isprintable() or not parsed.hostname or port == 0
                or parsed.username is not None or parsed.password is not None
                or parsed.path or parsed.query or parsed.fragment or len(token) < 32
                or not token.isascii() or not token.isprintable()):
            raise ValueError()
    except ValueError as error:
        raise HTTPException(503, 'AI description generation is not configured. Ask a project administrator.') from error
    return base + '/internal/cards/description', token


def _ask_helper(title, evidence, helper_url, helper_token):
    try:
        response = requests.post(
            helper_url, headers={'X-Atlas-Description-Token': helper_token},
            json={'title': title, 'sources': evidence.sources, 'images': evidence.images},
            timeout=(5, 35), allow_redirects=False,
        )
    except requests.Timeout as error:
        raise HTTPException(504, 'AI description generation timed out. Try again.') from error
    except requests.RequestException as error:
        raise HTTPException(502, HELPER_UNAVAILABLE) from error
    try:
        result = response.json()
    except ValueError:
        result = None
    if response.status_code == 503:
        if isinstance(result, dict) and result.get('detail') == 'Card description generation from images is not configured.':
            raise HTTPException(503, 'Image description generation is unavailable. Ask an administrator to configure the vision model.')
        if isinstance(result, dict) and result.get('detail') == 'Card description generation from text is not configured.':
            raise HTTPException(503, 'Text description generation is unavailable. Ask an administrator to configure the text model.')
        raise HTTPException(503, HELPER_UNAVAILABLE)
    description = result.get('description') if isinstance(result, dict) and response.status_code == 200 else None
    if not isinstance(description, str) or not description.strip() or len(description.encode('utf-16-le', errors='surrogatepass')) > 4_000:
        raise HTTPException(502, HELPER_UNAVAILABLE)
    return description.strip()
