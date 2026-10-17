const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    const errors = [];
    const catalog = JSON.parse(await fs.readFile('_site/cms-content-catalog.json', 'utf8'));
    const entry = { partner_name: 'Fixture navigateur locale', placement: 'hero', active: true, priority: 1, start_date: '2026-10-17T12:00:00Z', end_date: '2026-10-17T13:00:00Z', image: 'images/hero-ATR.jpg', translations: { fr: { image_alt: 'Fixture locale' } } };
    const banners = [ { ...entry, slug: 'a', image_mobile: 'images/hero-ATR.png' }, { ...entry, slug: 'b', priority: 2 } ];
    async function make(width, entries = banners, reducedMotion = 'no-preference') {
        const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Asia/Tokyo', reducedMotion });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.clock.install({ time: new Date('2026-10-17T12:00:01Z') });
        await page.clock.pauseAt(new Date('2026-10-17T12:00:02Z'));
        await page.route('https://atr.test/**', async route => {
            const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
            if (pathname === '/cms-content-catalog.json') return route.fulfill({ json: { ...catalog, collections: { ...catalog.collections, 'partner-banners': entries } } });
            try { await route.fulfill({ path: path.resolve('_site', '.' + (pathname === '/' ? '/index.html' : pathname)), contentType: pathname.endsWith('.mjs') || pathname.endsWith('.js') ? 'text/javascript' : undefined }); }
            catch { await route.fulfill({ status: 404, body: '' }); }
        });
        await page.goto('https://atr.test/');
        await page.waitForFunction(() => document.querySelector('#cmsContentState').hidden);
        return page;
    }
    try {
        const p = await make(1440);
        const hero = p.locator('.hero-carousel');
        await hero.waitFor({ state: 'visible' });
        const first = await hero.locator('span').textContent();
        await p.clock.runFor(5999); assert.equal(await hero.locator('span').textContent(), first);
        await p.clock.runFor(2); await p.waitForFunction(first => document.querySelector('.hero-carousel span').textContent !== first, first);
        await hero.getByRole('button', { name: 'Mettre en pause' }).click();
        const paused = await hero.locator('span').textContent(); await p.clock.runFor(12000);
        assert.equal(await hero.locator('span').textContent(), paused);
        await hero.getByRole('button', { name: 'Suivante' }).click();
        await p.waitForFunction(value => document.querySelector('.hero-carousel span').textContent !== value, paused);
        const beforeReload = first; await p.reload(); await hero.waitFor({ state: 'visible' }); assert.notEqual(await hero.locator('span').textContent(), beforeReload);
        await hero.getByRole('button', { name: 'Précédente' }).focus();
        const focused = await hero.locator('span').textContent(); await p.mouse.move(1400, 890); await p.clock.runFor(12000); assert.equal(await hero.locator('span').textContent(), focused);
        await p.keyboard.press('ArrowRight'); await p.waitForFunction(value => document.querySelector('.hero-carousel span').textContent !== value, focused);
        await p.clock.runFor(3600000); assert.equal(await hero.isVisible(), false); assert.equal(await p.locator('.hero--october-rose').count(), 1);
        for (const width of [390, 768, 1440]) {
            const mobile = await make(width, [banners[0]], 'reduce');
            await mobile.locator('.hero-carousel').waitFor({ state: 'visible' });
            const size = await mobile.locator('.hero-carousel-frame').boundingBox(); assert.ok(Math.abs(size.width / size.height - 16/9) < .01);
            assert.equal(await mobile.locator('.hero-carousel-controls').isVisible(), false);
            assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            assert.match(await mobile.locator('.hero-carousel img').evaluate(img => img.currentSrc), width <= 700 ? /hero-ATR.png/ : /hero-ATR.jpg/);
            if (width === 390) await mobile.screenshot({ path: '/private/tmp/atr-hero-mobile.png' });
            await mobile.context().close();
        }
        const reduced = await make(390, banners, 'reduce'); await reduced.locator('.hero-carousel').waitFor({ state: 'visible' });
        const still = await reduced.locator('.hero-carousel span').textContent(); await reduced.clock.runFor(12000); assert.equal(await reduced.locator('.hero-carousel span').textContent(), still);
        const broken = await make(390, [{ ...entry, slug: 'broken', image: 'images/missing.jpg' }]);
        assert.equal(await broken.locator('.hero-carousel').isVisible(), false);
        assert.equal(await broken.locator('.hero--october-rose').count(), 1);
        assert.deepEqual(errors, []);
        console.log('Hero browser checks passed: rotation, pause, focus, arrows, reload, expiry, mobile, reduced motion, image failure.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
