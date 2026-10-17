const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const url = process.env.ATR_CMS_URL || 'http://127.0.0.1:8081/';
const screenshots = '/private/tmp/atr-cms-preview';

(async () => {
    await fs.mkdir(screenshots, { recursive: true });
    const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    const errors = [];
    const make = async (width, date = '2026-10-17T12:00:00Z') => {
        const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'America/New_York' });
        const page = await context.newPage();
        page.on('pageerror', (error) => errors.push(error.message));
        await page.clock.install({ time: new Date(Date.parse(date) - 1000) });
        await page.clock.pauseAt(new Date(date));
        return page;
    };
    const ready = (page) => page.waitForFunction(() => document.querySelector('#cmsContentState').hidden);
    const checkPreserved = async (page) => {
        assert.equal(await page.locator('#evenements .event-item:not(.cms-card)').count(), 8);
        assert.equal(await page.locator('#jeey-trip-title').count(), 1);
        assert.equal(await page.locator('form[action="https://formspree.io/f/xjygyraa"]').count(), 1);
        assert.equal(await page.locator('form[action="https://formspree.io/f/xljgjwpe"]').count(), 1);
        assert.equal(await page.locator('[data-language]').count(), 0);
        assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
        assert.equal(await page.locator('.hero-buttons a').count(), 2);
    };
    try {
        for (const width of [1440, 390, 320]) {
            const page = await make(width);
            await page.goto(url); await ready(page);
            await page.waitForFunction(() => document.querySelector('#atrTvGrid').getAttribute('aria-busy') === 'false');
            const article = page.locator('[data-cms-collection="events"] .cms-card');
            assert.equal(await article.count(), 1);
            assert.match(await article.locator('h3').textContent(), /Camp ATR à Nianing/);
            assert.equal(await article.locator('.event-location').textContent(), 'Nianing');
            assert.equal(await article.locator('.cms-status').textContent(), 'En cours');
            assert.match(await article.locator('time').first().textContent(), /17 octobre 2026/);
            assert.match(await article.locator('time').last().textContent(), /18 octobre 2026/);
            await article.locator('summary').click();
            assert.match(await article.locator('.cms-body').textContent(), /Grand[e] Expédition/);
            assert.equal(await page.locator('.atr-tv-card').count(), 1);
            await checkPreserved(page);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            await page.locator('#evenements').screenshot({ path: path.join(screenshots, `events-${width}.png`) });
            assert.equal(await page.locator('[data-cms-collection="moto-news"]').isVisible(), false);
            assert.equal(await page.locator('#actualites-moto').isVisible(), false);
            await page.context().close();
        }
        console.log('Real Nianing, all 8 historical events, dates, details, mobile 320/390, desktop 1440, forms and ATR TV: passed');

        const real = JSON.parse(await fs.readFile(path.resolve('_site/cms-content-catalog.json'), 'utf8'));
        const reference = real.collections.events[0];
        const words = { title: '<img src=x onerror=alert(1)> Test local', summary: 'Résumé local', body: '**Détail**\n\n* Une étape\n\n<script>alert(1)</script>', image_alt: 'Image locale', objectives: ['Objectif local'], program: [{ heading: 'Journée locale', details: 'Détails locaux' }], atr_role_note: 'Initiative personnelle, ATR relais', itinerary: 'Itinéraire local', practical_information: 'Information locale', photos: [] };
        const entry = { ...reference, translations: { fr: words, en: words }, image: 'images/nonexistent-test.png', document: 'documents/CAMP ATR 2026 NIANING.pdf', roadbook: 'documents/roadbooks/Roadbook J E E Y.pdf' };
        const variants = {
            ...real, collections: {
                events: [{ ...entry, slug: 'local-event' }],
                'member-adventures': [{ ...entry, slug: 'local-adventure', organizer: 'Test local' }],
                'moto-news': [{ ...entry, slug: 'local-news', publication_date: '2026-10-17', category: 'road-safety', source_name: 'Source locale', original_url: 'https://example.org/article' }],
                'partner-banners': [0, 1].map((priority) => ({ ...entry, slug: `local-banner-${priority}`, partner_name: `Test local ${priority}`, image: 'images/IMG_3678.PNG', destination_url: 'https://example.org/', placement: 'events', active: true, priority })),
                'ride-and-give': [{ ...entry, slug: 'local-action', date: '2026-10-17' }]
            }
        };
        const page = await make(320);
        await page.route('**/cms-content-catalog.json', (route) => route.fulfill({ json: variants }));
        await page.goto(url); await ready(page);
        for (const name of ['events', 'member-adventures', 'moto-news', 'ride-and-give']) {
            const host = page.locator(`[data-cms-collection="${name}"]`);
            assert.equal(await host.locator('.cms-card').count(), 1);
            assert.equal(await host.locator('script').count(), 0);
            await host.locator('summary').click();
            assert.equal(await host.locator('.cms-body strong').count(), 1);
            assert.match(await host.locator('h3').last().textContent(), /<img/);
        }
        const download = page.locator('[data-cms-collection="events"] a[type="application/pdf"]').first();
        const response = await page.request.get(await download.getAttribute('href'));
        assert.equal(response.status(), 200);
        assert.equal((await response.body()).subarray(0, 4).toString(), '%PDF');
        await page.waitForFunction(() => !document.querySelector('[data-cms-collection="events"] .cms-image'));
        assert.equal(await page.locator('#cmsNewsStrip a').count(), 1);
        const banner = page.locator('[data-cms-placement="events"]');
        assert.match(await banner.textContent(), /Publicité — Test local 1/);
        await banner.locator('button').click();
        assert.match(await banner.textContent(), /Publicité — Test local 0/);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await checkPreserved(page);
        await page.locator('#evenements').screenshot({ path: path.join(screenshots, 'six-collections-local-only.png') });
        await page.clock.setSystemTime(new Date('2026-10-19T00:00:00Z'));
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        assert.equal(await page.locator('[data-cms-collection="member-adventures"]').isVisible(), false);
        assert.equal(await banner.isVisible(), false);
        await page.context().close();
        console.log('Five CMS renderers: safe Markdown, optional missing images, valid PDF, private local fixtures, banner priorities/rotation, expiry, no overflow: passed');

        for (const mode of ['empty', 'error']) {
            const p = await make(390);
            await p.route('**/cms-content-catalog.json', (route) => mode === 'error' ? route.fulfill({ status: 500 }) : route.fulfill({ json: { version: 1, collections: Object.fromEntries(Object.keys(real.collections).map((key) => [key, []])) } }));
            await p.goto(url);
            if (mode === 'error') await p.waitForFunction(() => document.querySelector('#cmsContentState').dataset.error === 'true');
            else { await ready(p); assert.equal(await p.locator('.cms-card').count(), 0); }
            await checkPreserved(p); await p.context().close();
        }
        const boundary = await make(390, '2026-10-31T23:59:59.900Z');
        await boundary.goto(url); await ready(boundary);
        assert.equal(await boundary.locator('.hero--october-rose').count(), 1);
        await boundary.clock.runFor(200);
        assert.equal(await boundary.locator('.hero--october-rose').count(), 0);
        assert.equal(await boundary.locator('.hero-content .hero-buttons a').count(), 2);
        assert.match(await boundary.locator('.hero').evaluate((el) => getComputedStyle(el).backgroundImage), /hero-ATR\.jpg/);
        await boundary.context().close();
        assert.deepEqual(errors, []);
        console.log('Empty/error states, unchanged legacy content, exact Hero midnight Dakar restoration and no JavaScript errors: passed');
        console.log(`Screenshots: ${screenshots}`);
    } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
