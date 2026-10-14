"""Wait for the exact app release to be published, then dispatch a manual sync.

Only a configured HTTPS origin and repository may be used. Dispatch payloads
contain a commit/version/checksum, never URLs or executable content.
"""
import argparse
import json
import os
import re
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse


def get_json(url):
    request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache', 'Accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status != 200 or 'json' not in response.headers.get('Content-Type', '') or response.url != url:
            raise ValueError('Expected a published JSON resource at the configured origin')
        data = response.read(65537)
        if len(data) > 65536:
            raise ValueError('Release marker too large')
        return json.loads(data)


def wait_published(base, expected, attempts=60, delay=10, fetch=get_json, sleep=time.sleep):
    parsed = urlparse(base)
    if parsed.scheme != 'https' or not parsed.netloc or parsed.username or parsed.password or parsed.path not in {'', '/'} or parsed.query or parsed.fragment:
        raise ValueError('ATLAS_MANUAL_BASE_URL must be the HTTPS app origin')
    last = None
    for attempt in range(attempts):
        try:
            marker = fetch(base.rstrip('/') + '/manual/current.json')
            if marker == expected:
                return marker
            last = 'a different app release is currently published'
        except (urllib.error.URLError, ValueError, TimeoutError) as exc:
            last = type(exc).__name__
        if attempt + 1 < attempts:
            sleep(delay)
    raise RuntimeError(f'Expected app release did not publish: {last}. No dispatch sent; rerun after a successful deployment.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', required=True)
    args = parser.parse_args()
    base = os.environ.get('ATLAS_MANUAL_BASE_URL', '')
    repo = os.environ.get('CHATBOT_REPO', '')
    token = os.environ.get('GH_TOKEN', '')
    if not base or not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo) or not token:
        raise ValueError('ATLAS_MANUAL_BASE_URL, CHATBOT_REPO and CHATBOT_DISPATCH_TOKEN are required')
    expected = json.load(open(args.manifest, encoding='utf-8'))
    marker = wait_published(base, expected)
    body = json.dumps({'event_type': 'atlas-manual-published', 'client_payload': {
        'revision': marker['revision'], 'version': marker['version'], 'checksum': marker['files'][0]['sha256']}}).encode()
    request = urllib.request.Request(f'https://api.github.com/repos/{repo}/dispatches', data=body,
        headers={'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status != 204:
            raise RuntimeError('Repository dispatch was not accepted')
    print(f"Published manual {marker['version']}; sync dispatched to {repo}")


if __name__ == '__main__':
    main()
