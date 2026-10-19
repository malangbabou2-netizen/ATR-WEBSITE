const DAY = 86400000;

export function validCatalog(data, now = Date.now()) {
    if (data?.version !== 1 || !Array.isArray(data.items)) throw new Error('Catalogue invalide');
    const seen = new Set();
    const items = data.items.slice(0, 60).filter(item => {
        try {
            const url = new URL(item.url);
            const date = Date.parse(item.published_at);
            if (url.protocol !== 'https:' || url.username || url.password || !Number.isFinite(date) || date > now + 3600000 || now - date > 30 * DAY) return false;
            if (!['title', 'summary', 'source', 'source_id'].every(key => typeof item[key] === 'string' && item[key].trim()) || item.language !== 'fr') return false;
            if (seen.has(url.href)) return false;
            seen.add(url.href);
            return true;
        } catch { return false; }
    });
    return { ...data, items };
}

async function loadCatalog() {
    for (const [url, fallback] of [['news/catalog.json', false], ['news/fallback.json', true]]) {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-cache' });
            if (!response.ok) throw new Error('Flux indisponible');
            return { ...validCatalog(await response.json()), fallback };
        } catch { /* Try the last known good, same-origin catalog. */ }
    }
    throw new Error('Actualités indisponibles pour le moment. Réessayez plus tard.');
}

function text(tag, value, className) {
    const element = document.createElement(tag);
    element.textContent = value;
    if (className) element.className = className;
    return element;
}

function card(item, index, total, carousel) {
    const article = document.createElement('article');
    article.className = 'moto-news-card';
    if (carousel) {
        article.setAttribute('aria-roledescription', 'diapositive');
        article.setAttribute('aria-label', `${index + 1} sur ${total}`);
    }
    article.append(text('p', item.source, 'moto-news-source'));
    article.append(text(carousel ? 'h3' : 'h2', item.title));
    const time = text('time', new Intl.DateTimeFormat('fr', { dateStyle: 'long', timeZone: 'Africa/Dakar' }).format(new Date(item.published_at)));
    time.dateTime = item.published_at;
    article.append(time, text('p', item.summary, 'moto-news-summary'));
    if (item.translated) article.append(text('p', 'Traduction automatique anglais → français · Argos Translate', 'moto-news-credit'));
    const link = text('a', `Lire l’article sur ${item.source} →`);
    link.href = item.url;
    link.rel = 'noopener noreferrer';
    article.append(link);
    // Images are deliberately never imported from third-party RSS feeds.
    return article;
}

export async function initNews(root) {
    const state = root.querySelector('[data-news-state]');
    try {
        const catalog = await loadCatalog();
        if (!catalog.items.length) {
            state.textContent = 'Le fil d’actualités est en préparation. Revenez prochainement.';
            return;
        }
        const carousel = root.dataset.motoNews === 'carousel';
        const items = carousel ? catalog.items.slice(0, 8) : catalog.items;
        const cards = items.map((item, i) => card(item, i, items.length, carousel));
        const frame = root.querySelector('[data-news-cards]');
        frame.replaceChildren(...cards);
        const outdated = !Number.isFinite(Date.parse(catalog.updated_at)) || Date.now() - Date.parse(catalog.updated_at) > 2 * DAY;
        state.textContent = catalog.fallback || outdated ? 'Dernières actualités disponibles — la mise à jour est temporairement indisponible.' : `Mise à jour : ${new Intl.DateTimeFormat('fr', { dateStyle: 'medium', timeZone: 'Africa/Dakar' }).format(new Date(catalog.updated_at))}`;
        if (!carousel) return;
        root.setAttribute('aria-roledescription', 'carrousel');
        const motion = matchMedia('(prefers-reduced-motion: reduce)');
        let paused = motion.matches, hovered = false, focused = false, current = 0, timer;
        const controls = root.querySelector('[data-news-controls]');
        const pause = root.querySelector('[data-news-pause]');
        const position = root.querySelector('[data-news-position]');
        const sync = () => {
            clearTimeout(timer);
            pause.textContent = paused ? 'Reprendre le défilement' : 'Mettre en pause';
            frame.setAttribute('aria-live', paused || focused || hovered ? 'polite' : 'off');
            if (items.length > 1 && !paused && !hovered && !focused && !document.hidden) timer = setTimeout(() => show(current + 1), 6000);
        };
        const show = index => {
            current = (index + cards.length) % cards.length;
            cards.forEach((node, i) => { node.hidden = i !== current; });
            position.textContent = `${current + 1} / ${cards.length}`;
            sync();
        };
        controls.hidden = items.length < 2;
        pause.addEventListener('click', () => { paused = !paused; sync(); });
        root.querySelector('[data-news-prev]').addEventListener('click', () => show(current - 1));
        root.querySelector('[data-news-next]').addEventListener('click', () => show(current + 1));
        root.addEventListener('mouseenter', () => { hovered = true; sync(); });
        root.addEventListener('mouseleave', () => { hovered = false; sync(); });
        root.addEventListener('focusin', () => { focused = true; sync(); });
        root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget)) { focused = false; sync(); } });
        document.addEventListener('visibilitychange', sync);
        motion.addEventListener('change', () => { if (motion.matches) paused = true; sync(); });
        show(0);
    } catch (error) { state.textContent = error.message; }
}

if (typeof document !== 'undefined') document.querySelectorAll('[data-moto-news]').forEach(initNews);
