// The actual shipped Decap UI, with its official in-memory test backend only.
// All network access outside this simulated origin is blocked. No GitHub credentials.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const origin = 'https://atr-decap.test';

(async () => {
    const { VENDOR_FILE, INSERTION, SOURCE_MAP_REFERENCE } = await import('../scripts/prepare-decap-media.mjs');
    const png = await fs.readFile(path.join(root, 'images/IMG_3678.PNG'));
    const patched = await fs.readFile(path.join(root, VENDOR_FILE), 'utf8');
    const original = patched.replace(INSERTION, '') + SOURCE_MAP_REFERENCE;
    const html = await fs.readFile(path.join(root, 'admin/index.html'), 'utf8');
    const config = (await fs.readFile(path.join(root, 'admin/config.yml'), 'utf8')).replace('name: github', 'name: test-repo\n  login: false');
    const mobilePng = await fs.readFile(path.join(root, 'images/IMG_3677.PNG'));
    const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    const errors = [];
    async function open(source, width = 1280, published = false) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        const page = await context.newPage();
        const publicRequests = [], blocked = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.addInitScript(({ published, png }) => {
            window.CMS_MANUAL_INIT = true;
            window.repoFiles = {};
            window.repoFilesUnpublished = {};
            window.repoNotes = {};
            if (published) {
                const file = new File([Uint8Array.from(atob(png), (letter) => letter.charCodeAt(0))], 'published.png', { type: 'image/png' });
                window.repoFiles = {
                    uploads: { 'published.png': { path: 'uploads/published.png', content: { path: 'uploads/published.png', url: '/uploads/published.png', fileObj: file } } },
                    content: { 'partner-banners': { 'published.fr.json': { path: 'content/partner-banners/published.fr.json', content: JSON.stringify({ partner_name: 'Campagne publiée de test', image: '/uploads/published.png', image_alt: 'Image publiée de test', placement: 'hero', start_date: '2026-10-18T00:00:00Z', end_date: '2026-10-19T00:00:00Z', active: true, archived: false, priority: 0 }) } } }
                };
            }
            const backup = sessionStorage.getItem('atr-test-draft');
            if (backup) {
                const { key, draft } = JSON.parse(backup);
                draft.diffs = draft.diffs.map((diff) => diff.bytes ? {
                    ...diff, content: { ...diff.content, fileObj: new File([Uint8Array.from(diff.bytes)], diff.content.name, { type: diff.mime }) }
                } : diff);
                window.repoFilesUnpublished[key] = draft;
            }
        }, { published, png: png.toString('base64') });
        await page.route('**/*', async (route) => {
            const url = new URL(route.request().url());
            if (url.origin !== origin) { blocked.push(url.origin); return route.abort(); }
            if (url.pathname === '/admin/') return route.fulfill({ contentType: 'text/html', body: html.replace(/integrity="[^"]+"/, `integrity="sha384-${createHash('sha384').update(source).digest('base64')}"`) });
            if (url.pathname === '/admin/config.yml') return route.fulfill({ contentType: 'text/yaml', body: config });
            if (url.pathname === `/${VENDOR_FILE}`) return route.fulfill({ contentType: 'text/javascript', body: source });
            if (url.pathname.startsWith('/uploads/')) {
                publicRequests.push(url.pathname);
                if (url.pathname === '/uploads/published.png') return route.fulfill({ contentType: 'image/png', body: png });
            }
            return route.fulfill({ status: 404, body: 'Not published' });
        });
        await page.goto(`${origin}/admin/`);
        await page.waitForFunction(() => window.CMS);
        await page.evaluate(() => window.CMS.init());
        await page.getByRole('link', { name: 'Partenaires et bannières', exact: true }).click();
        if (published) await page.evaluate(() => { location.hash = '#/collections/partner_banners/entries/published'; });
        else await page.locator('a[href="#/collections/partner_banners/new"]').click();
        return { page, context, publicRequests, blocked };
    }
    async function upload(page, name, index = 0) {
        await page.getByRole('button', { name: 'Choisir une image', exact: true }).nth(index).click();
        // Distinct image bytes: Decap intentionally identifies media by their content SHA.
        await page.locator('input[type=file]').setInputFiles({ name, mimeType: 'image/png', buffer: name.includes('mobile') ? mobilePng : png });
        await page.getByText(name, { exact: true }).waitFor();
        await page.waitForFunction(() => [...document.querySelectorAll('img[src^="blob:"]')].some((image) => image.complete && image.naturalWidth > 0));
        assert.ok(await page.getByText('Brouillon', { exact: true }).count() > 0);
        const choose = page.getByRole('button', { name: 'Choisir les éléments sélectionnés', exact: true });
        await choose.click();
    }
    const imagesLoad = (page, count) => page.waitForFunction((count) => {
        const images = [...document.querySelectorAll('img[src^="blob:"]')];
        return images.length >= count && images.every((image) => image.complete && image.naturalWidth > 0);
    }, count);
    try {
        const baseline = await open(original);
        await upload(baseline.page, 'original-draft.png');
        await baseline.page.waitForFunction(() => [...document.images].some((image) => image.src.endsWith('/uploads/original-draft.png') && image.complete && image.naturalWidth === 0));
        assert.ok(baseline.publicRequests.includes('/uploads/original-draft.png'));
        await baseline.context.close();
        console.log('Actual unmodified Decap 3.16.3: draft thumbnail reproduces the public /uploads/ HTTP 404');

        for (const width of [1280, 390]) {
            const current = await open(patched, width);
            const { page } = current;
            await upload(page, 'draft-main.png'); await imagesLoad(page, 1);
            // The mobile field is the second image widget; the selected main widget has no choose button.
            await upload(page, 'draft-mobile.png'); await imagesLoad(page, 2);
            assert.deepEqual(current.publicRequests, []);
            assert.deepEqual(await page.evaluate(() => Object.keys(window.repoFiles)), []);
            assert.deepEqual(await page.evaluate(() => Object.keys(window.repoFilesUnpublished)), []);
            await page.locator('input[id^="partner_name-field"]').fill('Bannière de test locale');
            await page.locator('input[id^="image_alt-field"]').fill('Image de test locale');
            await page.locator('input[id^="placement-field"]').click();
            await page.getByText('Accueil — Hero', { exact: true }).click();
            await page.locator('input[id^="start_date-field"]').fill('2026-10-18T00:00');
            await page.locator('input[id^="end_date-field"]').fill('2026-10-19T00:00');
            await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
            await page.waitForFunction(() => Object.keys(window.repoFilesUnpublished).length > 0);
            const draft = await page.evaluate(() => Object.values(window.repoFilesUnpublished)[0]);
            assert.equal(draft.collection, 'partner_banners');
            assert.equal(draft.status, 'draft');
            assert.ok(draft.diffs.some((diff) => diff.path === 'uploads/draft-main.png'));
            assert.ok(draft.diffs.some((diff) => diff.path === 'uploads/draft-mobile.png'));
            const data = JSON.parse(draft.diffs.find((diff) => typeof diff.content === 'string').content);
            assert.equal(data.image, '/uploads/draft-main.png');
            assert.equal(data.image_mobile, '/uploads/draft-mobile.png');
            assert.deepEqual(await page.evaluate(() => Object.keys(window.repoFiles)), []);
            await page.locator('a[href="#/collections/partner_banners"]').click();
            await page.goto(`${origin}/admin/#/collections/partner_banners/entries/${draft.slug}`);
            await imagesLoad(page, 2);
            // Reopen in a fresh document: rebuild only the test backend's persisted branch,
            // not Decap's asset cache or the previous document's blob URLs.
            await page.evaluate(async () => {
                const key = Object.keys(window.repoFilesUnpublished)[0];
                const draft = window.repoFilesUnpublished[key];
                const diffs = await Promise.all(draft.diffs.map(async (diff) => typeof diff.content === 'string' ? diff : {
                    ...diff, content: { name: diff.content.name, path: diff.content.path, id: diff.content.id },
                    bytes: Array.from(new Uint8Array(await diff.content.fileObj.arrayBuffer())), mime: diff.content.fileObj.type
                }));
                sessionStorage.setItem('atr-test-draft', JSON.stringify({ key, draft: { ...draft, diffs } }));
            });
            await page.reload();
            await page.waitForFunction(() => window.CMS);
            await page.evaluate(() => window.CMS.init());
            await imagesLoad(page, 2);
            assert.deepEqual(current.publicRequests, []);
            await page.screenshot({ path: `/private/tmp/atr-decap-preview-${width}.png` });
            await current.context.close();
            console.log(`Actual corrected UI at ${width}px: main/mobile draft previews, save/reopen and no public upload requests or publication`);
        }
        const published = await open(patched, 1280, true);
        await published.page.waitForFunction(() => [...document.images].some((image) => image.src.endsWith('/uploads/published.png') && image.complete && image.naturalWidth > 0));
        await upload(published.page, 'replacement.png');
        await imagesLoad(published.page, 1);
        assert.equal(await published.page.evaluate(() => JSON.parse(window.repoFiles.content['partner-banners']['published.fr.json'].content).image), '/uploads/published.png');
        assert.equal(await published.page.evaluate(() => Boolean(window.repoFiles.uploads['replacement.png'])), false);
        assert.deepEqual(await published.page.evaluate(() => Object.keys(window.repoFilesUnpublished)), []);
        await published.context.close();
        console.log('Existing published image still loads; importing a replacement does not overwrite or publish the existing media');
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
