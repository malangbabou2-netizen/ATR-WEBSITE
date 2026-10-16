// Optional browser checks: Playwright + installed Chrome, against the local HTTP preview.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const previewUrl = process.env.ATR_TV_URL || 'http://127.0.0.1:8080/';
const screenshots = process.env.ATR_TV_SCREENSHOTS || '/private/tmp/atr-tv-preview';

(async () => {
    await fs.mkdir(screenshots, { recursive: true });
    const layoutBaseline = process.env.ATR_TV_LAYOUT_BASELINE
        ? JSON.parse(await fs.readFile(process.env.ATR_TV_LAYOUT_BASELINE, 'utf8')) : null;
    const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    const errors = [];
    const makePage = async (width, date = '2026-10-11T12:00:00Z') => {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        await context.addInitScript((instant) => {
            const OriginalDate = Date;
            window.Date = class extends OriginalDate {
                constructor(...args) { super(...(args.length ? args : [instant])); }
                static now() { return instant; }
            };
        }, Date.parse(date));
        const page = await context.newPage();
        page.on('pageerror', (error) => errors.push(error.message));
        return page;
    };
    const goto = (page) => page.goto(previewUrl, { waitUntil: 'domcontentloaded' });
    const ready = (page) => page.waitForFunction(() => document.querySelector('#atrTvGrid').getAttribute('aria-busy') === 'false');
    const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

    const checkNavigation = async (page) => {
        const sections = await page.locator('main > section[id]').evaluateAll((nodes) => nodes.map((node) => node.id));
        const index = sections.indexOf('evenements');
        assert.deepEqual(sections.slice(index, index + 3), ['evenements', 'atr-tv', 'aventures-membres']);
        const links = await page.locator('#siteNavigation a').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
        const navIndex = links.indexOf('#evenements');
        assert.deepEqual(links.slice(navIndex, navIndex + 3), ['#evenements', '#atr-tv', '#aventures-membres']);
        const menu = page.locator('#menuButton');
        for (const id of ['evenements', 'atr-tv', 'aventures-membres']) {
            const link = page.locator(`#siteNavigation a[href="#${id}"]`);
            if (!await link.isVisible()) await menu.click();
            assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
            if (id === 'evenements') assert.equal(await link.textContent(), 'Événements');
            if (id === 'aventures-membres') assert.equal(await link.textContent(), 'Aventures des membres');
            await link.click();
            await page.waitForFunction((target) => location.hash === `#${target}`, id);
            if (await menu.isVisible()) assert.equal(await menu.getAttribute('aria-expanded'), 'false');
        }
    };

    try {
        for (const width of [1440, 1280, 390, 320]) {
            const page = await makePage(width);
            await goto(page);
            await ready(page);
            if (layoutBaseline) {
                await page.evaluate(() => Promise.all([...document.querySelectorAll('main > section:not(#atr-tv) img')].map((image) => {
                    image.loading = 'eager';
                    return image.decode().catch(() => {});
                })));
                const layout = await page.evaluate(() => [...document.querySelectorAll('main > section[id]:not(#atr-tv), .header')]
                    .map((node) => ({ id: node.id || 'header', top: node.offsetTop, width: node.offsetWidth, height: node.offsetHeight })));
                assert.deepEqual(layout, layoutBaseline[width], `Other sections changed at ${width}px`);
            }
            assert.equal(await page.locator('.atr-tv-card').count(), 1);
            assert.equal(await page.locator('.atr-tv-copy h3').textContent(), 'Camp ATR LAC ROSE P1');
            assert.equal(await noOverflow(page), true, `Horizontal overflow at ${width}px`);
            await checkNavigation(page);
            await page.evaluate(() => window.scrollTo(0, document.querySelector('#atr-tv').offsetTop - 90));
            await page.locator('.atr-tv-cover img').evaluate((image) => image.decode().catch(() => {}));
            await page.locator('#atr-tv').screenshot({ path: path.join(screenshots, `atr-tv-${width}.png`) });
            const loadedImage = await page.locator('.atr-tv-cover img').evaluate((image) => image.naturalWidth > 0);
            console.log(`Viewport ${width}px: card visible, no overflow; thumbnail loaded=${loadedImage}`);
            assert.equal(await page.locator('[data-language]').count(), 0);
            assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
            assert.equal(await page.locator('.atr-tv-copy h3').textContent(), 'Camp ATR LAC ROSE P1');
            assert.match(await page.locator('.atr-tv-play').textContent(), /Lire la vidéo/);
            assert.equal(await page.locator('.atr-tv-category').textContent(), 'Événements');
            await checkNavigation(page);
            await page.locator('.atr-tv-play').click();
            assert.equal(await page.locator('#atrTvPlayer').evaluate((dialog) => dialog.open), true);
            const dimensions = await page.locator('#atrTvEmbed iframe').evaluate((iframe) => {
                const bounds = iframe.getBoundingClientRect();
                const container = iframe.parentElement.getBoundingClientRect();
                const dialog = document.querySelector('#atrTvPlayer');
                return { width: bounds.width, height: bounds.height, containerHeight: container.height,
                    dialogOverflows: dialog.scrollWidth > dialog.clientWidth,
                    pageOverflows: document.documentElement.scrollWidth > innerWidth };
            });
            assert.ok(dimensions.height >= 200 && dimensions.containerHeight >= 200, `Player too short at ${width}px`);
            assert.equal(dimensions.dialogOverflows, false);
            assert.equal(dimensions.pageOverflows, false);
            console.log(`Player at ${width}px: ${dimensions.width} × ${dimensions.height}px; no horizontal overflow${layoutBaseline ? '; other sections unchanged' : ''}`);
            const src = await page.locator('#atrTvEmbed iframe').getAttribute('src');
            assert.equal(new URL(src).searchParams.get('start'), '674');
            assert.equal(await page.locator('#atrTvExternal').getAttribute('href'), 'https://www.youtube.com/watch?v=eyeOfSerVw0&t=674s');
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => !document.querySelector('#atrTvEmbed iframe'));
            assert.equal(await page.locator('#atrTvEmbed iframe').count(), 0);
            assert.match(await page.locator('.atr-tv-play').textContent(), /Lire la vidéo/);
            assert.equal(await page.locator('.atr-tv-category').textContent(), 'Événements');
            await checkNavigation(page);
            await page.locator('.atr-tv-play').click();
            await page.locator('#atrTvClose').click();
            await page.waitForFunction(() => !document.querySelector('#atrTvEmbed iframe'));
            assert.equal(await page.locator('#atrTvEmbed iframe').count(), 0);
            assert.equal(await page.locator('#interest-form-start').getAttribute('action'), 'https://formspree.io/f/xjygyraa');
            assert.equal(await page.locator('#adventure-proposal-form').getAttribute('action'), 'https://formspree.io/f/xljgjwpe');
            assert.equal(await page.locator('.hero').evaluate((hero) => hero.classList.contains('hero--october-rose')), true);
            assert.equal(await page.locator('.hero-campaign-actions .hero-buttons').count(), 1);
            await page.context().close();
        }
        console.log('French-only UI, French title, playback offset, dialog close, forms and active Hero: passed');

        const persisted = await makePage(390);
        await goto(persisted);
        await ready(persisted);
        await persisted.evaluate(() => localStorage.setItem('atr-language', 'en'));
        await persisted.reload();
        await ready(persisted);
        assert.equal(await persisted.locator('html').getAttribute('lang'), 'fr');
        assert.match(await persisted.locator('.atr-tv-play').textContent(), /Lire la vidéo/);
        assert.equal(await persisted.evaluate(() => localStorage.getItem('atr-language')), 'fr');
        assert.match(await persisted.locator('[data-adventure-status]').first().textContent(), /^Statut : /);
        await persisted.context().close();

        const noStorage = await makePage(390);
        await noStorage.addInitScript(() => {
            Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
        });
        await goto(noStorage);
        await ready(noStorage);
        assert.equal(await noStorage.locator('html').getAttribute('lang'), 'fr');
        assert.match(await noStorage.locator('.atr-tv-play').textContent(), /Lire la vidéo/);
        await noStorage.context().close();

        const catalog = JSON.parse(await fs.readFile(path.join(__dirname, '../atr-tv-catalog.json'), 'utf8'));
        const fixture = catalog.videos[0];
        const variants = [
            { ...fixture, slug: 'normal-test', featured: false, sort_order: -10 },
            { ...fixture, slug: 'feature-two-test', featured: true, sort_order: 2 },
            { ...fixture, slug: 'feature-one-test', featured: true, sort_order: 1, category: 'road-trips', translations: { fr: { title: 'Test français', summary: '<img src=x onerror=alert(1)>' }, en: { title: 'English test' } } },
            { ...fixture, slug: 'archived-test', archived: true }
        ];
        const filterPage = await makePage(390);
        await filterPage.route('**/atr-tv-catalog.json', (route) => route.fulfill({ json: { ...catalog, videos: variants } }));
        await goto(filterPage);
        await ready(filterPage);
        assert.deepEqual(await filterPage.locator('.atr-tv-card').evaluateAll((nodes) => nodes.map((node) => node.dataset.videoSlug)), ['feature-one-test', 'feature-two-test', 'normal-test']);
        assert.equal(await filterPage.locator('.atr-tv-summary img').count(), 0);
        await filterPage.locator('[data-tv-category="events"]').click();
        assert.equal(await filterPage.locator('.atr-tv-card').count(), 2);
        assert.equal(await filterPage.locator('[data-tv-category="events"]').getAttribute('aria-pressed'), 'true');
        await filterPage.locator('[data-tv-category="road-trips"]').click();
        assert.equal(await filterPage.locator('.atr-tv-copy h3').textContent(), 'Test français');
        await filterPage.context().close();
        console.log('Featured/order/category/archive rules, French titles and text safety: passed');

        const empty = await makePage(390);
        await empty.route('**/atr-tv-catalog.json', (route) => route.fulfill({ json: { version: 1, videos: [] } }));
        await goto(empty);
        await ready(empty);
        assert.equal(await empty.locator('#atrTvState').textContent(), 'Aucune vidéo disponible pour le moment.');
        assert.equal(await empty.locator('#atrTvFilters').isVisible(), false);
        await empty.context().close();

        const failure = await makePage(390);
        await failure.route('**/atr-tv-catalog.json', (route) => route.fulfill({ status: 500, body: 'Unavailable' }));
        await goto(failure);
        await ready(failure);
        assert.equal(await failure.locator('#atrTvRetry').isVisible(), true);
        assert.equal(await failure.locator('#atrTvState').textContent(), 'Les vidéos ne peuvent pas être chargées pour le moment.');
        await failure.unroute('**/atr-tv-catalog.json');
        await failure.locator('#atrTvRetry').click();
        await ready(failure);
        assert.equal(await failure.locator('.atr-tv-card').count(), 1);
        await failure.context().close();

        const loading = await makePage(390);
        let release;
        const hold = new Promise((resolve) => { release = resolve; });
        await loading.route('**/atr-tv-catalog.json', async (route) => { await hold; await route.fulfill({ json: catalog }); });
        await goto(loading);
        await loading.waitForFunction(() => document.querySelector('#atrTvGrid').getAttribute('aria-busy') === 'true');
        assert.equal(await loading.locator('#atrTvState').textContent(), 'Chargement des vidéos…');
        release();
        await ready(loading);
        await loading.context().close();
        console.log('Legacy English preference migration, empty, error/retry and loading states: passed');

        for (const [date, active] of [['2026-10-31T23:59:59Z', true], ['2026-11-01T00:00:00Z', false]]) {
            const hero = await makePage(390, date);
            await goto(hero);
            await ready(hero);
            assert.equal(await hero.locator('.hero').evaluate((node) => node.classList.contains('hero--october-rose')), active);
            assert.equal(await hero.locator(active ? '.hero-campaign-actions .hero-buttons' : '.hero-content .hero-buttons').count(), 1);
            assert.equal(await hero.locator('.hero-buttons a').count(), 2);
            if (!active) assert.match(await hero.locator('.hero').evaluate((node) => getComputedStyle(node).backgroundImage), /hero-ATR\.jpg/);
            await hero.context().close();
        }
        assert.deepEqual(errors, []);
        console.log('Dakar midnight Hero boundary and no JavaScript page errors: passed');
        console.log(`Screenshots: ${screenshots}`);
    } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
