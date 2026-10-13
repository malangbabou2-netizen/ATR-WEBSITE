import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { youtubeVideo, safeImage, visibleVideos } from '../atr-tv-utils.mjs';
import { buildCatalog } from '../scripts/build-atr-tv.mjs';

const fixture = { title: 'Test fixture', category: 'events', youtube_url: 'https://www.youtube.com/watch?v=eyeOfSerVw0&t=674s', featured: true, sort_order: 1, archived: false };
async function withContent(callback) {
    const folder = await mkdtemp(resolve(tmpdir(), 'atr-tv-test-'));
    try { await callback(folder); } finally { await rm(folder, { recursive: true, force: true }); }
}
const save = (folder, name, data) => writeFile(resolve(folder, name), JSON.stringify(data));

test('English title falls back to French and start time is preserved', async () => withContent(async (folder) => {
    await save(folder, 'one.fr.json', fixture);
    const { title, ...shared } = fixture;
    await save(folder, 'one.en.json', shared);
    const video = (await buildCatalog(folder)).videos[0];
    assert.equal(video.translations.fr.title, fixture.title);
    assert.equal(video.translations.en.title, fixture.title);
    assert.equal(new URL(video.embed_url).searchParams.get('start'), '674');
    assert.equal(video.youtube_url, fixture.youtube_url);
    assert.equal(video.featured, true);
    assert.equal(video.category, 'events');
}));

test('new publications are discovered without editing an index, empty collection is supported', async () => withContent(async (folder) => {
    assert.deepEqual((await buildCatalog(folder)).videos, []);
    await save(folder, 'one.fr.json', fixture);
    assert.equal((await buildCatalog(folder)).videos.length, 1);
    await save(folder, 'two.fr.json', { ...fixture, title: 'Second test fixture' });
    assert.equal((await buildCatalog(folder)).videos.length, 2);
}));

test('English fallback is applied per field and archived entries are omitted', async () => withContent(async (folder) => {
    await save(folder, 'one.fr.json', { ...fixture, summary: 'French test summary' });
    await save(folder, 'one.en.json', { ...fixture, title: 'English test title', summary: '' });
    const video = (await buildCatalog(folder)).videos[0];
    assert.equal(video.translations.en.title, 'English test title');
    assert.equal(video.translations.en.summary, 'French test summary');
    await save(folder, 'archived.fr.json', { ...fixture, archived: true });
    assert.equal((await buildCatalog(folder)).videos.length, 1);
}));

test('invalid JSON, missing French content, differing shared fields and invalid categories block generation', async () => withContent(async (folder) => {
    await writeFile(resolve(folder, 'one.fr.json'), '{');
    await assert.rejects(buildCatalog(folder));
    await save(folder, 'one.fr.json', fixture);
    await save(folder, 'one.en.json', { ...fixture, archived: true });
    await assert.rejects(buildCatalog(folder), /shared field mismatch/);
    await save(folder, 'one.en.json', {});
    await save(folder, 'one.fr.json', { ...fixture, category: 'unapproved-category' });
    await assert.rejects(buildCatalog(folder), /Invalid category/);
    await save(folder, 'one.fr.json', { ...fixture, title: '' });
    await assert.rejects(buildCatalog(folder), /Missing French title/);
}));

test('English-only entries cannot publish without their French source', async () => withContent(async (folder) => {
    await save(folder, 'one.en.json', fixture);
    await assert.rejects(buildCatalog(folder), /Missing French title/);
}));

test('featured then order then slug; archived exclusion and category filter', () => {
    const entries = [
        { slug: 'z', featured: false, sort_order: -10, archived: false, category: 'events' },
        { slug: 'c', featured: true, sort_order: 2, archived: false, category: 'events' },
        { slug: 'b', featured: true, sort_order: 1, archived: false, category: 'road-trips' },
        { slug: 'a', featured: true, sort_order: 1, archived: false, category: 'events' },
        { slug: 'hidden', featured: true, sort_order: -20, archived: true, category: 'events' }
    ];
    assert.deepEqual(visibleVideos(entries).map((item) => item.slug), ['a', 'b', 'c', 'z']);
    assert.deepEqual(visibleVideos(entries, 'events').map((item) => item.slug), ['a', 'c', 'z']);
});

test('YouTube URL variants and playback query parameters', () => {
    for (const value of ['https://youtu.be/eyeOfSerVw0?t=11m14s', 'https://www.youtube.com/shorts/eyeOfSerVw0?t=674', 'https://www.youtube.com/embed/eyeOfSerVw0?start=674']) {
        assert.equal(new URL(youtubeVideo(value).embed_url).searchParams.get('start'), '674');
    }
    const url = 'https://www.youtube.com/watch?v=eyeOfSerVw0&t=674s&list=test-list&index=2&end=800&feature=share';
    const parsed = youtubeVideo(url);
    assert.equal(parsed.url, url);
    assert.equal(new URL(parsed.embed_url).searchParams.get('list'), 'test-list');
    assert.equal(new URL(parsed.embed_url).searchParams.get('index'), '2');
    assert.equal(new URL(parsed.embed_url).searchParams.get('end'), '800');
});

test('unsafe URLs and image traversal are refused', () => {
    for (const url of ['javascript:alert(1)', 'https://youtube.com.evil.example/watch?v=eyeOfSerVw0', 'https://user:pass@youtube.com/watch?v=eyeOfSerVw0', 'https://youtube.com/watch?v=invalid', 'https://youtube.com/watch?v=eyeOfSerVw0&t=invalid']) assert.throws(() => youtubeVideo(url));
    for (const path of ['https://evil.example/a.jpg', '/uploads/../secret.jpg', '/uploads/a.svg', '//evil.example/a.png']) assert.throws(() => safeImage(path));
    assert.equal(safeImage('/uploads/image.png'), 'uploads/image.png');
});

test('deployment is restricted to main and PRs cannot deploy', async () => {
    const workflow = await readFile(new URL('../.github/workflows/atr-pages.yml', import.meta.url), 'utf8');
    assert.match(workflow, /deploy:\s+if: github\.ref == 'refs\/heads\/main' && github\.event_name != 'pull_request'/);
    assert.doesNotMatch(workflow, /pull_request_target|contents: write/);
});

test('ATR TV is immediately between events and member adventures in markup and navigation', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const sections = [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map((match) => match[1]);
    const eventsIndex = sections.indexOf('evenements');
    assert.deepEqual(sections.slice(eventsIndex, eventsIndex + 3), ['evenements', 'atr-tv', 'aventures-membres']);
    const nav = html.match(/<nav\b[^>]*id="siteNavigation"[^>]*>([\s\S]*?)<\/nav>/)[1];
    const links = [...nav.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    const navIndex = links.indexOf('#evenements');
    assert.deepEqual(links.slice(navIndex, navIndex + 3), ['#evenements', '#atr-tv', '#aventures-membres']);
});
