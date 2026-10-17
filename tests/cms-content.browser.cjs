const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const url = process.env.ATR_CMS_URL || 'http://127.0.0.1:8081/';
const screenshots = '/private/tmp/atr-cms-preview';

(async () => {
    const { fixtureCatalogs, TEST_COUNTS } = await import('./content-fixtures.mjs');
    const { visibleContent } = await import('../cms-content-utils.mjs');
    const { visibleVideos } = await import('../atr-tv-utils.mjs');
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
        const expectedHistory = await page.evaluate(async () => {
            const response = await fetch(location.href);
            const source = new DOMParser().parseFromString(await response.text(), 'text/html');
            return [...source.querySelectorAll('#evenements .event-item')].map((item) => item.textContent.replace(/\s+/g, ' ').trim());
        });
        assert.deepEqual(await page.locator('#evenements .event-item:not(.cms-card)').evaluateAll((items) => items.map((item) => item.textContent.replace(/\s+/g, ' ').trim())), expectedHistory);
        assert.equal(await page.locator('#jeey-trip-title').count(), 1);
        assert.equal(await page.locator('form[action="https://formspree.io/f/xjygyraa"]').count(), 1);
        assert.equal(await page.locator('form[action="https://formspree.io/f/xljgjwpe"]').count(), 1);
        assert.equal(await page.locator('[data-language]').count(), 0);
        assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
        assert.equal(await page.locator('.hero-buttons a').count(), 2);
    };
    try {
        const realResponse = await fetch(new URL('cms-content-catalog.json', url));
        const tvResponse = await fetch(new URL('atr-tv-catalog.json', url));
        assert.ok(realResponse.ok && tvResponse.ok, 'Build and serve the site before running browser checks');
        const real = await realResponse.json();
        const realTv = await tvResponse.json();
        for (const width of [1440, 390, 320]) {
            const page = await make(width);
            await page.goto(url); await ready(page);
            await page.waitForFunction(() => document.querySelector('#atrTvGrid').getAttribute('aria-busy') === 'false');
            const expectedEvents = visibleContent(real.collections.events, 'events', '2026-10-17');
            assert.deepEqual(await page.locator('[data-cms-collection="events"] .cms-card').evaluateAll((items) => items.map((item) => item.dataset.cmsSlug)), expectedEvents.map((entry) => entry.slug));
            for (const [index, entry] of expectedEvents.entries()) {
                const article = page.locator('[data-cms-collection="events"] .cms-card').nth(index);
                assert.equal(await article.locator('h3').textContent(), entry.translations.fr.title);
                assert.equal(await article.locator('.event-location').textContent(), entry.location || '');
                const dates = [...new Set([entry.start_date, entry.end_date].filter(Boolean).map((value) => value.slice(0, 10)))];
                assert.deepEqual(await article.locator('time').evaluateAll((items) => items.map((item) => item.dateTime)), dates);
                if (entry.translations.fr.body) {
                    await article.locator('summary').click();
                    assert.ok((await article.locator('.cms-body').textContent()).trim().length > 0);
                }
            }
            assert.deepEqual(await page.locator('.atr-tv-card').evaluateAll((items) => items.map((item) => item.dataset.videoSlug)), visibleVideos(realTv.videos).map((entry) => entry.slug));
            await checkPreserved(page);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            await page.locator('#evenements').screenshot({ path: path.join(screenshots, `events-${width}.png`) });
            const hasNews = visibleContent(real.collections['moto-news'], 'moto-news', '2026-10-17').length > 0;
            const hasNewsBanner = visibleContent(real.collections['partner-banners'], 'partner-banners', '2026-10-17').some((entry) => entry.placement === 'moto-news');
            assert.equal(await page.locator('[data-cms-collection="moto-news"]').isVisible(), hasNews);
            assert.equal(await page.locator('#actualites-moto').isVisible(), hasNews || hasNewsBanner);
            await page.context().close();
        }
        console.log('Current event/video catalogs, complete historical content, dates, details, mobile 320/390, desktop 1440 and forms: passed');

        const fixtures = await fixtureCatalogs(1);
        const reference = fixtures.cms.collections.events[0];
        const words = { title: '<img src=x onerror=alert(1)> Test local', summary: 'Résumé local', body: '**Détail**\n\n* Une étape\n\n<script>alert(1)</script>', image_alt: 'Image locale', objectives: ['Objectif local'], program: [{ heading: 'Journée locale', details: 'Détails locaux' }], atr_role_note: 'Initiative personnelle, ATR relais', itinerary: 'Itinéraire local', practical_information: 'Information locale', photos: [] };
        const entry = { ...reference, translations: { fr: words, en: words }, image: 'images/nonexistent-test.png', document: 'documents/CAMP ATR 2026 NIANING.pdf', roadbook: 'documents/roadbooks/Roadbook J E E Y.pdf' };
        const variants = {
            ...fixtures.cms, collections: {
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

        for (const count of TEST_COUNTS) {
            const { cms, tv } = await fixtureCatalogs(count);
            for (const width of [1440, 320]) {
                const p = await make(width);
                await p.route('**/cms-content-catalog.json', (route) => route.fulfill({ json: cms }));
                await p.route('**/atr-tv-catalog.json', (route) => route.fulfill({ json: tv }));
                await p.goto(url); await ready(p);
                await p.waitForFunction(() => document.querySelector('#atrTvGrid').getAttribute('aria-busy') === 'false');
                for (const name of ['events', 'member-adventures', 'moto-news', 'ride-and-give']) {
                    const expected = visibleContent(cms.collections[name], name, '2026-10-17');
                    const host = p.locator(`[data-cms-collection="${name}"]`);
                    assert.deepEqual(await host.locator('.cms-card').evaluateAll((items) => items.map((item) => item.dataset.cmsSlug)), expected.map((entry) => entry.slug));
                    assert.equal(await host.isVisible(), expected.length > 0);
                }
                const expectedVideos = visibleVideos(tv.videos);
                assert.deepEqual(await p.locator('.atr-tv-card').evaluateAll((items) => items.map((item) => item.dataset.videoSlug)), expectedVideos.map((entry) => entry.slug));
                const news = visibleContent(cms.collections['moto-news'], 'moto-news', '2026-10-17').slice(0, 5);
                assert.deepEqual(await p.locator('#cmsNewsStrip a').allTextContents(), news.map((entry) => entry.translations.fr.title));
                const banners = visibleContent(cms.collections['partner-banners'], 'partner-banners', '2026-10-17');
                const banner = p.locator('[data-cms-placement="events"]');
                assert.equal(await banner.isVisible(), banners.length > 0);
                for (const entry of banners) {
                    assert.match(await banner.textContent(), new RegExp(`Publicité — ${entry.partner_name}`));
                    if (banners.length > 1) await banner.locator('button').click();
                }
                assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
                await checkPreserved(p);
                await p.context().close();
            }
            console.log(`Six collections: ${count} active entries plus excluded archives, desktop and mobile: passed`);
        }

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
