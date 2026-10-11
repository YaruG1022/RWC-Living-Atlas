"""Resolve draft attachment links only after their files have uploaded."""
import json
import re


def parse_attachment_tokens(raw, file_count, description):
    tokens = json.loads(raw) if raw else [None] * file_count
    if (not isinstance(tokens, list) or len(tokens) != file_count
            or any(token is not None and (not isinstance(token, str) or not re.fullmatch(r'[a-f0-9-]{36}', token)) for token in tokens)):
        raise ValueError('Invalid description attachment tokens')
    actual = [token for token in tokens if token is not None]
    if len(set(actual)) != len(actual):
        raise ValueError('Duplicate description attachment tokens')
    referenced = set(re.findall(r'#pending-file-([a-f0-9-]{36})', description or ''))
    if not referenced.issubset(set(actual)):
        raise ValueError('A file referenced in the description was removed. Remove its link or select the file again.')
    return tokens


def resolve_attachment_token(description, token, file_id):
    if not token:
        return description
    return (description or '').replace(f'#pending-file-{token}', f'/downloadFile?fileID={file_id}')
