export const CMS_COLLECTIONS = ['events', 'member-adventures', 'moto-news', 'partner-banners', 'ride-and-give'];

export function dakarDay(date = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Dakar', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date).map(({ type, value }) => [type, value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}

export function dateKey(value) {
    if (!value) return '';
    if (typeof value !== 'string') throw new Error('Invalid date');
    const key = value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(Date.parse(value)) ||
        new Date(`${key}T00:00:00Z`).toISOString().slice(0, 10) !== key) throw new Error('Invalid date');
    // Decap dates represent calendar days in Dakar, irrespective of the reader’s timezone.
    return key;
}

export function contentStatus(entry, today = dakarDay()) {
    const start = dateKey(entry.start_date || entry.date || entry.publication_date);
    const end = dateKey(entry.end_date || entry.start_date || entry.date || entry.publication_date);
    return !start || today < start ? 'upcoming' : today <= end ? 'ongoing' : 'completed';
}

export function visibleContent(entries, collection, today = dakarDay()) {
    return entries.filter((entry) => entry.archived !== true && (
        collection === 'partner-banners' ? entry.active === true && dateKey(entry.start_date) <= today && dateKey(entry.end_date) >= today
        : collection === 'member-adventures' ? contentStatus(entry, today) !== 'completed'
        : collection === 'moto-news' ? dateKey(entry.publication_date) <= today : true
    )).sort((a, b) => {
        if (collection === 'partner-banners') return b.priority - a.priority || a.slug.localeCompare(b.slug);
        if (collection === 'events' || collection === 'member-adventures') {
            const rank = { ongoing: 0, upcoming: 1, completed: 2 };
            const delta = rank[contentStatus(a, today)] - rank[contentStatus(b, today)];
            if (delta) return delta;
        }
        const da = dateKey(a.start_date || a.date || a.publication_date);
        const db = dateKey(b.start_date || b.date || b.publication_date);
        return (contentStatus(a, today) === 'upcoming' ? da.localeCompare(db) : db.localeCompare(da)) || a.slug.localeCompare(b.slug);
    });
}

export function safeContentUrl(value, type = 'link') {
    if (!value) return '';
    if (typeof value !== 'string') throw new Error('Invalid URL');
    if (type === 'link') {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error('HTTPS URL required');
        return url.href;
    }
    let decoded;
    try { decoded = decodeURIComponent(value); } catch { throw new Error('Invalid asset encoding'); }
    if (!/^\/?(?:images|uploads|documents)\//.test(decoded) || /[\\?#\u0000-\u001f]/.test(decoded) ||
        decoded.split('/').some((part) => part === '..' || part === '.') ||
        !(type === 'pdf' ? /\.pdf$/i : /\.(png|jpe?g|webp|gif|avif)$/i).test(decoded)) throw new Error('Invalid local asset');
    return decoded.replace(/^\//, '');
}

// Africa/Dakar is UTC. Date-only legacy values cover the entire last day.
export function bannerBoundary(value, end = false) {
    dateKey(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return Date.parse(`${value}T00:00:00Z`) + (end ? 86400000 : 0);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error('Explicit timezone required');
    const instant = Date.parse(value);
    if (!Number.isFinite(instant)) throw new Error('Invalid banner timestamp');
    return instant;
}

export function heroBanners(entries, now = Date.now()) {
    return entries.filter((entry) => {
        try {
            return entry.placement === 'hero' && entry.active === true && entry.archived !== true &&
                bannerBoundary(entry.start_date) <= now && now < bannerBoundary(entry.end_date, true);
        } catch { return false; }
    }).sort((a, b) => b.priority - a.priority || a.slug.localeCompare(b.slug));
}
