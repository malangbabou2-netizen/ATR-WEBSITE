import { CMS_COLLECTIONS, visibleContent, contentStatus, dateKey, dakarDay, safeContentUrl } from './cms-content-utils.mjs';

const labels = {
    fr: { events: 'Articles et événements publiés', 'member-adventures': 'Aventures publiées', 'moto-news': 'Actualités moto', 'ride-and-give': 'Actions publiées', details: 'Lire la suite', pdf: 'Consulter le PDF', upcoming: 'À venir', ongoing: 'En cours', completed: 'Terminée', loading: 'Chargement des publications…', error: 'Les publications ne peuvent pas être chargées actuellement.', source: 'Source', ad: 'Publicité', objectives: 'Objectifs', program: 'Programme', article: 'Article', next: 'Publicité suivante' },
    en: { events: 'Published articles and events', 'member-adventures': 'Published adventures', 'moto-news': 'Motorcycle news', 'ride-and-give': 'Published actions', details: 'Read more', pdf: 'View PDF', upcoming: 'Upcoming', ongoing: 'Ongoing', completed: 'Completed', loading: 'Loading publications…', error: 'Publications cannot be loaded right now.', source: 'Source', ad: 'Advertisement', objectives: 'Objectives', program: 'Programme', article: 'Article', next: 'Next advertisement' }
};
const language = () => document.documentElement.lang === 'en' ? 'en' : 'fr';
const node = (tag, className = '', text = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
};
function translated(entry) { return entry.translations[language()] || entry.translations.fr; }
function asset(value, type) { return new URL(safeContentUrl(value, type), document.baseURI).href; }
function link(value, text, type = 'link') {
    const anchor = node('a', 'cms-link', text);
    anchor.href = type === 'link' ? safeContentUrl(value) : asset(value, type);
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    if (type === 'pdf') anchor.type = 'application/pdf';
    return anchor;
}
function picture(value, alt) {
    const image = node('img', 'cms-image');
    image.alt = alt || '';
    image.src = asset(value, 'image');
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => image.remove(), { once: true });
    return image;
}
// Render a deliberately small Markdown subset with DOM nodes only. Raw HTML is never interpreted.
function inline(parent, text) {
    const pattern = /(\*\*([^*]+)\*\*|\[([^\]]+)\]\((https:\/\/[^\s)]+)\))/g;
    let position = 0;
    for (const match of text.matchAll(pattern)) {
        parent.append(document.createTextNode(text.slice(position, match.index)));
        if (match[2]) parent.append(node('strong', '', match[2]));
        else { try { parent.append(link(match[4], match[3])); } catch { parent.append(document.createTextNode(match[3])); } }
        position = match.index + match[0].length;
    }
    parent.append(document.createTextNode(text.slice(position)));
}
function markdown(parent, text) {
    let list;
    for (const line of (text || '').split(/\r?\n/)) {
        if (!line.trim()) { list = null; continue; }
        if (/^\\+$/.test(line.trim())) { list = null; continue; }
        const item = /^\s*[-*]\s+(.+)/.exec(line);
        if (item) {
            if (!list) { list = node('ul'); parent.append(list); }
            const li = node('li'); inline(li, item[1]); list.append(li);
        } else {
            list = null;
            const heading = /^#{1,6}\s+(.+)/.exec(line);
            const block = node(heading ? 'h4' : 'p'); inline(block, heading?.[1] || line); parent.append(block);
        }
    }
}
function formatDate(value) {
    if (!value) return '';
    return new Intl.DateTimeFormat(language() === 'fr' ? 'fr-SN' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Dakar' }).format(new Date(`${dateKey(value)}T12:00:00Z`));
}
function card(entry, collection) {
    const words = labels[language()], text = translated(entry);
    const article = node('article', 'event-item event-item-expandable cms-card');
    article.dataset.cmsSlug = entry.slug;
    article.id = `cms-${collection}-${entry.slug}`;
    const date = node('div', 'event-date cms-date');
    const dates = [entry.start_date || entry.date || entry.publication_date, entry.end_date].filter(Boolean);
    for (const value of [...new Set(dates)]) { const time = node('time', '', formatDate(value)); time.dateTime = dateKey(value); date.append(time); }
    const copy = node('div', 'event-info');
    if (collection === 'events') copy.append(node('span', 'section-label', words.article));
    copy.append(node('h3', '', text.title));
    copy.append(node('p', 'cms-status', words[contentStatus(entry)]));
    if (entry.category) copy.append(node('p', 'cms-category', categoryLabel(entry.category)));
    copy.append(node('p', '', text.summary));
    if (entry.organizer) copy.append(node('p', '', entry.organizer));
    if (text.atr_role_note) copy.append(node('p', '', text.atr_role_note));
    article.append(date, copy, node('div', 'event-location', entry.location || ''));
    if (entry.image) copy.prepend(picture(entry.image, text.image_alt));
    const hasDetails = text.body || text.itinerary || text.practical_information || text.objectives.length || text.program.length || text.photos.length || entry.document || entry.roadbook;
    if (hasDetails) {
        const details = node('details', 'event-details');
        details.append(node('summary', '', words.details));
        const body = node('div', 'event-details-content cms-body');
        for (const value of [text.body, text.itinerary, text.practical_information]) markdown(body, value);
        if (text.objectives.length) {
            body.append(node('h4', '', words.objectives)); const list = node('ul');
            for (const objective of text.objectives) { const li = node('li'); inline(li, objective); list.append(li); } body.append(list);
        }
        if (text.program.length) {
            body.append(node('h4', '', words.program));
            for (const day of text.program) { body.append(node('h4', '', day.heading)); markdown(body, day.details); }
        }
        for (const photo of text.photos) body.append(picture(photo.image, photo.alt));
        for (const value of [entry.document, entry.roadbook].filter(Boolean)) body.append(link(value, words.pdf, 'pdf'));
        details.append(body); article.append(details);
    }
    if (entry.original_url) copy.append(link(entry.original_url, `${words.source} : ${entry.source_name}`));
    return article;
}
const newsCategories = {
    fr: ['MotoGP', 'Rallye-Raid', 'Salons internationaux', 'Nouveaux modèles', 'Équipementiers', 'Sécurité routière', 'Événements motocyclistes africains'],
    en: ['MotoGP', 'Rally raid', 'International trade shows', 'New models', 'Manufacturers', 'Road safety', 'African motorcycle events']
};
function categoryLabel(category) {
    const i = ['motogp', 'rally-raid', 'trade-shows', 'new-models', 'manufacturers', 'road-safety', 'african-motorcycle-events'].indexOf(category);
    return newsCategories[language()][i] || category;
}
let catalog;
const bannerPositions = new Map();
function render() {
    if (!catalog) return;
    for (const collection of CMS_COLLECTIONS.filter((name) => name !== 'partner-banners')) {
        const host = document.querySelector(`[data-cms-collection="${collection}"]`);
        if (!host) continue;
        const open = new Set([...host.querySelectorAll('details[open]')].map((details) => details.closest('[data-cms-slug]').dataset.cmsSlug));
        const entries = visibleContent(catalog.collections[collection], collection);
        host.replaceChildren();
        host.hidden = entries.length === 0;
        if (!entries.length) continue;
        host.append(node('h3', 'cms-heading', labels[language()][collection]));
        const list = node('div', 'event-list');
        for (const entry of entries) {
            const article = card(entry, collection);
            if (open.has(entry.slug)) article.querySelector('details')?.setAttribute('open', '');
            list.append(article);
        }
        host.append(list);
    }
    const activeAdventures = visibleContent(catalog.collections['member-adventures'], 'member-adventures').length;
    const legacyActive = document.querySelector('#memberAdventureList [data-adventure]');
    const empty = document.querySelector('#adventureEmptyState');
    if (empty) empty.hidden = Boolean(activeAdventures || legacyActive);
    document.querySelectorAll('.adventure-proposal-toggle').forEach((toggle) => {
        toggle.hidden = !activeAdventures && !legacyActive && toggle.closest('.section-heading') !== null;
    });
    for (const slot of document.querySelectorAll('[data-cms-placement]')) {
        const entries = visibleContent(catalog.collections['partner-banners'], 'partner-banners').filter((entry) => entry.placement === slot.dataset.cmsPlacement);
        slot.replaceChildren(); slot.hidden = entries.length === 0;
        if (!entries.length) continue;
        const position = (bannerPositions.get(slot.dataset.cmsPlacement) || 0) % entries.length;
        const entry = entries[position];
        const anchor = link(entry.destination_url, '');
        anchor.rel = 'sponsored noopener noreferrer';
        anchor.append(picture(entry.image, translated(entry).image_alt));
        slot.append(node('p', 'section-label', `${labels[language()].ad} — ${entry.partner_name}`), anchor);
        if (entries.length > 1) {
            const next = node('button', 'btn btn-secondary', labels[language()].next); next.type = 'button';
            next.addEventListener('click', () => { bannerPositions.set(slot.dataset.cmsPlacement, position + 1); render(); });
            slot.append(next);
        }
    }
    const strip = document.querySelector('#cmsNewsStrip');
    if (strip) {
        strip.setAttribute('aria-label', labels[language()]['moto-news']);
        const news = visibleContent(catalog.collections['moto-news'], 'moto-news').slice(0, 5);
        strip.hidden = !news.length; strip.replaceChildren();
        for (const entry of news) strip.append(link(entry.original_url, translated(entry).title));
    }
    document.querySelector('#actualites-moto')?.setAttribute('aria-label', labels[language()]['moto-news']);
}
async function load() {
    const state = document.querySelector('#cmsContentState');
    state.textContent = labels[language()].loading;
    try {
        const response = await fetch(new URL('cms-content-catalog.json', import.meta.url), { cache: 'no-cache', signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`CMS catalog HTTP ${response.status}`);
        const data = await response.json();
        if (data?.version !== 1 || !CMS_COLLECTIONS.every((name) => Array.isArray(data.collections?.[name]))) throw new Error('Invalid CMS catalog');
        catalog = data; state.hidden = true; render();
    } catch {
        state.textContent = labels[language()].error;
        state.dataset.error = 'true';
    }
}
document.addEventListener('atr:languagechange', () => {
    const state = document.querySelector('#cmsContentState');
    if (state?.dataset.error) state.textContent = labels[language()].error;
    render();
});
// Dakar uses UTC throughout the year. Recompute at its next calendar midnight.
function scheduleDayChange() {
    const nextMidnight = Date.parse(`${dakarDay()}T00:00:00Z`) + 86400000;
    setTimeout(() => { render(); scheduleDayChange(); }, Math.max(1, nextMidnight - Date.now()));
}
scheduleDayChange();
document.addEventListener('visibilitychange', render);
load();
