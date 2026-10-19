import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { SITE_ORIGIN, renderSitemap, pageMetadata, attributes } from '../scripts/build-sitemap.mjs';

const page = (path, extra = '') => `<html lang="fr"><head><title>Fixture locale</title><meta name="description" content="Fixture"><link href="${SITE_ORIGIN}${path}" rel="canonical">${extra}</head><body></body></html>`;
async function fixture(run) {
    const root = await mkdtemp(resolve(tmpdir(), 'atr-seo-'));
    const save = async (name, html) => { const file = resolve(root, name); await mkdir(dirname(file), { recursive: true }); await writeFile(file, html); };
    try { await save('index.html', page('/')); await run(root, save); } finally { await rm(root, { recursive: true, force: true }); }
}
for (const count of [0, 1, 2, 7]) test(`sitemap discovers ${count} additional published HTML pages without a fixed page count`, () => fixture(async (root, save) => {
    for (let i = 0; i < count; i++) await save(`public-${i}.html`, page(`/public-${i}.html`));
    const xml = await renderSitemap(root);
    assert.equal((xml.match(/<loc>/g) || []).length, count + 1);
    assert.match(xml, /<loc>https:\/\/africatwinriders\.sn\/<\/loc>/);
    assert.doesNotMatch(xml, /lastmod|changefreq|priority/);
}));
test('sitemap excludes admin, drafts, internal files, assets, redirects, noindex and unpublished repository content', () => fixture(async (root, save) => {
    for (const folder of ['admin', 'drafts', 'preview', 'content', 'auth-worker', 'tests', 'docs', 'images', 'uploads', 'documents', '.git']) await save(`${folder}/index.html`, '<html>Never index this fixture</html>');
    await save('404.html', page('/404.html'));
    await save('private.html', page('/private.html', '<META CONTENT="noindex, follow" NAME="ROBOTS"><meta name="robots" content="index">'));
    await save('google-private.html', page('/google-private.html', '<meta name="googlebot" content="none">'));
    await save('redirect.html', page('/redirect.html', '<meta http-equiv="refresh" content="0;url=/">'));
    await save('section/index.html', page('/section/'));
    const xml = await renderSitemap(root);
    assert.deepEqual([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]), [`${SITE_ORIGIN}/`, `${SITE_ORIGIN}/section/`]);
    assert.doesNotMatch(xml, /actualites\.html|admin|private|draft|redirect|404/);
}));
test('sitemap refuses absent, duplicate, wrong-domain or non-self canonicals', () => fixture(async (root, save) => {
    for (const html of ['<html><head></head></html>', page('/other.html'), page('/bad.html').replace(SITE_ORIGIN, 'https://example.org'), page('/bad.html', `<link rel="canonical" href="${SITE_ORIGIN}/bad.html">`)]) {
        await save('bad.html', html); await assert.rejects(renderSitemap(root), /canonical/);
    }
}));
test('homepage SEO, public assets, internal anchors and admin exclusion are consistent', async () => {
    const html = await readFile('index.html', 'utf8');
    const { title, meta, canonicals, noindex } = pageMetadata(html);
    assert.ok(title.includes('Africa Twin Riders Sénégal'));
    assert.ok(meta.description.length > 60 && meta.description.length < 200);
    assert.equal(meta['og:description'], meta.description);
    assert.equal(meta['twitter:description'], meta.description);
    assert.equal(canonicals[0].href, SITE_ORIGIN + '/');
    assert.equal(meta['og:url'], canonicals[0].href);
    assert.equal(meta['og:title'], title);
    assert.equal(meta['og:type'], 'website');
    assert.equal(meta['og:locale'], 'fr_SN');
    assert.equal(meta['og:image:type'], 'image/jpeg');
    assert.equal(meta['twitter:card'], 'summary_large_image');
    assert.equal(noindex, false);
    assert.match(html, /<html lang="fr">/);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, new Set(ids).size);
    for (const match of html.matchAll(/<(?:a|img|script|link|source)\b[^>]*>/gi)) {
        const attrs = attributes(match[0]);
        for (const value of [attrs.href, attrs.src].filter(Boolean)) {
            const url = new URL(value, SITE_ORIGIN + '/');
            if (url.origin !== SITE_ORIGIN) continue;
            if (url.hash && url.pathname === '/') assert.ok(ids.includes(decodeURIComponent(url.hash.slice(1))), value);
            if (url.pathname !== '/') await access(resolve('.' + decodeURIComponent(url.pathname)));
        }
    }
    await access(resolve('.' + new URL(meta['og:image']).pathname));
    const robots = await readFile('robots.txt', 'utf8');
    assert.match(robots, /Sitemap: https:\/\/africatwinriders\.sn\/sitemap\.xml/);
    assert.equal(pageMetadata(await readFile('admin/index.html', 'utf8')).noindex, true);
    assert.doesNotMatch(html, /https?:\/\/[^"\s]*github\.io/);
});

test('confirmed legal information has public metadata and a footer link; privacy draft stays internal', async () => {
    const html = await readFile('mentions-legales.html', 'utf8');
    const home = await readFile('index.html', 'utf8');
    const { title, meta, canonicals, noindex } = pageMetadata(html);
    assert.equal(title, 'Mentions légales | Africa Twin Riders Sénégal');
    assert.equal(canonicals[0].href, SITE_ORIGIN + '/mentions-legales.html');
    assert.equal(meta['og:url'], canonicals[0].href);
    assert.equal(meta['og:title'], title);
    assert.equal(meta['og:description'], meta.description);
    assert.equal(noindex, false);
    for (const text of ['Dénomination juridique : AFRICA TWIN RIDERS.', 'Groupement d’Intérêt Économique (GIE)', 'SN.DKR.2026.C.18070', '013058856', 'Rufisque, Cité Filao, Villa n° 42, Sénégal', 'Président et représentant légal du GIE : Malang Babou', 'Gestionnaire technique du site : Malang Babou', 'samabusinesscom@gmail.com', 'malangbabou2@gmail.com', 'restent soumises à validation avant publication']) assert.ok(html.includes(text));
    assert.doesNotMatch(html, /naissance|signature|data:|\.pdf(?:["?#]|$)/i);
    assert.match(home, /href="mentions-legales.html"/);
    assert.doesNotMatch(home, /href="confidentialite.html"/);
    assert.match(await readFile('sitemap.xml', 'utf8'), /mentions-legales.html/);
});
