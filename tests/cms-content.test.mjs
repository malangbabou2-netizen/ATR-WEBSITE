import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile, readdir, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { buildContentCatalog } from '../scripts/build-cms-content.mjs';
import { stageSite, buildCatalog } from '../scripts/build-atr-tv.mjs';
import { CMS_COLLECTIONS, contentStatus, visibleContent, safeContentUrl, dateKey, dakarDay } from '../cms-content-utils.mjs';
import { TEST_COLLECTIONS, TEST_COUNTS, seedPublications, publicationFixture } from './content-fixtures.mjs';

const fixtures = {
    events: { title: 'Donnée de test locale', summary: 'Résumé français', body: '**Description**', location: 'Lieu de test', start_date: '2026-10-17', end_date: '2026-10-18' },
    'member-adventures': { title: 'Donnée de test locale', summary: 'Résumé', organizer: 'Test', atr_role_note: 'Initiative personnelle', itinerary: 'Parcours de test', start_date: '2026-10-17', end_date: '2026-10-18' },
    'moto-news': { title: 'Donnée de test locale', summary: 'Résumé', publication_date: '2026-10-17', category: 'road-safety', source_name: 'Source de test', original_url: 'https://example.org/article' },
    'partner-banners': { partner_name: 'Test local', image: '/uploads/test.png', image_alt: 'Image de test', destination_url: 'https://example.org/', placement: 'events', start_date: '2026-10-17', end_date: '2026-10-18', active: true, priority: 2 },
    'ride-and-give': { title: 'Donnée de test locale', summary: 'Résumé', date: '2026-10-17', location: 'Lieu de test' }
};
async function temporary(callback) {
    const root = await mkdtemp(resolve(tmpdir(), 'atr-cms-test-'));
    try { await callback(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function save(root, collection, slug, data, lang = 'fr') {
    await mkdir(resolve(root, collection), { recursive: true });
    await writeFile(resolve(root, collection, `${slug}.${lang}.json`), JSON.stringify(data));
}

for (const collection of CMS_COLLECTIONS) test(`${collection}: create, edit, bilingual fallback and archive`, () => temporary(async (root) => {
    assert.equal((await buildContentCatalog(root)).collections[collection].length, 0);
    await save(root, collection, 'fraternité-à-nianing', fixtures[collection]);
    let items = (await buildContentCatalog(root)).collections[collection];
    assert.equal(items.length, 1);
    assert.equal(items[0].slug, 'fraternité-à-nianing');
    assert.deepEqual(items[0].translations.en, items[0].translations.fr);
    await save(root, collection, 'fraternité-à-nianing', { ...fixtures[collection], summary: 'Résumé modifié' });
    await save(root, collection, 'fraternité-à-nianing', { summary: 'English summary' }, 'en');
    items = (await buildContentCatalog(root)).collections[collection];
    assert.equal(items.length, 1);
    assert.equal(items[0].translations.fr.summary, 'Résumé modifié');
    assert.equal(items[0].translations.en.summary, 'English summary');
    await save(root, collection, 'fraternité-à-nianing', { ...fixtures[collection], archived: true });
    assert.equal((await buildContentCatalog(root)).collections[collection].length, 0);
}));

test('published event catalog preserves every eligible French source without assuming its size', async () => {
    const catalog = await buildContentCatalog(resolve('content'));
    const expected = new Map();
    for (const name of await readdir(resolve('content/events'))) {
        if (!name.endsWith('.fr.json')) continue;
        const source = JSON.parse(await readFile(resolve('content/events', name), 'utf8'));
        const englishName = name.replace(/\.fr\.json$/, '.en.json');
        let english = {};
        try { english = JSON.parse(await readFile(resolve('content/events', englishName), 'utf8')); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        if (source.archived === true || /TEST INTERNE ATR\s*[—–-]\s*NE PAS PUBLIER/i.test(`${source.title || ''} ${english.title || ''}`)) continue;
        expected.set(name.slice(0, -'.fr.json'.length), source);
    }
    assert.deepEqual(catalog.collections.events.map((entry) => entry.slug).sort(), [...expected.keys()].sort());
    for (const entry of catalog.collections.events) {
        const source = expected.get(entry.slug);
        assert.equal(entry.translations.fr.title, source.title);
        assert.equal(entry.translations.fr.body, source.body || '');
        for (const key of ['start_date', 'end_date', 'location']) assert.equal(entry[key], source[key]);
    }
});

test('forbidden internal test never enters catalog, even if accidentally unarchived', () => temporary(async (root) => {
    await save(root, 'events', 'internal', { ...fixtures.events, title: 'TEST INTERNE ATR — NE PAS PUBLIER' });
    assert.equal((await buildContentCatalog(root)).collections.events.length, 0);
}));

test('French dates remain authoritative when historical English copies are stale', () => temporary(async (root) => {
    await save(root, 'events', 'one', fixtures.events);
    await save(root, 'events', 'one', { start_date: '2026-10-16' }, 'en');
    assert.equal((await buildContentCatalog(root)).collections.events[0].start_date, fixtures.events.start_date);
}));

test('Dakar boundaries, adventure expiration, banner scheduling and future news', () => {
    assert.equal(dakarDay(new Date('2026-10-18T23:59:59Z')), '2026-10-18');
    assert.equal(contentStatus(fixtures.events, '2026-10-16'), 'upcoming');
    assert.equal(contentStatus(fixtures.events, '2026-10-17'), 'ongoing');
    assert.equal(contentStatus(fixtures.events, '2026-10-18'), 'ongoing');
    assert.equal(contentStatus(fixtures.events, '2026-10-19'), 'completed');
    const entry = { ...fixtures['member-adventures'], slug: 'one' };
    assert.equal(visibleContent([entry], 'member-adventures', '2026-10-18').length, 1);
    assert.equal(visibleContent([entry], 'member-adventures', '2026-10-19').length, 0);
    assert.equal(visibleContent([{ ...fixtures['partner-banners'], slug: 'one' }], 'partner-banners', '2026-10-18').length, 1);
    assert.equal(visibleContent([{ ...fixtures['partner-banners'], slug: 'one' }], 'partner-banners', '2026-10-19').length, 0);
    assert.equal(visibleContent([{ ...fixtures['moto-news'], slug: 'one' }], 'moto-news', '2026-10-16').length, 0);
});

test('ordering is ongoing, upcoming, completed; recent history first', () => {
    const make = (slug, start_date) => ({ slug, start_date, end_date: start_date });
    assert.deepEqual(visibleContent([make('old', '2026-01-01'), make('future', '2026-11-01'), make('now', '2026-10-17'), make('recent', '2026-10-16')], 'events', '2026-10-17').map((item) => item.slug), ['now', 'future', 'recent', 'old']);
});

test('unsafe paths, dates and URLs are rejected', () => {
    for (const value of ['javascript:alert(1)', 'http://example.org', 'https://user:pass@example.org']) assert.throws(() => safeContentUrl(value));
    for (const value of ['/uploads/%2e%2e/secret.png', '/uploads/a.svg', '/uploads/../secret.png']) assert.throws(() => safeContentUrl(value, 'image'));
    assert.equal(safeContentUrl('/documents/Roadbook%20J%20E%20E%20Y.pdf', 'pdf'), 'documents/Roadbook J E E Y.pdf');
    assert.throws(() => dateKey('2026-02-30'));
});

test('duplicate CMS entries block publication instead of producing duplicate cards', () => temporary(async (root) => {
    await save(root, 'events', 'one', fixtures.events);
    await save(root, 'events', 'two', fixtures.events);
    await assert.rejects(buildContentCatalog(root), /Duplicate CMS content/);
}));

test('artifact contains both catalogs and all public dependencies, excludes internal data, and removes stale files', async () => {
    const output = resolve('_site-cms-test');
    try {
        const catalog = await buildCatalog(resolve('content/atr-tv'));
        await stageSite(output, catalog);
        for (const file of ['index.html', 'mentions-legales.html', 'style.css', 'script.js', 'translations.js', 'atr-tv.js', 'atr-tv-utils.mjs', 'cms-content.js', 'cms-content-utils.mjs', 'admin/config.yml', 'admin/index.html', 'CNAME', 'robots.txt', 'sitemap.xml', 'images/IMG_3677.PNG', 'images/IMG_3678.PNG', 'images/hero-ATR.jpg', 'images/Octobre rose, ride and give.png', 'documents/CAMP ATR 2026 NIANING.pdf', 'documents/roadbooks/Roadbook J E E Y.pdf']) {
            assert.deepEqual(await readFile(resolve(output, file)), await readFile(file), file);
        }
        for (const file of ['content/events/any.fr.json', 'auth-worker/src/index.js', 'AGENTS.md', '.DS_Store', '.git/config']) await assert.rejects(readFile(resolve(output, file)), { code: 'ENOENT' });
        assert.deepEqual(JSON.parse(await readFile(resolve(output, 'atr-tv-catalog.json'), 'utf8')), catalog);
        assert.deepEqual(JSON.parse(await readFile(resolve(output, 'cms-content-catalog.json'), 'utf8')), await buildContentCatalog(resolve('content')));
        await writeFile(resolve(output, 'stale-private-file.txt'), 'local fixture');
        await stageSite(output, catalog);
        await assert.rejects(readFile(resolve(output, 'stale-private-file.txt')), { code: 'ENOENT' });
        await assert.rejects(stageSite(resolve('images'), catalog), /Use _site/);
    } finally { await rm(output, { recursive: true, force: true }); }
});

for (const count of TEST_COUNTS) test(`full site generation: ${count} active publications per collection plus archives`, () => temporary(async (root) => {
    // Run the real CLI from a disposable repository. No test content is written to the real project.
    const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
    for (const file of tracked) {
        if (file.startsWith('content/')) continue;
        const target = resolve(root, file);
        await mkdir(dirname(target), { recursive: true });
        await copyFile(resolve(file), target);
    }
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    const contentRoot = resolve(root, 'content');
    const expected = await seedPublications(contentRoot, count);
    execFileSync('git', ['add', '--', 'index.html', 'style.css', 'script.js', 'translations.js', 'atr-tv.js', 'atr-tv-utils.mjs', 'cms-content.js', 'cms-content-utils.mjs', 'robots.txt', 'sitemap.xml', 'CNAME', 'images', 'documents', 'admin', 'content'], { cwd: root });
    const output = resolve(root, '_site');
    const build = async () => {
        execFileSync(process.execPath, ['scripts/build-atr-tv.mjs', '--site-dir', '_site'], { cwd: root, encoding: 'utf8' });
        const cms = JSON.parse(await readFile(resolve(output, 'cms-content-catalog.json'), 'utf8'));
        const tv = JSON.parse(await readFile(resolve(output, 'atr-tv-catalog.json'), 'utf8'));
        for (const collection of TEST_COLLECTIONS) {
            const items = collection === 'atr-tv' ? tv.videos : cms.collections[collection];
            assert.deepEqual(items.map((item) => item.slug).sort(), [...expected[collection]].sort(), collection);
            assert.equal(new Set(items.map((item) => item.slug)).size, items.length, `No duplicates in ${collection}`);
            assert.ok(items.every((item) => item.archived === false), `No archives in ${collection}`);
        }
        assert.equal(await readFile(resolve(output, 'index.html'), 'utf8'), await readFile('index.html', 'utf8'));
        return { cms, tv };
    };
    await build();
    if (count) {
        for (const collection of TEST_COLLECTIONS) {
            const file = resolve(contentRoot, collection, 'sample-0.fr.json');
            const updated = { ...publicationFixture(collection, 0), summary: 'Résumé modifié localement' };
            await writeFile(file, JSON.stringify(updated));
        }
        const edited = await build();
        for (const collection of TEST_COLLECTIONS) {
            const items = collection === 'atr-tv' ? edited.tv.videos : edited.cms.collections[collection];
            assert.equal(items.find((item) => item.slug === 'sample-0').translations.fr.summary, 'Résumé modifié localement');
            for (let index = 0; index < count; index += 1) {
                await writeFile(resolve(contentRoot, collection, `sample-${index}.fr.json`), JSON.stringify(publicationFixture(collection, index, true)));
            }
            expected[collection] = [];
        }
        await build(); // All archived: both catalogs remain valid and every collection is empty.
    }
}));

test('public integration preserves original forms, legacy sections and Hero timer', async () => {
    const html = await readFile('index.html', 'utf8');
    for (const endpoint of ['xjygyraa', 'xljgjwpe']) assert.ok(html.includes(`https://formspree.io/f/${endpoint}`));
    for (const text of ['2ᵉ CAMP ATR 2026 — NIANING', 'CAMP%20ATR%202026%20NIANING.pdf', 'jeey-trip-title', 'hero-campaign-actions']) assert.ok(html.includes(text));
    const script = await readFile('script.js', 'utf8');
    assert.ok(script.includes('getDakarMidnightTimestamp(2026, 11, 1)'));
    const build = await readFile('scripts/build-atr-tv.mjs', 'utf8');
    assert.ok(!/const publicFolders = .*'content\/'/.test(build));
});

test('Safety Day is a single completed historical activity; official Instagram is configured securely', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
    const [completed, upcoming] = html.split('ACTIVITÉS RÉALISÉES')[1].split('ACTIVITÉS À VENIR');
    assert.equal((html.match(/<h3>ATR Safety Day<\/h3>/g) || []).length, 1);
    assert.match(completed, /<strong>17<\/strong>\s*<span>OCTOBRE 2026<\/span>[\s\S]*<h3>ATR Safety Day<\/h3>\s*<p>\s*<strong>RÉALISÉ<\/strong><br>\s*Sécurité routière, dans le cadre du Camp ATR 2\.[\s\S]*Nianing, Sénégal/);
    assert.doesNotMatch(upcoming, /<h3>ATR Safety Day<\/h3>/);
    assert.match(script, /instagram: 'https:\/\/www\.instagram\.com\/africatwin221\/'/);
    assert.match(script, /youtube: ''/);
    assert.match(script, /facebook: ''/);
    assert.match(html, /href="https:\/\/www\.instagram\.com\/africatwin221\/" target="_blank" rel="noopener noreferrer"/);
});


test('Nianing camp appears once in completed history with its original proposed programme', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const [completed, upcoming] = html.split('ACTIVITÉS RÉALISÉES')[1].split('ACTIVITÉS À VENIR');
    const title = '<h3>2ᵉ CAMP ATR 2026 — NIANING</h3>';
    assert.equal(html.split(title).length - 1, 1);
    assert.ok(completed.includes(title));
    assert.ok(!upcoming.includes(title));
    const camp = completed.match(/<article class="event-item event-item-expandable">[\s\S]*?<\/article>/)[0];
    assert.match(camp, /<strong>16–18<\/strong>\s*<span>OCTOBRE 2026<\/span>/);
    assert.match(camp, /RÉALISÉ · PROGRAMME PROPOSÉ ARCHIVÉ/);
    assert.doesNotMatch(camp, /À VENIR/);
    for (const text of ['Nianing', 'Vendredi 16 octobre', 'Samedi 17 octobre', 'Dimanche 18 octobre', 'ne constituent pas un compte rendu', 'documents/CAMP%20ATR%202026%20NIANING.pdf']) assert.ok(camp.includes(text));
});
