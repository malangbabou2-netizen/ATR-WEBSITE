import test from 'node:test';
import assert from 'node:assert/strict';
import { validCatalog } from '../moto-news.mjs';
const now = Date.parse('2026-10-19T17:00:00Z');
const item = { title: 'Actualité', summary: 'Résumé', source: 'Test', source_id: 'test', language: 'fr', url: 'https://example.com/article', published_at: '2026-10-19T15:00:00Z' };
test('catalog filters duplicates, bad URLs, old articles and untranslated text', () => {
    const catalog = validCatalog({ version: 1, items: [item, item, {...item, url: 'javascript:alert(1)'}, {...item, language: 'en'}, {...item, published_at: '2020-01-01'}, {...item, published_at: 'invalid'}] }, now);
    assert.deepEqual(catalog.items, [item]);
    assert.throws(() => validCatalog({ version: 2 }));
});
