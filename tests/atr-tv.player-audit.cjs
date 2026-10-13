// Optional real YouTube check in an isolated browser. Requires Playwright and Chrome.
// HTTPS origin is simulated by serving local public files through browser interception.
// This does NOT deploy or change africatwinriders.sn and is NOT a hosted staging site.
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const project = path.resolve(__dirname, '..');
const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.svg': 'image/svg+xml' };

async function main() {
    const browser = await chromium.launch({ headless: true,
        executablePath: process.env.ATR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    console.log(JSON.stringify({ browser: browser.version(), test: 'Simulated official HTTPS origin; no deployment' }));
    try {
        for (const variant of [
            { name: 'https-desktop', width: 1440, block: false },
            { name: 'https-third-party-cookies-blocked', width: 1440, block: true },
            { name: 'https-mobile-emulation-cookies-blocked', width: 390, block: true },
            { name: 'https-small-mobile-emulation', width: 320, block: true }
        ]) {
            const context = await browser.newContext({ viewport: { width: variant.width, height: 900 },
                isMobile: variant.width < 600, hasTouch: variant.width < 600 });
            await context.addCookies([{ name: 'ATR_AUDIT_ONLY', value: 'synthetic-test', domain: 'www.youtube-nocookie.com',
                path: '/', secure: true, sameSite: 'None' }]);
            const page = await context.newPage();
            const cdp = await context.newCDPSession(page);
            await cdp.send('Network.enable');
            if (variant.block) await cdp.send('Network.setCookieControls', {
                enableThirdPartyCookieRestriction: true, disableThirdPartyCookieMetadata: true, disableThirdPartyCookieHeuristics: true
            });
            const blocked = new Set();
            cdp.on('Network.requestWillBeSentExtraInfo', (event) => {
                for (const entry of event.associatedCookies || []) {
                    if (entry.cookie?.name === 'ATR_AUDIT_ONLY') for (const reason of entry.blockedReasons || []) blocked.add(reason);
                }
            });
            const pending = [];
            const evidence = { name: variant.name, blockRequested: variant.block, referer: null, playability: null };
            page.on('request', (request) => {
                if (request.isNavigationRequest() && request.url().includes('youtube-nocookie.com/embed/eyeOfSerVw0')) {
                    pending.push(request.allHeaders().then((headers) => { evidence.referer = headers.referer || null; }));
                }
            });
            page.on('response', (response) => {
                if (new URL(response.url()).pathname.endsWith('/youtubei/v1/player')) pending.push(response.json().then((data) => {
                    evidence.playability = { status: data.playabilityStatus?.status, embeddable: data.playabilityStatus?.playableInEmbed,
                        reason: data.playabilityStatus?.reason };
                }).catch(() => {}));
            });
            await page.route('https://africatwinriders.sn/**', async (route) => {
                const url = new URL(route.request().url());
                const name = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
                if (name.includes('..') || !/^\/(?:index\.html|style\.css|script\.js|translations\.js|atr-tv(?:-utils\.mjs|-catalog\.json|\.js)|images\/[^/]+)$/.test(name)) {
                    return route.fulfill({ status: 404, body: 'Not part of preview' });
                }
                try {
                    const body = await fs.readFile(path.join(project, name));
                    await route.fulfill({ status: 200, contentType: mimeTypes[path.extname(name).toLowerCase()] || 'application/octet-stream', body });
                } catch { await route.fulfill({ status: 404, body: 'Missing preview file' }); }
            });
            await page.goto('https://africatwinriders.sn/#atr-tv', { waitUntil: 'domcontentloaded' });
            await page.locator('.atr-tv-play').click();
            const iframe = page.locator('#atrTvEmbed iframe');
            evidence.iframe = await iframe.evaluate((node) => ({ src: node.src, referrerPolicy: node.referrerPolicy,
                width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, allow: node.allow,
                sandbox: node.getAttribute('sandbox') }));
            evidence.layout = await iframe.evaluate((node) => ({ containerHeight: node.parentElement.getBoundingClientRect().height,
                dialogOverflows: document.querySelector('#atrTvPlayer').scrollWidth > document.querySelector('#atrTvPlayer').clientWidth,
                pageOverflows: document.documentElement.scrollWidth > innerWidth }));
            assert.ok(evidence.iframe.height >= 200 && evidence.layout.containerHeight >= 200, 'Player must retain a height of at least 200px');
            assert.equal(evidence.layout.dialogOverflows, false, 'Player must not overflow horizontally');
            assert.equal(evidence.layout.pageOverflows, false, 'Page must not overflow horizontally');
            await iframe.contentFrame().locator('#movie_player').waitFor({ timeout: 30000 });
            const frame = await (await iframe.elementHandle()).contentFrame();
            try {
                await frame.waitForFunction(() => {
                    const video = document.querySelector('video');
                    return video && !video.paused && video.currentTime >= 674 && video.readyState >= 2;
                }, {}, { timeout: 20000 });
            } catch { /* Inspect provider errors rather than hide them behind a timeout. */ }
            const sample = () => frame.evaluate(() => {
                const video = document.querySelector('video');
                const player = document.querySelector('#movie_player');
                return { referrer: document.referrer, error: document.querySelector('.ytp-error')?.innerText || null,
                    currentTime: video?.currentTime, paused: video?.paused, readyState: video?.readyState,
                    playerState: typeof player?.getPlayerState === 'function' ? player.getPlayerState() : null };
            });
            evidence.before = await sample();
            if (evidence.before.paused && !evidence.before.error) {
                const play = frame.locator('.ytp-large-play-button');
                if (await play.isVisible()) { await play.click(); evidence.manualPlay = true; }
            }
            await page.waitForTimeout(2500);
            evidence.after = await sample();
            evidence.syntheticCookieBlockedReasons = [...blocked];
            await Promise.allSettled(pending);
            console.log(JSON.stringify(evidence));
            await iframe.screenshot({ path: `/private/tmp/atr-tv-audit-${variant.name}.png` });
            assert.equal(evidence.referer, 'https://africatwinriders.sn/');
            assert.equal(evidence.after.error, null);
            assert.equal(evidence.after.paused, false);
            assert.ok(evidence.after.currentTime > evidence.before.currentTime || evidence.manualPlay);
            if (variant.block) assert.ok(blocked.size > 0, 'Cookie blocking must be observed, not just configured');
            await context.close();
        }
    } finally { await browser.close(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
