"""Serve stored attachments with download headers, including legacy local links."""
import os
from urllib.parse import urlparse, unquote, quote

from fastapi import HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from . import azure_storage


def attachment_response(filename, url, extension='.zip'):
    name = (filename or 'attachment').replace('\\', '/').rsplit('/', 1)[-1]
    if extension and not name.lower().endswith(extension.lower()):
        name += extension
    parsed = urlparse(url or '')
    local = os.getenv('LOCAL_TEST_MODE') == '1'
    if local and not parsed.netloc and parsed.path.startswith(azure_storage.LOCAL_URL_PREFIX):
        parts = unquote(parsed.path[len(azure_storage.LOCAL_URL_PREFIX):]).split('/', 1)
    elif parsed.scheme == 'https' and parsed.hostname == f'{azure_storage.get_account_name()}.blob.core.windows.net':
        parts = unquote(parsed.path.lstrip('/')).split('/', 1)
    else:
        raise HTTPException(status_code=404, detail='Attachment storage location is unavailable')
    if len(parts) != 2 or parts[0] != azure_storage.AZURE_CONTAINER:
        raise HTTPException(status_code=404, detail='Attachment storage location is unavailable')
    try:
        path = azure_storage._local_blob_path(parts[1], parts[0])
    except ValueError:
        raise HTTPException(status_code=404, detail='Invalid attachment location')
    if local:
        if not path.is_file():
            raise HTTPException(status_code=404, detail='Attachment file is missing from local storage')
        return FileResponse(path, filename=name, media_type='application/octet-stream')
    try:
        blob = azure_storage._container_client(parts[0]).get_blob_client(parts[1])
        download = blob.download_blob()
    except Exception as error:
        from azure.core.exceptions import ResourceNotFoundError
        if isinstance(error, ResourceNotFoundError):
            raise HTTPException(status_code=404, detail='Attachment file not found')
        raise HTTPException(status_code=502, detail='Attachment storage is temporarily unavailable')
    return StreamingResponse(download.chunks(), media_type='application/octet-stream', headers={
        'Content-Disposition': f"attachment; filename*=UTF-8''{quote(name, safe='')}",
    })
