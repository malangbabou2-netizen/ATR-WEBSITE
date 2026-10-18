import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { posix, resolve } from 'node:path';
import { buildCatalog, stageSite } from '../scripts/build-atr-tv.mjs';
import { patchDecap, UPSTREAM_SHA256, VENDOR_FILE, ANCHOR, INSERTION, SOURCE_MAP_REFERENCE } from '../scripts/prepare-decap-media.mjs';

const vendor = await readFile(new URL(`../${VENDOR_FILE}`, import.meta.url), 'utf8');
const original = vendor.replace(INSERTION, '') + SOURCE_MAP_REFERENCE;
const extract = (source) => {
    const start = source.indexOf(ANCHOR);
    const end = source.indexOf('Hc.cache=new WeakMap;', start);
    assert.ok(start >= 0 && end > start);
    return source.slice(start, end);
};
const empty = { url: 'blob:empty' };
const absolute = (path) => /^(?:[a-z]+:)?\/\/|^\//i.test(path);

function harness(source = vendor, { config = {}, collection = {}, field = {}, medias = {} } = {}) {
    const state = { config: { media_folder: 'uploads', public_folder: '/uploads', ...config }, medias };
    const mediaFolder = (config, collection, _entry, field) => field.media_folder || collection.media_folder || config.media_folder;
    const publicPath = (config, collection, path, _entry, field) => posix.join(field.public_folder || collection.public_folder || config.public_folder, posix.basename(path));
    const actions = [];
    const getAsset = new Script(`(${extract(source)})`).runInNewContext({
        qc: empty, $o: absolute, aa: posix, Vo: posix.basename,
        ih: mediaFolder, ah: publicPath,
        oh: (config, collection, entry, path, field) => absolute(path) ? path : posix.join(mediaFolder(config, collection, entry, field), posix.basename(path)),
        Ba: (asset) => asset, zc: (payload) => ({ type: 'ADD_ASSET', payload })
    });
    return { actions, get: (path) => getAsset({ collection, entry: {}, path, field })((action) => actions.push(action), () => state) };
}

test('exact shipped bundle is reproducible from the pinned upstream script and contains one functional patch', async () => {
    assert.equal(createHash('sha256').update(original).digest('hex'), UPSTREAM_SHA256);
    assert.equal(patchDecap(original), vendor);
    assert.equal(vendor.split(INSERTION).length, 2);
    assert.ok(vendor.includes(ANCHOR));
    assert.throws(() => patchDecap(original + ' '), /hash/);
    assert.throws(() => patchDecap(vendor), /hash/);
    const html = await readFile('admin/index.html', 'utf8');
    assert.ok(html.includes('vendor/decap-cms-3.16.3-atr.1.js'));
    assert.ok(html.includes(`integrity="sha384-${createHash('sha384').update(vendor).digest('base64')}"`));
});

test('reproduces the 3.16.3 public-URL bug and fixes new draft uploads without publishing', () => {
    const draft = { path: 'uploads/new.png', url: 'blob:local-draft' };
    const options = { medias: { 'uploads/new.png': { asset: draft } } };
    assert.equal(harness(original, options).get('/uploads/new.png').url, '/uploads/new.png');
    const fixed = harness(vendor, options);
    assert.equal(fixed.get('/uploads/new.png'), draft);
    assert.deepEqual(fixed.actions, []); // No write, public alias or network fallback.
});

test('reopened unpublished assets and mobile images use their existing private preview', () => {
    for (const name of ['main.png', 'mobile.png', 'bannière camp.png', 'camp-a\u0300-ni aning.png']) {
        const draft = { path: `uploads/${name}`, url: `blob:${name}` };
        assert.equal(harness(vendor, { medias: { [draft.path]: { asset: draft } } }).get(`/uploads/${name}`), draft);
    }
});

test('a draft asset takes priority over an earlier cached public 404', () => {
    const draft = { path: 'uploads/new.png', url: 'blob:new' };
    assert.equal(harness(vendor, { medias: { 'uploads/new.png': { asset: draft }, '/uploads/new.png': { asset: { url: '/uploads/new.png' } } } }).get('/uploads/new.png'), draft);
});

test('published images, external URLs and unrelated root-relative paths keep upstream behavior', () => {
    const options = { medias: { 'uploads/new.png': { asset: { url: 'blob:new' } } } };
    for (const path of ['/uploads/published.png', '/images/new.png', '//example.org/new.png', 'https://example.org/new.png', '/uploads/subfolder/new.png', '/uploads/../new.png']) {
        assert.equal(harness(vendor, options).get(path).url, harness(original, options).get(path).url, path);
    }
    const cached = { url: '/uploads/published.png' };
    assert.equal(harness(vendor, { medias: { '/uploads/published.png': { asset: cached } } }).get('/uploads/published.png'), cached);
    assert.equal(harness().get(''), empty);
});

test('existing relative cache lookups and collection/field-specific folders remain supported', () => {
    const asset = { url: 'blob:relative' };
    assert.equal(harness(vendor, { medias: { 'uploads/relative.png': { asset } } }).get('relative.png'), asset);
    const folders = { media_folder: 'uploads/partners', public_folder: '/uploads/partners' };
    for (const owner of ['collection', 'field']) {
        assert.equal(harness(vendor, { [owner]: folders, medias: { 'uploads/partners/banner.png': { asset } } }).get('/uploads/partners/banner.png'), asset);
    }
});

test('editorial workflow, media paths and GitHub authorization configuration are unchanged', async () => {
    const config = await readFile('admin/config.yml', 'utf8');
    for (const setting of ['publish_mode: editorial_workflow', 'media_folder: uploads', 'public_folder: /uploads', 'open_authoring: true', 'branch: main', 'base_url: https://atr-cms-auth.malangbabou2.workers.dev']) assert.ok(config.includes(setting));
    assert.ok(await readFile('admin/vendor/LICENSE.decap-cms', 'utf8'));
    assert.ok(await readFile('admin/vendor/decap-cms.js.LICENSE.txt', 'utf8'));
});

test('the Pages artifact includes the pinned admin dependency with matching integrity and licenses', async () => {
    const output = resolve('_site-decap-test');
    try {
        await stageSite(output, await buildCatalog(resolve('content/atr-tv')));
        for (const file of ['admin/index.html', 'admin/config.yml', VENDOR_FILE, 'admin/vendor/LICENSE.decap-cms', 'admin/vendor/decap-cms.js.LICENSE.txt']) {
            assert.deepEqual(await readFile(resolve(output, file)), await readFile(file), file);
        }
    } finally { await rm(output, { recursive: true, force: true }); }
});
