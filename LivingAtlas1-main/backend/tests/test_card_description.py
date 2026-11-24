"""Offline draft generation checks with a stubbed DB, link reader and Helper."""

import asyncio
import base64
import importlib
import io
import json
import sys
import types
from pathlib import Path
from unittest.mock import MagicMock, patch
from zipfile import ZipFile

import httpx
import pytest
from fastapi import FastAPI
from PIL import Image


PACKAGE = types.ModuleType('description_test_package')
PACKAGE.__path__ = [str(Path(__file__).resolve().parents[1] / 'endpoint_files')]
sys.modules[PACKAGE.__name__] = PACKAGE
with patch.dict(sys.modules, {'card_description_links': MagicMock(), 'database': MagicMock()}):
    description = importlib.import_module(f'{PACKAGE.__name__}.card_description')
    sources = importlib.import_module(f'{PACKAGE.__name__}.card_description_sources')

PATH = '/cards/generate-description'
TOKEN = 'x' * 43
HEADERS = {'Authorization': f'Bearer {TOKEN}'}


def post(parts, headers=HEADERS):
    app = FastAPI()
    app.include_router(description.router)

    async def request():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://testserver') as client:
            return await client.post(PATH, files=parts, headers=headers)

    return asyncio.run(request())


def zipped(name, data):
    result = io.BytesIO()
    with ZipFile(result, 'w') as archive:
        archive.writestr(name, data)
    return result.getvalue()


def png_fixture():
    buffer = io.BytesIO()
    Image.new('RGBA', (16, 12), (34, 80, 20, 100)).save(buffer, format='PNG')
    return buffer.getvalue()


@pytest.fixture
def runtime(tmp_path, monkeypatch):
    cursor = MagicMock()
    cursor.fetchone.return_value = (3, 'test@example.test', False)
    connection = MagicMock()
    connection.cursor.return_value.__enter__.return_value = cursor
    monkeypatch.setattr(description, 'get_request_connection', lambda: connection)
    release = MagicMock()
    monkeypatch.setattr(description, 'release_request_connection', release)
    monkeypatch.setattr(description, 'read_link', MagicMock(return_value='Fish passage data from a public project page.'))
    helper = MagicMock(return_value=MagicMock(status_code=200, json=lambda: {'description': 'Draft text.'}))
    monkeypatch.setattr(description.requests, 'post', helper)
    monkeypatch.setenv('LOCAL_TEST_MODE', '1')
    monkeypatch.setenv('ATLAS_HELPER_URL', 'http://127.0.0.1:8001')
    monkeypatch.setenv('ATLAS_DESCRIPTION_TOKEN', 'test-' * 8)
    monkeypatch.setattr(sources.azure_storage, 'LOCAL_STORAGE_ROOT', tmp_path)
    return cursor, release, helper


def test_add_draft_uses_readable_link_text_and_image_bytes_without_saving(runtime):
    cursor, release, helper = runtime
    image = png_fixture()
    response = post([
        ('title', (None, 'Fish passage')),
        ('links', (None, json.dumps([{'url': 'https://example.test/project', 'text': 'Project page'}]))),
        ('images', ('stream.png', image, 'image/png')),
        ('files', ('survey.csv', b'year,count\n2025,240', 'text/csv')),
        ('files', ('report.bin', b'x', 'application/octet-stream')),
    ])
    assert response.status_code == 200, response.json()
    assert response.json()['description'] == 'Draft text.'
    assert response.json()['warnings'] == ['report.bin was skipped. The file type is unsupported.']
    url, = helper.call_args.args
    assert url == 'http://127.0.0.1:8001/internal/cards/description'
    request = helper.call_args.kwargs
    assert request['headers'] == {'X-Atlas-Description-Token': 'test-' * 8}
    assert request['allow_redirects'] is False
    assert request['json']['sources'] == [
        {'label': 'Project page', 'text': 'Fish passage data from a public project page.'},
        {'label': 'survey.csv', 'text': 'year,count\n2025,240'},
    ]
    encoded = request['json']['images'][0]['data_url'].split(',', 1)[1]
    with Image.open(io.BytesIO(base64.b64decode(encoded))) as frame:
        assert frame.format == 'JPEG'
        assert frame.size == (16, 12)
    assert cursor.execute.call_count == 1  # Authentication is the only DB query.
    release.assert_called_once()


def test_owner_draft_reads_only_retained_saved_materials_and_deduplicates_thumbnail(runtime):
    cursor, release, helper = runtime
    saved_image = sources.azure_storage.upload_bytes('card_images/stream.webp', png_fixture())
    saved_file = sources.azure_storage.upload_bytes('files/study.zip', zipped('study.txt', b'Monitoring summary'))
    saved_attachment_image = sources.azure_storage.upload_bytes('files/map.zip', zipped('map.png', png_fixture()))
    cursor.fetchone.side_effect = [(3, 'test@example.test', False), (3, saved_image)]
    cursor.fetchall.side_effect = [[(12, saved_image, 'Stream photo')], [(8, 'study', saved_file, '.zip'), (9, 'map', saved_attachment_image, '.zip')]]
    response = post([
        ('card_id', (None, '43')), ('image_ids', (None, '[12,15]')),
        ('file_ids', (None, '[8,9]')), ('include_thumbnail', (None, 'true')),
    ])
    assert response.status_code == 200, response.json()
    assert 'Saved image 15 was skipped' in response.json()['warnings'][0]
    payload = helper.call_args.kwargs['json']
    assert payload['sources'] == [{'label': 'study.txt', 'text': 'Monitoring summary'}]
    assert [image['label'] for image in payload['images']] == ['Project thumbnail', 'map.png']
    assert cursor.execute.call_args_list[2].args[1] == (43, [12, 15])
    assert cursor.execute.call_args_list[3].args[1] == (43, [8, 9])
    release.assert_called_once()


def test_missing_session_and_non_owner_fail_before_reading_materials(runtime):
    cursor, release, helper = runtime
    parts = [('card_id', (None, '43')), ('image_ids', (None, '[12]'))]
    assert post(parts, headers={}).status_code == 401
    cursor.execute.assert_not_called()
    cursor.fetchone.side_effect = [(3, 'test@example.test', False), (4, 'thumbnail')]
    assert post(parts).status_code == 403
    assert cursor.execute.call_count == 2
    release.assert_called_once()
    description.read_link.assert_not_called()
    helper.assert_not_called()


def test_unsupported_sources_and_vision_configuration_have_actionable_errors(runtime):
    _, _, helper = runtime
    response = post([('files', ('unknown.bin', b'??', 'application/octet-stream'))])
    assert response.status_code == 422
    assert 'file type is unsupported' in response.json()['detail']
    helper.assert_not_called()

    helper.return_value = MagicMock(
        status_code=503, json=lambda: {'detail': 'Card description generation from images is not configured.'},
    )
    response = post([('images', ('stream.png', png_fixture(), 'image/png'))])
    assert response.status_code == 503
    assert 'configure the vision model' in response.json()['detail']


def test_oversized_multipart_request_fails_before_session_lookup(runtime, monkeypatch):
    cursor, _, helper = runtime
    monkeypatch.setattr(description, 'MAX_REQUEST_BYTES', 128)
    response = post([('files', ('big.txt', b'a' * 256, 'text/plain'))])
    assert response.status_code == 413
    cursor.execute.assert_not_called()
    helper.assert_not_called()


def test_missing_helper_configuration_fails_before_reading_links(runtime, monkeypatch):
    _, _, helper = runtime
    monkeypatch.delenv('ATLAS_DESCRIPTION_TOKEN')
    response = post([('links', (None, '[{"url":"https://example.test/project"}]'))])
    assert response.status_code == 503
    description.read_link.assert_not_called()
    helper.assert_not_called()


def test_word_document_and_nested_saved_bundle():
    docx = zipped('word/document.xml', b'''<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:p><w:r><w:t>River monitoring report</w:t></w:r></w:p></w:document>''')
    assert sources.read_document(docx, 'study.docx') == 'River monitoring report'
    nested = zipped('bundle.zip', zipped('README.txt', b'GIS dataset notes'))
    assert list(sources.attachment_contents(nested, 'bundle.zip', saved=True)) == [('README.txt', b'GIS dataset notes')]


def test_pdf_text_is_extracted_from_document_content():
    from pypdf import PdfWriter
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

    name = NameObject
    pdf = PdfWriter()
    page = pdf.add_blank_page(width=612, height=792)
    page[name('/Resources')] = DictionaryObject({name('/Font'): DictionaryObject({name('/F1'): DictionaryObject({
        name('/Type'): name('/Font'), name('/Subtype'): name('/Type1'), name('/BaseFont'): name('/Helvetica'),
    })})})
    contents = DecodedStreamObject()
    contents.set_data(b'BT /F1 18 Tf 72 720 Td (Watershed survey report) Tj ET')
    page[name('/Contents')] = pdf._add_object(contents)
    stream = io.BytesIO()
    pdf.write(stream)
    assert sources.read_document(stream.getvalue(), 'survey.pdf') == 'Watershed survey report'


def test_pdf_parser_exceptions_do_not_expose_document_contents(monkeypatch):
    import pypdf

    monkeypatch.setattr(pypdf, 'PdfReader', MagicMock(side_effect=ValueError('private document content')))
    with pytest.raises(ValueError, match='^the PDF could not be read$'):
        sources.read_document(b'private document content', 'report.pdf')
