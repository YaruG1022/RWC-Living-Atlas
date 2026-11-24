"""Read bounded, supported card materials for description drafting."""

import base64
import io
import os
import xml.etree.ElementTree as ET
from pathlib import PurePosixPath
from urllib.parse import unquote, urlparse
from zipfile import BadZipFile, ZipFile, is_zipfile

from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError
from starlette.datastructures import UploadFile

from . import azure_storage
from .image_processing import prepare_image

MAX_SOURCE_BYTES = 8 * 1024 * 1024
MAX_TEXT_CHARS = 12_000
MAX_IMAGE_BYTES = 2 * 1024 * 1024
MAX_ARCHIVE_ENTRIES = 256
IMAGE_EXTENSIONS = {'.bmp', '.gif', '.jpeg', '.jpg', '.png', '.webp'}
TEXT_EXTENSIONS = {'.csv', '.geojson', '.json', '.md', '.tsv', '.txt', '.xml'}
DOCUMENT_EXTENSIONS = TEXT_EXTENSIONS | {'.docx', '.pdf'}


def suffix(filename):
    return PurePosixPath(filename).suffix.lower()


def read_owned_blob(url, directories):
    """Read a storage URL obtained from an authorized card record."""
    address = urlparse(url or '')
    local = os.getenv('LOCAL_TEST_MODE') == '1'
    if local and not address.scheme and not address.netloc and address.path.startswith(azure_storage.LOCAL_URL_PREFIX):
        relative = address.path[len(azure_storage.LOCAL_URL_PREFIX):]
    elif address.scheme == 'https' and address.netloc == f'{azure_storage.get_account_name()}.blob.core.windows.net':
        relative = address.path.lstrip('/')
    else:
        raise ValueError('the saved material is outside project storage')

    container, _, blob = unquote(relative).partition('/')
    if container != azure_storage.AZURE_CONTAINER or not blob.startswith(tuple(directory + '/' for directory in directories)):
        raise ValueError('the saved material is outside project storage')
    try:
        path = azure_storage._local_blob_path(blob, container)
        if local:
            with path.open('rb') as source:
                return read_limited(source)
        client = azure_storage._container_client(container).get_blob_client(blob)
        result = client.download_blob(
            offset=0, length=MAX_SOURCE_BYTES + 1, max_concurrency=1,
            connection_timeout=4, read_timeout=5, retry_total=0, timeout=5,
        ).readall()
    except ValueError:
        raise
    except Exception as error:
        raise ValueError('the saved material could not be read') from error
    if len(result) > MAX_SOURCE_BYTES:
        raise ValueError('the material exceeds 8 MiB')
    return result


def read_limited(source):
    data = source.read(MAX_SOURCE_BYTES + 1)
    if len(data) > MAX_SOURCE_BYTES:
        raise ValueError('the material exceeds 8 MiB')
    return data


def attachment_contents(data, filename, saved=False):
    """Yield recognized materials from direct files and stored ZIP wrappers."""
    if not ((saved or suffix(filename) == '.zip') and is_zipfile(io.BytesIO(data))):
        yield filename, data
        return
    try:
        with ZipFile(io.BytesIO(data)) as archive:
            entries = [entry for entry in archive.infolist() if not entry.is_dir()]
            if len(entries) > MAX_ARCHIVE_ENTRIES:
                raise ValueError('the archive contains too many entries')
            if saved and len(entries) == 1 and suffix(entries[0].filename) == '.zip':
                if entries[0].file_size > MAX_SOURCE_BYTES:
                    raise ValueError('the archive exceeds 8 MiB')
                with archive.open(entries[0]) as member:
                    yield from attachment_contents(read_limited(member), entries[0].filename)
                return
            remaining = MAX_SOURCE_BYTES
            used = 0
            for entry in entries:
                if suffix(entry.filename) not in DOCUMENT_EXTENSIONS | IMAGE_EXTENSIONS:
                    continue
                if entry.file_size > remaining:
                    continue
                with archive.open(entry) as member:
                    content = read_limited(member)
                remaining -= len(content)
                used += 1
                yield PurePosixPath(entry.filename.replace('\\', '/')).name, content
                if used == 4:
                    return
            if not used:
                raise ValueError('the archive contains no supported material within the size limit')
    except (BadZipFile, NotImplementedError, OSError, RuntimeError) as error:
        raise ValueError('the archive could not be read') from error


def read_document(data, filename):
    extension = suffix(filename)
    if len(data) > MAX_SOURCE_BYTES:
        raise ValueError('the material exceeds 8 MiB')
    if extension == '.pdf':
        content = _read_pdf(data)
    elif extension == '.docx':
        content = _read_docx(data)
    elif extension in TEXT_EXTENSIONS:
        try:
            encoding = 'utf-16' if data.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig'
            content = data.decode(encoding)
        except UnicodeError as error:
            raise ValueError('the text encoding is unsupported') from error
    else:
        raise ValueError('the file type is unsupported')
    content = content.strip()[:MAX_TEXT_CHARS].strip()
    if not content or '\0' in content:
        raise ValueError('the file contains no readable text')
    return content


def _read_docx(data):
    namespace = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    try:
        with ZipFile(io.BytesIO(data)) as archive:
            document = archive.getinfo('word/document.xml')
            if document.file_size > 2 * 1024 * 1024:
                raise ValueError('the Word document text exceeds 2 MiB')
            xml = archive.read(document).decode('utf-8-sig')
        if '<!DOCTYPE' in xml:
            raise ValueError('the Word document contains unsupported XML')
        root = ET.fromstring(xml)
        return '\n'.join(
            ''.join(node.text or '' for node in paragraph.iter(namespace + 't'))
            for paragraph in root.iter(namespace + 'p')
        )
    except (BadZipFile, ET.ParseError, KeyError, NotImplementedError, UnicodeError, RuntimeError) as error:
        raise ValueError('the Word document could not be read') from error


def _read_pdf(data):
    from pypdf import PdfReader, apply_configuration

    try:
        with apply_configuration(
            maximum_declared_stream_length=MAX_SOURCE_BYTES,
            zlib_maximum_output_length=8 * MAX_SOURCE_BYTES,
            stream_decoding_work_maximum_length=8 * MAX_SOURCE_BYTES,
            stream_parsing_work_maximum_count=250_000,
            page_tree_maximum_entries=2_000,
        ):
            with PdfReader(io.BytesIO(data), root_object_recovery_limit=1_000, xref_stream_maximum_entries=50_000) as reader:
                if reader.is_encrypted:
                    return ''
                pages = []
                remaining = MAX_TEXT_CHARS
                for page in reader.pages[:12]:
                    text = page.extract_text().strip()[:remaining]
                    pages.append(text)
                    remaining -= len(text)
                    if not remaining:
                        break
                return '\n'.join(pages)
    except Exception as error:
        raise ValueError('the PDF could not be read') from error


def image_data_url(data):
    """Create a small JPEG representation without original file metadata."""
    if len(data) > MAX_SOURCE_BYTES:
        raise ValueError('the material exceeds 8 MiB')
    try:
        _, derivative, _, _ = prepare_image(UploadFile(io.BytesIO(data)))
        with Image.open(io.BytesIO(derivative), formats=['WEBP']) as display:
            display.thumbnail((1600, 1600))
            image = display.convert('RGBA')
            flattened = Image.new('RGB', image.size, 'white')
            flattened.paste(image, mask=image.getchannel('A'))
            output = io.BytesIO()
            flattened.save(output, format='JPEG', quality=80)
            encoded = output.getvalue()
    except HTTPException as error:
        raise ValueError(error.detail) from error
    except (UnidentifiedImageError, OSError) as error:
        raise ValueError('the image could not be read') from error
    if len(encoded) > MAX_IMAGE_BYTES:
        raise ValueError('the resized image exceeds 2 MiB')
    return 'data:image/jpeg;base64,' + base64.b64encode(encoded).decode('ascii'), len(encoded)
