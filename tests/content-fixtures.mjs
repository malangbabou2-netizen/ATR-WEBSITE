// Synthetic content for isolated tests only; never copied into the project's content/.
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { CMS_COLLECTIONS } from '../cms-content-utils.mjs';
import { buildContentCatalog } from '../scripts/build-cms-content.mjs';
import { buildCatalog } from '../scripts/build-atr-tv.mjs';

export const TEST_COLLECTIONS = [...CMS_COLLECTIONS, 'atr-tv'];
export const TEST_COUNTS = [0, 1, 2, 7];
export const videoFixture = {
    title: 'Vidéo de test locale', summary: 'Résumé local', category: 'events',
    youtube_url: 'https://www.youtube.com/watch?v=eyeOfSerVw0&t=674s',
    featured: false, sort_order: 0, archived: false, image: '/images/IMG_3678.PNG'
};

export function publicationFixture(collection, index, archived = false) {
    const common = { title: `Test local ${collection} ${index}`, summary: `Résumé local ${index}`, archived };
    const dates = { start_date: '2026-10-17', end_date: '2026-10-18' };
    switch (collection) {
        case 'events': return { ...common, ...dates, location: 'Lieu de test', body: '**Description locale**' };
        case 'member-adventures': return { ...common, ...dates, organizer: 'Test local', atr_role_note: 'Initiative personnelle, ATR relais', itinerary: 'Parcours de test' };
        case 'moto-news': return { ...common, publication_date: '2026-10-17', category: 'road-safety', source_name: 'Source de test', original_url: `https://example.org/article-${index}` };
        case 'partner-banners': return { ...dates, archived, partner_name: `Partenaire de test ${index}`, image: '/images/IMG_3678.PNG', image_alt: 'Image de test', destination_url: `https://example.org/banner-${index}`, placement: 'events', active: true, priority: index };
        case 'ride-and-give': return { ...common, date: '2026-10-17', location: 'Lieu de test', body: 'Description locale' };
        case 'atr-tv': return { ...videoFixture, ...common, featured: index % 2 === 0, sort_order: index, category: index % 2 === 0 ? 'events' : 'road-trips' };
        default: throw new Error(`Unknown test collection: ${collection}`);
    }
}

export async function seedPublications(root, count, archivedCount = 2) {
    const expected = {};
    for (const collection of TEST_COLLECTIONS) {
        await mkdir(resolve(root, collection), { recursive: true });
        expected[collection] = [];
        for (let index = 0; index < count + archivedCount; index += 1) {
            const archived = index >= count;
            const slug = `sample-${index}`;
            const data = publicationFixture(collection, index, archived);
            await writeFile(resolve(root, collection, `${slug}.fr.json`), JSON.stringify(data));
            if (!archived) expected[collection].push(slug);
        }
    }
    return expected;
}

export async function fixtureCatalogs(count, archivedCount = 2) {
    const root = await mkdtemp(resolve(tmpdir(), 'atr-publications-fixture-'));
    try {
        const expected = await seedPublications(root, count, archivedCount);
        return { cms: await buildContentCatalog(root), tv: await buildCatalog(resolve(root, 'atr-tv')), expected };
    } finally { await rm(root, { recursive: true, force: true }); }
}
