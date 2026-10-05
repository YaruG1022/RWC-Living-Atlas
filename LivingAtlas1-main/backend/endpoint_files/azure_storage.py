"""
Azure Blob Storage helpers for card image, thumbnail, and file storage.

Requires AZURE_STORAGE_CONNECTION_STRING (set in backend/.env or Render env vars).
Blobs are stored in a single public container (default "images") with
relative paths (card_images/, thumbnails/, files/).
LOCAL_TEST_MODE=1 uses the isolated uploads/local_test directory instead.
"""
import os
import re
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse, quote, unquote

AZURE_CONTAINER = os.environ.get("AZURE_CONTAINER", "images")
BLOB_HOST_SUFFIX = ".blob.core.windows.net"
LOCAL_STORAGE_ROOT = Path(__file__).resolve().parents[1] / 'uploads' / 'local_test'
LOCAL_URL_PREFIX = '/uploads/local_test/'


def _local_blob_path(blob_name: str, container: str) -> Path:
    """Keep local uploads and deletes inside their dedicated storage directory."""
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', container):
        raise ValueError('Invalid storage container')
    name = PurePosixPath(blob_name)
    if not blob_name or '\\' in blob_name or ':' in blob_name or name.is_absolute() or '..' in name.parts:
        raise ValueError('Invalid local storage path')
    root = LOCAL_STORAGE_ROOT.resolve()
    target = (root / container / Path(*name.parts)).resolve()
    if not target.is_relative_to(root / container) or target == root / container:
        raise ValueError('Local storage path must identify a file inside its container')
    return target


def get_connection_string() -> str:
    conn = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")
    if not conn:
        raise RuntimeError("AZURE_STORAGE_CONNECTION_STRING is not set.")
    return conn


def get_account_name() -> str:
    """Account name from the connection string, falling back to AZURE_ACCOUNT / default."""
    conn = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")
    m = re.search(r"AccountName=([^;]+)", conn)
    if m:
        return m.group(1).strip()
    return os.environ.get("AZURE_ACCOUNT", "livingatlasimages")


def build_url(blob_name: str, container: str = AZURE_CONTAINER) -> str:
    """Construct the public URL for a blob (no SDK call / no credentials required)."""
    return f"https://{get_account_name()}.blob.core.windows.net/{container}/{blob_name}"


def is_azure_url(url: str) -> bool:
    return bool(url) and BLOB_HOST_SUFFIX in url


def _container_client(container: str = AZURE_CONTAINER):
    from azure.storage.blob import BlobServiceClient
    return BlobServiceClient.from_connection_string(get_connection_string()).get_container_client(container)


def upload_bytes(blob_name: str, data: bytes,
                 content_type: str = "application/octet-stream",
                 container: str = AZURE_CONTAINER) -> str:
    """Use isolated disk storage in local test mode; otherwise upload to Azure."""
    if os.environ.get('LOCAL_TEST_MODE') == '1':
        path = _local_blob_path(blob_name, container)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return f'{LOCAL_URL_PREFIX}{container}/{quote(blob_name, safe="/")}'
    from azure.storage.blob import ContentSettings
    _container_client(container).upload_blob(
        blob_name,
        data,
        overwrite=True,
        content_settings=ContentSettings(content_type=content_type),
    )
    return build_url(blob_name, container)


def delete_blob(blob_name: str, container: str = AZURE_CONTAINER) -> None:
    """Delete a blob by name from the given container."""
    if os.environ.get('LOCAL_TEST_MODE') == '1':
        _local_blob_path(blob_name, container).unlink(missing_ok=True)
        return
    _container_client(container).delete_blob(blob_name)


def delete_from_url(url: str) -> None:
    """Delete owned local files in test mode, or Azure blobs in hosted mode."""
    if os.environ.get('LOCAL_TEST_MODE') == '1':
        parsed = urlparse(url or '')
        if parsed.scheme or parsed.netloc or not parsed.path.startswith(LOCAL_URL_PREFIX):
            return
        parts = unquote(parsed.path[len(LOCAL_URL_PREFIX):]).split('/', 1)
        if len(parts) == 2:
            delete_blob(parts[1], parts[0])
        return
    if not is_azure_url(url):
        return
    parts = urlparse(url).path.lstrip("/").split("/", 1)
    if len(parts) != 2:
        return
    container, blob_name = parts
    _container_client(container).delete_blob(blob_name)
