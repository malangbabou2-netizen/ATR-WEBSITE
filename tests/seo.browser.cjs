// Optional: build _site and serve it locally before running this Chrome audit.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
    const base = process.env.ATR_SEO_URL || 'http://127.0.0.1:8092/';
    const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    const errors = [];
    try {
        for (const width of [320, 768, 1440]) {
            const context = await browser.newContext({ viewport: { width, height: 900 } });
            const page = await context.newPage();
            page.on('pageerror', error => errors.push(error.message));
            const response = await page.goto(base);
            assert.equal(response.status(), 200);
            await page.locator('footer a', { hasText: 'Mentions légales' }).click();
            await page.waitForURL('**/mentions-legales.html');
            assert.equal(await page.title(), 'Mentions légales | Africa Twin Riders Sénégal');
            assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
            assert.equal(await page.locator('h1').count(), 1);
            const canonical = 'https://africatwinriders.sn/mentions-legales.html';
            assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), canonical);
            assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), canonical);
            assert.ok(await page.evaluate(() => document.styleSheets.length > 0 && [...document.images].every(img => img.complete && img.naturalWidth > 0)));
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            for (const email of ['samabusinesscom@gmail.com', 'malangbabou2@gmail.com']) assert.equal(await page.getByRole('link', { name: email, exact: true }).getAttribute('href'), `mailto:${email}`);
            await page.screenshot({ path: `/private/tmp/atr-legal-${width}.png`, fullPage: true });
            const sitemapResponse = await page.request.get(new URL('sitemap.xml', base).href);
            assert.equal(sitemapResponse.status(), 200);
            const xml = await sitemapResponse.text();
            assert.match(xml, /https:\/\/africatwinriders.sn\/mentions-legales.html/);
            assert.doesNotMatch(xml, /admin|actualites\.html|confidentialite\.html|draft/);
            await page.getByRole('link', { name: 'Retour au site ATR' }).click();
            await page.waitForURL(base);
            assert.equal(await page.title(), 'Africa Twin Riders Sénégal | ATR');
            await context.close();
        }
        assert.deepEqual(errors, []);
        console.log('SEO/mentions: HTTP, canonical/OG, footer and return links, confirmed contacts, images/CSS, sitemap, no overflow at 320/768/1440 and no JavaScript errors: passed.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
