import test from 'node:test';
import assert from 'node:assert/strict';
import { bannerBoundary, heroBanners } from '../cms-content-utils.mjs';
import { buildContentCatalog } from '../scripts/build-cms-content.mjs';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const entry = { slug: 'a', partner_name: 'Fixture locale', image: '/images/hero-ATR.jpg', image_alt: 'Fixture locale', placement: 'hero', active: true, priority: 1, start_date: '2026-10-17T12:00:00Z', end_date: '2026-10-17T13:00:00Z' };
test('Hero: exact Dakar boundaries, explicit offsets and legacy whole days', () => {
    assert.equal(heroBanners([entry], Date.parse('2026-10-17T11:59:59Z')).length, 0);
    assert.equal(heroBanners([entry], Date.parse(entry.start_date)).length, 1);
    assert.equal(heroBanners([entry], Date.parse(entry.end_date)).length, 0);
    assert.equal(bannerBoundary('2026-10-17T13:00:00+01:00'), Date.parse(entry.start_date));
    assert.equal(bannerBoundary('2026-10-17', true), Date.parse('2026-10-18T00:00:00Z'));
    assert.throws(() => bannerBoundary('2026-10-17T12:00:00'));
    assert.throws(() => bannerBoundary('2026-02-30T12:00:00Z'));
});
test('Hero: multiple banners sorted by priority; inactive, archived, malformed excluded', () => {
    const now = Date.parse(entry.start_date);
    assert.deepEqual(heroBanners([entry, { ...entry, slug: 'b', priority: 4 }, { ...entry, active: false }, { ...entry, archived: true }, { ...entry, start_date: 'invalid' }], now).map((item) => item.slug), ['b', 'a']);
});
test('Hero catalog: optional link, mobile validation and reversed same-day interval', async () => {
    const root = await mkdtemp(join(tmpdir(), 'atr-hero-'));
    try {
        const folder = join(root, 'partner-banners'); await mkdir(folder);
        const file = join(folder, 'hero.fr.json');
        await writeFile(file, JSON.stringify({ ...entry, image_mobile: '/images/hero-ATR.png' }));
        assert.equal((await buildContentCatalog(root)).collections['partner-banners'][0].image_mobile, 'images/hero-ATR.png');
        await writeFile(file, JSON.stringify({ ...entry, end_date: '2026-10-17T11:00:00Z' }));
        await assert.rejects(buildContentCatalog(root), /Invalid Hero interval/);
        await writeFile(file, JSON.stringify({ ...entry, image_mobile: '/uploads/../secret.png' }));
        await assert.rejects(buildContentCatalog(root), /Invalid local asset/);
    } finally { await rm(root, { recursive: true, force: true }); }
});
