const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
    const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    const axePath = process.env.AXE_SCRIPT || require.resolve('axe-core/axe.min.js');
    const now = '2026-10-19T17:00:00Z';
    const items = [1, 2, 3].map(i => ({ title: `Actualité de test ${i}`, summary: 'Résumé de test pour vérifier la lecture au clavier et le défilement des actualités moto.', source: 'Média de test', source_id: 'test', language: 'fr', translated: true, url: `https://example.com/article-${i}`, published_at: now }));
    async function make({ width = 1440, reducedMotion = 'no-preference', all = false, fail = false, empty = false, bothFail = false, one = false } = {}) {
        const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion });
        await page.clock.install({ time: new Date(Date.parse(now) - 1000) });
        await page.clock.pauseAt(new Date(now));
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.host !== 'atr.test') return route.abort();
            if (url.pathname.startsWith('/news/')) {
                if (bothFail || (fail && url.pathname.endsWith('catalog.json'))) return route.fulfill({ status: 503, body: '' });
                return route.fulfill({ json: { version: 1, updated_at: now, items: empty ? [] : one ? items.slice(0, 1) : items } });
            }
            try { await route.fulfill({ path: path.resolve('_site', '.' + (url.pathname === '/' ? '/index.html' : url.pathname)), contentType: /\.(mjs|js)$/.test(url.pathname) ? 'text/javascript' : undefined }); }
            catch { await route.fulfill({ status: 404, body: '' }); }
        });
        await page.goto(`https://atr.test/${all ? 'actualites.html' : ''}`);
        await page.waitForFunction(() => !document.querySelector('[data-news-state]').textContent.startsWith('Chargement'));
        return { page, errors, root: page.locator('[data-moto-news]') };
    }
    async function audit(page, selector) {
        await page.clock.resume();
        await page.addScriptTag({ path: axePath });
        const violations = await page.evaluate(async selector => (await axe.run(selector || document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] } })).violations, selector);
        assert.deepEqual(violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), []);
    }
    try {
        const { page, root, errors } = await make();
        const visibleTitle = () => root.locator('article:not([hidden]) h3').textContent();
        assert.equal(await visibleTitle(), items[0].title);
        await page.clock.runFor(5999); assert.equal(await visibleTitle(), items[0].title);
        await page.clock.runFor(2); assert.equal(await visibleTitle(), items[1].title);
        await root.hover(); const hovered = await visibleTitle(); await page.clock.runFor(12000); assert.equal(await visibleTitle(), hovered);
        await page.mouse.move(0, 0); await page.clock.runFor(6001); assert.notEqual(await visibleTitle(), hovered);
        await root.getByRole('button', { name: 'Actualité suivante' }).focus();
        const focused = await visibleTitle(); await page.clock.runFor(12000); assert.equal(await visibleTitle(), focused);
        await page.keyboard.press('Enter'); assert.notEqual(await visibleTitle(), focused);
        await root.getByRole('button', { name: 'Mettre en pause' }).click();
        await page.mouse.move(0, 0); await page.evaluate(() => document.activeElement.blur());
        const paused = await visibleTitle(); await page.clock.runFor(12000); assert.equal(await visibleTitle(), paused);
        assert.equal(await root.locator('article:not([hidden]) a').getAttribute('href'), items.find(i => i.title === paused).url);
        assert.equal(await root.locator('article img').count(), 0);
        assert.equal(await root.locator('article:not([hidden])').count(), 1);
        await audit(page, '#actu-moto'); assert.deepEqual(errors, []);
        await page.close();
        for (const width of [390, 768, 1440]) {
            const { page, root } = await make({ width, reducedMotion: 'reduce' });
            const first = await root.locator('article:not([hidden]) h3').textContent();
            await page.clock.runFor(12000); assert.equal(await root.locator('article:not([hidden]) h3').textContent(), first);
            assert.equal(await root.getByRole('button', { name: 'Reprendre le défilement' }).count(), 1);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await root.screenshot({ path: `/private/tmp/atr-news-${width}.png` });
            await page.close();
        }
        for (const option of [{ all: true }, { fail: true }, { empty: true }, { bothFail: true }, { one: true }]) {
            const { page, root } = await make(option);
            if (option.all) { assert.equal(await root.locator('article').count(), 3); await audit(page); }
            if (option.fail) assert.match(await root.locator('[data-news-state]').textContent(), /temporairement indisponible/);
            if (option.empty) assert.match(await root.locator('[data-news-state]').textContent(), /préparation/);
            if (option.bothFail) assert.match(await root.locator('[data-news-state]').textContent(), /indisponibles/);
            if (option.one) assert.equal(await root.locator('[data-news-controls]').isVisible(), false);
            await page.close();
        }
        console.log('Browser: 6s rotation, hover, keyboard, pause, reduced motion, 3 widths, archive, fallback, empty/error/single states; axe: 0 violations in new module and full news page.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
