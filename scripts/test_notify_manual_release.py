import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import unittest
from urllib.error import URLError

spec = importlib.util.spec_from_file_location('notify', Path(__file__).with_name('notify-manual-release.py'))
notify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(notify)


# Run the real CLI entry point in a child process, replacing HTTP and sleeping
# before loading it. An unhandled deployment/dispatch failure must stay nonzero.
CLI_HARNESS = textwrap.dedent('''\
    import json
    import runpy
    import sys
    from unittest.mock import patch
    from urllib.error import HTTPError, URLError
    from urllib.request import Request

    script, scenario, *arguments = sys.argv[1:]
    sys.argv = [script, *arguments]
    manifest = arguments[arguments.index('--manifest') + 1]
    with open(manifest, encoding='utf-8') as source:
        expected = json.load(source)
    calls = []

    class Response:
        def __init__(self, url, status, body=b''):
            self.url, self.status, self.body = url, status, body
            self.headers = {'Content-Type': 'application/json'}
        def __enter__(self):
            return self
        def __exit__(self, *args):
            return False
        def read(self, limit):
            return self.body[:limit]

    def request(request, timeout):
        assert isinstance(request, Request)
        calls.append({'url': request.full_url, 'method': request.get_method(),
                      'body': json.loads(request.data) if request.data else None})
        if request.full_url == 'https://atlas.example/manual/current.json':
            if scenario == 'network_error':
                raise URLError('deployment unavailable')
            if scenario == 'invalid_json':
                return Response(request.full_url, 200, b'{invalid json')
            marker = dict(expected)
            if scenario == 'mismatch':
                marker['version'] = 'older-release'
            else:
                marker['visuals'] = {'count': 2, 'sha256': 'deployed-render'}
            return Response(request.full_url, 200, json.dumps(marker).encode())
        assert request.full_url == 'https://api.github.com/repos/trusted/chatbot/dispatches'
        assert request.get_header('Authorization') == 'Bearer test-only-token'
        if scenario == 'dispatch_http_error':
            raise HTTPError(request.full_url, 403, 'Forbidden', {}, None)
        return Response(request.full_url, 200 if scenario == 'dispatch_rejected' else 204)

    try:
        with patch('urllib.request.urlopen', side_effect=request), patch('time.sleep'):
            runpy.run_path(script, run_name='__main__')
    finally:
        print('__MOCK_HTTP__=' + json.dumps(calls))
''')


class PublishedReleaseTests(unittest.TestCase):
    def test_uses_deployed_visual_digest_with_the_exact_text_release(self):
        expected = {'version': 'same', 'revision': 'same', 'files': [{'sha256': 'same'}], 'visuals': {'count': 2, 'sha256': 'ci'}}
        deployed = {**expected, 'visuals': {'count': 2, 'sha256': 'netlify'}}
        self.assertEqual(notify.wait_published('https://atlas.example', expected, attempts=1, fetch=lambda _: deployed), deployed)
        with self.assertRaises(RuntimeError):
            notify.wait_published('https://atlas.example', expected, attempts=1, fetch=lambda _: {k: v for k, v in deployed.items() if k != 'visuals'})
    def test_waits_for_exact_successful_release(self):
        responses = iter([{'version': 'old'}, {'version': 'current'}])
        waits = []
        expected = {'version': 'current'}
        result = notify.wait_published('https://atlas.example', expected, attempts=2,
            fetch=lambda url: next(responses), sleep=waits.append)
        self.assertEqual(result, expected)
        self.assertEqual(waits, [10])

    def test_never_dispatches_when_deployment_does_not_match(self):
        with self.assertRaisesRegex(RuntimeError, 'No dispatch sent'):
            notify.wait_published('https://atlas.example', {'version': 'new'}, attempts=1,
                fetch=lambda url: {'version': 'old'})

    def test_network_failure_can_be_retried(self):
        calls = []
        def fetch(url):
            calls.append(url)
            if len(calls) == 1:
                raise URLError('deploy pending')
            return {'version': 'new'}
        self.assertEqual(notify.wait_published('https://atlas.example', {'version': 'new'}, attempts=2,
            fetch=fetch, sleep=lambda _: None), {'version': 'new'})

    def test_dispatch_url_cannot_be_selected_by_untrusted_data(self):
        with self.assertRaises(ValueError):
            notify.wait_published('https://atlas.example@evil.example/path', {}, attempts=1)


class NotifyCliTests(unittest.TestCase):
    def run_cli(self, scenario, verify_only=False):
        expected = {'version': 'current-release', 'revision': 'a' * 40,
                    'files': [{'sha256': 'c' * 64}],
                    'visuals': {'count': 2, 'sha256': 'ci-render'}}
        environment = {**os.environ, 'ATLAS_MANUAL_BASE_URL': 'https://atlas.example',
                       'CHATBOT_REPO': 'trusted/chatbot', 'GH_TOKEN': 'test-only-token'}
        if verify_only:
            environment.pop('GH_TOKEN')
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / 'current.json'
            manifest.write_text(json.dumps(expected), encoding='utf-8')
            command = [sys.executable, '-c', CLI_HARNESS, str(Path(notify.__file__).resolve()),
                       scenario, '--manifest', str(manifest)]
            if verify_only:
                command.append('--verify-only')
            result = subprocess.run(command, capture_output=True, text=True,
                                    encoding='utf-8', env=environment, timeout=10)
        summaries = [line for line in result.stdout.splitlines() if line.startswith('__MOCK_HTTP__=')]
        self.assertEqual(len(summaries), 1, result.stderr)
        return result, json.loads(summaries[0].split('=', 1)[1])

    def test_publication_failures_exit_nonzero_without_dispatch_in_both_modes(self):
        for scenario in ('mismatch', 'network_error', 'invalid_json'):
            for verify_only in (False, True):
                with self.subTest(scenario=scenario, verify_only=verify_only):
                    result, calls = self.run_cli(scenario, verify_only)
                    self.assertNotEqual(result.returncode, 0, result.stdout)
                    self.assertIn('No dispatch sent', result.stderr)
                    self.assertGreater(len(calls), 0)
                    self.assertTrue(all(call['method'] == 'GET' for call in calls))

    def test_verified_release_can_succeed_without_a_dispatch_token(self):
        result, calls = self.run_cli('success', verify_only=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('Verified published manual current-release', result.stdout)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]['method'], 'GET')

    def test_dispatch_contains_only_verified_release_identity_to_configured_repo(self):
        result, calls = self.run_cli('success')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls, [
            {'url': 'https://atlas.example/manual/current.json', 'method': 'GET', 'body': None},
            {'url': 'https://api.github.com/repos/trusted/chatbot/dispatches', 'method': 'POST',
             'body': {'event_type': 'atlas-manual-published', 'client_payload': {
                 'revision': 'a' * 40, 'version': 'current-release', 'checksum': 'c' * 64}}},
        ])

    def test_dispatch_http_failure_or_rejection_exits_nonzero(self):
        for scenario in ('dispatch_http_error', 'dispatch_rejected'):
            with self.subTest(scenario=scenario):
                result, calls = self.run_cli(scenario)
                self.assertNotEqual(result.returncode, 0, result.stdout)
                self.assertEqual(len(calls), 2)
                self.assertNotIn('sync dispatched', result.stdout)


if __name__ == '__main__':
    unittest.main()
