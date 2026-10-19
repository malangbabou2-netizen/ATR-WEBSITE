"""Fetch only explicitly licensed RSS. Never fetch article pages or images."""
import hashlib
import html
import json
import re
import sys
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

ROOT = Path(__file__).resolve().parent.parent
MAX_BYTES = 2_000_000
MAX_AGE = timedelta(days=30)


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(); self.parts = []; self.ignore = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'): self.ignore += 1
        elif not self.ignore: self.parts.append(' ')
    def handle_endtag(self, tag):
        if tag in ('script', 'style'): self.ignore = max(0, self.ignore - 1)
    def handle_data(self, data):
        if not self.ignore: self.parts.append(data)


def plain(value, limit):
    parser = PlainText(); parser.feed(value or '')
    text = ' '.join(html.unescape(''.join(parser.parts)).split())
    return text if len(text) <= limit else text[:limit].rsplit(' ', 1)[0] + '…'


def canonical(url, hosts):
    p = urlsplit(url.strip())
    if p.scheme != 'https' or p.hostname not in hosts or p.username or p.password or p.port not in (None, 443):
        raise ValueError('URL hors de la source approuvée')
    query = [(k, v) for k, v in parse_qsl(p.query) if not k.lower().startswith('utm_') and k.lower() not in ('fbclid', 'gclid')]
    return urlunsplit(('https', p.hostname, p.path.rstrip('/') or '/', urlencode(sorted(query)), ''))


def approved(source):
    rights = source.get('rights', {})
    return (source.get('enabled') is True and rights.get('redistribution') is True
            and (source.get('language') == 'fr' or (source.get('language') == 'en' and rights.get('translation') is True))
            and bool(rights.get('evidence')) and bool(rights.get('checked_at')))


def parse_feed(raw, source, now):
    if len(raw) > MAX_BYTES or re.search(br'<!\s*(DOCTYPE|ENTITY)', raw, re.I):
        raise ValueError('XML trop volumineux ou déclaration interdite')
    root = ET.fromstring(raw)
    if root.tag != 'rss': raise ValueError('RSS 2.0 attendu')
    items = []
    for node in root.findall('./channel/item')[:60]:
        try:
            url = canonical(node.findtext('link') or '', source['hosts'])
            date = parsedate_to_datetime(node.findtext('pubDate') or '')
            if date.tzinfo is None: date = date.replace(tzinfo=timezone.utc)
            if date > now + timedelta(hours=1) or now - date > MAX_AGE: continue
            title = plain(node.findtext('title'), 200)
            summary = plain(node.findtext('description'), 450)
            if not title or not summary: continue
            items.append(dict(url=url, title=title, summary=summary, source=source['name'], source_id=source['id'],
                              published_at=date.astimezone(timezone.utc).isoformat()))
        except (ValueError, TypeError, OverflowError): continue
    return items


def title_key(title):
    return re.sub(r'[^\w]+', '', unicodedata.normalize('NFKC', title).casefold())


def dedupe(items):
    urls, titles, result = set(), set(), []
    for item in sorted(items, key=lambda i: i['published_at'], reverse=True):
        key = title_key(item['title'])
        if item['url'] in urls or key in titles: continue
        urls.add(item['url']); titles.add(key); result.append(item)
    return result[:60]


def read_json(path, default):
    try: return json.loads(path.read_text())
    except FileNotFoundError: return default


def atomic_json(path, data):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def translated(item, language, cache, translate):
    if language == 'fr': return dict(item, language='fr', translated=False)
    values = []
    for field in ('title', 'summary'):
        key = hashlib.sha256(('argos-en-fr-1.9:' + item[field]).encode()).hexdigest()
        value = cache.get(key)
        if not value:
            value = translate(item[field]).strip()
            if not value or value.casefold() == item[field].casefold(): raise ValueError('Traduction absente')
            cache[key] = value
        values.append(value)
    return dict(item, title=values[0], summary=values[1], language='fr', translated=True)


def fetch(source):
    canonical(source['url'], source['hosts'])
    request = urllib.request.Request(source['url'], headers={'User-Agent': 'ATR-News/1.0 (+https://africatwinriders.sn/)', 'Accept': 'application/rss+xml, application/xml'})
    with urllib.request.urlopen(request, timeout=25) as response:
        canonical(response.geturl(), source['hosts'])
        return response.read(MAX_BYTES + 1)


def refresh(folder=ROOT / 'news', fetcher=fetch, translate=None, now=None):
    now = now or datetime.now(timezone.utc)
    sources = read_json(folder / 'sources.json', {})['sources']
    permitted = {s['id']: s for s in sources if approved(s)}
    previous = read_json(folder / 'catalog.json', {'version': 1, 'updated_at': None, 'items': []})
    # Reapply the allowlist even to the fallback: revoking a source purges its cache.
    retained = []
    for item in previous['items']:
        try:
            source = permitted[item['source_id']]
            canonical(item['url'], source['hosts'])
            if now - datetime.fromisoformat(item['published_at']) <= MAX_AGE and item.get('language') == 'fr': retained.append(item)
        except (KeyError, ValueError, TypeError): continue
    cache = read_json(folder / 'translations.json', {})
    failures, fresh, successes = [], [], 0
    for source in permitted.values():
        try:
            parsed = parse_feed(fetcher(source), source, now)
            if not parsed: raise ValueError('Flux vide ou sans article récent exploitable')
            for item in parsed:
                try:
                    if source['language'] == 'en' and translate is None:
                        from argostranslate.translate import translate as argos
                        translate = lambda value: argos(value, 'en', 'fr')
                    fresh.append(translated(item, source['language'], cache, translate))
                except Exception as error:
                    failures.append(f"{source['id']}: traduction ignorée ({type(error).__name__})")
            successes += 1
        except Exception as error:
            failures.append(f"{source['id']}: collecte échouée ({type(error).__name__})")
    result = {'version': 1, 'updated_at': now.isoformat() if fresh else previous.get('updated_at'), 'items': dedupe(fresh + retained)}
    # Both files contain only permitted, recent French articles. No raw RSS/images.
    atomic_json(folder / 'fallback.json', {'version': 1, 'updated_at': previous.get('updated_at') or result['updated_at'], 'items': dedupe(retained or fresh)})
    atomic_json(folder / 'catalog.json', result)
    # Bound the translation cache to the latest run's inputs, without publishing it.
    # Cache is private to the Actions artifact; cap growth.
    atomic_json(folder / 'translations.json', dict(list(cache.items())[-720:]))
    report = {'checked_at': now.isoformat(), 'approved_sources': len(permitted), 'successful_feeds': successes, 'articles': len(result['items']), 'errors': failures}
    print(json.dumps(report, ensure_ascii=False))
    return report


if __name__ == '__main__':
    report = refresh()
    if report['errors']: sys.exit(1)
