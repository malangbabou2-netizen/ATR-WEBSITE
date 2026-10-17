import test from 'node:test';
import assert from 'node:assert/strict';
import { bannerBoundary, heroBanners } from '../cms-content-utils.mjs';
import { buildContentCatalog } from '../scripts/build-cms-content.mjs';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
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

// Exercise the actual campaign controller, including its scheduled transition.
test('Temporary campaign ends at November 1 midnight Dakar without reload; original fallback stays permanent', async () => {
    const { runInNewContext } = await import('node:vm');
    const source = (await readFile(new URL('../script.js', import.meta.url), 'utf8')).split('const adventureStatusLabels')[0];
    let now = Date.parse('2026-10-31T23:59:59Z');
    const timers = new Map(); let timerId = 0;
    const classes = new Set();
    const content = { appendChild(buttons) { buttons.parentElement = this; } };
    const actions = { appendChild: content.appendChild };
    const buttons = { parentElement: content };
    content.querySelector = () => buttons;
    const artwork = { hidden: true };
    const hero = { classList: { toggle(name, active) { active ? classes.add(name) : classes.delete(name); } }, querySelector() { return content; } };
    const RealDate = Date;
    class ClockDate extends RealDate { static now() { return now; } }
    runInNewContext(source, {
        Date: ClockDate, Intl,
        document: { querySelector(selector) { return ({ '.hero': hero, '.hero-campaign': artwork, '.hero-campaign-actions': actions, '.hero-buttons': buttons })[selector]; }, addEventListener() {} },
        window: { addEventListener() {} },
        setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, at: now + delay }); return id; },
        clearTimeout(id) { timers.delete(id); }
    });
    assert.equal(artwork.hidden, false);
    assert.equal(buttons.parentElement, actions);
    assert.equal(classes.has('hero--october-rose'), true);
    now += 1000;
    for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); }
    assert.equal(artwork.hidden, true);
    assert.equal(classes.has('hero--october-rose'), false);
    assert.equal(buttons.parentElement, content);
    assert.equal(timers.size, 0, 'no annual reactivation of the temporary campaign');
    const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
    assert.match(css, /url\("images\/hero-ATR\.jpg"\)/);
});
