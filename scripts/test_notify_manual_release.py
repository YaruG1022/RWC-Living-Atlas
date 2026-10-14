import importlib.util
from pathlib import Path
import unittest
from urllib.error import URLError

spec = importlib.util.spec_from_file_location('notify', Path(__file__).with_name('notify-manual-release.py'))
notify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(notify)


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


if __name__ == '__main__':
    unittest.main()
