import importlib.util
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

spec = importlib.util.spec_from_file_location('news', Path(__file__).resolve().parents[1] / 'scripts/fetch-moto-news.py')
news = importlib.util.module_from_spec(spec); spec.loader.exec_module(news)
NOW = datetime(2026, 10, 19, 17, tzinfo=timezone.utc)
SOURCE = dict(id='test', name='Média de test', url='https://example.com/feed', hosts=['example.com'], language='en', enabled=True,
              rights=dict(redistribution=True, translation=True, evidence='fixture only', checked_at='2026-10-19'))
RSS = b'''<rss version="2.0"><channel><item><title>Motorcycle news</title><link>https://example.com/story/?utm_source=x</link><pubDate>Mon, 19 Oct 2026 15:00:00 GMT</pubDate><description>&lt;p&gt;Wear a helmet.&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;</description></item></channel></rss>'''

class NewsTests(unittest.TestCase):
    def test_rss_limits_sanitizing_and_canonical_url(self):
        item, = news.parse_feed(RSS, SOURCE, NOW)
        self.assertEqual(item['url'], 'https://example.com/story')
        self.assertEqual(item['summary'], 'Wear a helmet.')
        with self.assertRaises(ValueError): news.parse_feed(b'<!DOCTYPE x>' + RSS, SOURCE, NOW)
        with self.assertRaises(ValueError): news.parse_feed(b'x' * (news.MAX_BYTES + 1), SOURCE, NOW)
        for url in ['javascript:alert(1)', 'http://example.com/', 'https://evil.test/', 'https://user:pass@example.com/']:
            with self.assertRaises(ValueError): news.canonical(url, SOURCE['hosts'])
        old = RSS.replace(b'19 Oct 2026', b'19 Aug 2026')
        self.assertEqual(news.parse_feed(old, SOURCE, NOW), [])
        self.assertEqual(news.parse_feed(RSS.replace(b'19 Oct 2026', b'20 Oct 2026'), SOURCE, NOW), [])

    def test_deduplication_and_translation_cache(self):
        item, = news.parse_feed(RSS, SOURCE, NOW)
        calls, cache = [], {}
        def translate(value): calls.append(value); return 'Français : ' + value
        result = news.translated(item, 'en', cache, translate)
        self.assertEqual(result['language'], 'fr')
        news.translated(item, 'en', cache, translate)
        self.assertEqual(len(calls), 2)
        self.assertEqual(len(news.dedupe([result, result, dict(result, url='https://example.com/duplicate')])), 1)
        with self.assertRaises(ValueError): news.translated(item, 'en', {}, lambda x: x)
        self.assertFalse(news.translated(item, 'fr', {}, None)['translated'])

    def test_rights_gate_cache_fallback_and_revocation(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            def config(source): (root / 'sources.json').write_text(json.dumps(dict(sources=[source])))
            config(SOURCE)
            report = news.refresh(root, lambda _: RSS, lambda x: 'Version française : ' + x, NOW)
            self.assertEqual(report['articles'], 1)
            def fail(_): raise TimeoutError()
            report = news.refresh(root, fail, None, NOW)
            self.assertEqual(report['articles'], 1)
            self.assertTrue(report['errors'])
            fallback = json.loads((root / 'fallback.json').read_text())
            self.assertEqual(len(fallback['items']), 1)
            config(dict(SOURCE, rights=dict(SOURCE['rights'], translation=False)))
            def forbidden(_): self.fail('Unapproved source fetched')
            report = news.refresh(root, forbidden, None, NOW)
            self.assertEqual(report['articles'], 0)
            self.assertEqual(json.loads((root / 'fallback.json').read_text())['items'], [])
            self.assertFalse(news.approved(dict(SOURCE, enabled=False)))
            self.assertFalse(news.approved(dict(SOURCE, rights={})))

if __name__ == '__main__': unittest.main()
