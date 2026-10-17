import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CMS_COLLECTIONS, dateKey, safeContentUrl } from '../cms-content-utils.mjs';

const localized = ['title', 'summary', 'body', 'image_alt', 'objectives', 'program', 'atr_role_note', 'itinerary', 'practical_information', 'photos'];
const required = {
    events: ['title', 'summary', 'start_date', 'end_date', 'location'],
    'member-adventures': ['title', 'summary', 'organizer', 'atr_role_note', 'start_date', 'end_date', 'itinerary'],
    'moto-news': ['title', 'summary', 'publication_date', 'category', 'source_name', 'original_url'],
    'partner-banners': ['partner_name', 'image', 'image_alt', 'destination_url', 'placement', 'start_date', 'end_date'],
    'ride-and-give': ['title', 'summary', 'date', 'location']
};
const categories = ['motogp', 'rally-raid', 'trade-shows', 'new-models', 'manufacturers', 'road-safety', 'african-motorcycle-events'];
const placements = ['home-after-hero', 'events', 'atr-tv', 'moto-news'];
const blockedTest = /TEST INTERNE ATR\s*[—–-]\s*NE PAS PUBLIER/i;

export async function buildContentCatalog(root) {
    const collections = {};
    for (const collection of CMS_COLLECTIONS) {
        const folder = resolve(root, collection);
        let names;
        try { names = await readdir(folder); } catch (error) { if (error.code !== 'ENOENT') throw error; names = []; }
        const groups = new Map();
        for (const name of names.sort()) {
            if (!name.endsWith('.json')) continue;
            const match = /^([^/\\]+)\.(fr|en)\.json$/u.exec(name);
            if (!match || match[1].startsWith('.')) throw new Error(`Invalid CMS filename: ${name}`);
            const entry = JSON.parse(await readFile(resolve(folder, name), 'utf8'));
            if (!entry || Array.isArray(entry) || typeof entry !== 'object') throw new Error(`Invalid CMS object: ${name}`);
            const group = groups.get(match[1]) || {};
            group[match[2]] = entry;
            groups.set(match[1], group);
        }
        collections[collection] = [];
        const identities = new Set();
        for (const [slug, { fr, en = {} }] of groups) {
            if (!fr) throw new Error(`Missing French content: ${collection}/${slug}`);
            // Explicitly exclude the forbidden internal test, including any English translation.
            if (blockedTest.test(`${fr.title || ''} ${en.title || ''}`) || fr.archived === true) continue;
            if (fr.archived !== undefined && typeof fr.archived !== 'boolean') throw new Error(`Invalid archive flag: ${slug}`);
            for (const field of required[collection]) {
                if (typeof fr[field] !== 'string' || !fr[field].trim()) throw new Error(`Missing ${collection}/${slug}/${field}`);
            }
            // French is authoritative, matching the current CMS locale. Historical English
            // copies must not prevent publication after a French-only edit.
            const entry = { slug, archived: false, translations: {} };
            for (const [key, value] of Object.entries(fr)) {
                if (!localized.includes(key) && key !== 'slug' && key !== 'translations') entry[key] = value;
            }
            for (const lang of ['fr', 'en']) {
                entry.translations[lang] = {};
                for (const field of localized) {
                    const fallback = fr[field] ?? (['objectives', 'program', 'photos'].includes(field) ? [] : '');
                    const candidate = lang === 'en' ? en[field] : fallback;
                    const value = candidate === undefined || candidate === '' || (Array.isArray(candidate) && !candidate.length) ? fallback : candidate;
                    if (['objectives', 'program', 'photos'].includes(field)) {
                        if (!Array.isArray(value)) throw new Error(`Invalid list: ${slug}/${field}`);
                        for (const item of value) {
                            if (field === 'objectives' ? typeof item !== 'string' : !item || typeof item !== 'object' ||
                                (field === 'program' ? typeof item.heading !== 'string' || typeof item.details !== 'string' : typeof item.image !== 'string' || typeof item.alt !== 'string')) throw new Error(`Invalid list item: ${slug}/${field}`);
                            if (field === 'photos') safeContentUrl(item.image, 'image');
                        }
                    } else if (typeof value !== 'string') throw new Error(`Invalid text: ${slug}/${field}`);
                    entry.translations[lang][field] = value;
                }
            }
            for (const key of ['start_date', 'end_date', 'date', 'publication_date']) if (entry[key]) dateKey(entry[key]);
            if (entry.end_date && dateKey(entry.end_date) < dateKey(entry.start_date)) throw new Error(`End before start: ${slug}`);
            for (const key of ['image', 'document', 'roadbook']) if (entry[key]) entry[key] = safeContentUrl(entry[key], key === 'image' ? 'image' : 'pdf');
            for (const key of ['destination_url', 'original_url']) if (entry[key]) entry[key] = safeContentUrl(entry[key]);
            if (collection === 'moto-news' && !categories.includes(entry.category)) throw new Error(`Invalid news category: ${slug}`);
            if (collection === 'partner-banners' && (!placements.includes(entry.placement) || typeof entry.active !== 'boolean' || !Number.isSafeInteger(entry.priority))) throw new Error(`Invalid banner settings: ${slug}`);
            const identity = JSON.stringify([String(fr.title || fr.partner_name).normalize('NFC').trim().toLocaleLowerCase('fr'),
                dateKey(fr.start_date || fr.date || fr.publication_date), dateKey(fr.end_date), fr.location || '', fr.placement || '']);
            if (identities.has(identity)) throw new Error(`Duplicate CMS content: ${collection}/${slug}`);
            identities.add(identity);
            collections[collection].push(entry);
        }
    }
    return { version: 1, collections };
}

export async function writeContentCatalog(root, output) {
    const catalog = await buildContentCatalog(root);
    await writeFile(output, `${JSON.stringify(catalog, null, 2)}\n`);
    return catalog;
}
