import { heroBanners, bannerBoundary, safeContentUrl } from './cms-content-utils.mjs';

export function createHeroCarousel(hero) {
    if (!hero) return null;
    const host = document.createElement('div');
    host.className = 'hero-carousel';
    host.hidden = true;
    host.setAttribute('role', 'region');
    host.setAttribute('aria-roledescription', 'carrousel');
    host.setAttribute('aria-label', 'À la une');
    const frame = document.createElement('div');
    frame.className = 'hero-carousel-frame';
    const controls = document.createElement('div');
    controls.className = 'hero-carousel-controls';
    const button = (text, action) => {
        const element = document.createElement('button');
        element.type = 'button'; element.setAttribute('aria-label', text); element.title = text;
        element.addEventListener('click', action); controls.append(element); return element;
    };
    const icon = (element, path) => { element.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`; };
    const previous = button('Précédente', () => move(-1, true));
    icon(previous, 'M15 5l-7 7 7 7');
    const pause = button('Mettre en pause', () => { paused = !paused; updatePause(); schedule(); });
    const next = button('Suivante', () => move(1, true));
    icon(next, 'M9 5l7 7-7 7');
    const actions = document.createElement('div');
    actions.className = 'hero-carousel-actions';
    const links = hero.querySelector('.hero-buttons')?.cloneNode(true);
    if (links) { links.className = 'hero-carousel-links'; actions.append(links); }
    const status = document.createElement('span');
    status.setAttribute('aria-live', 'off'); status.setAttribute('aria-atomic', 'true');
    controls.append(status); host.append(frame, controls, actions); hero.append(host);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let entries = [], active = [], current = '', displayed = '', timer, boundaryTimer, generation = 0;
    let paused = reduced.matches, hovering = false, focused = false, initialized = false;
    const failed = new Set();
    function updatePause() {
        const label = paused ? 'Reprendre le défilement' : 'Mettre en pause';
        pause.setAttribute('aria-label', label); pause.title = label;
        icon(pause, paused ? 'M8 5l11 7-11 7z' : 'M8 5v14M16 5v14');
        pause.setAttribute('aria-pressed', String(paused));
        status.setAttribute('aria-live', paused || focused || hovering ? 'polite' : 'off');
    }
    function schedule() {
        clearTimeout(timer);
        if (active.length > 1 && !paused && !hovering && !focused && !document.hidden) {
            timer = setTimeout(() => move(1), 6000);
        }
    }
    function show(entry, manual = false) {
        const token = ++generation;
        const picture = document.createElement('picture');
        if (entry.image_mobile) {
            const source = document.createElement('source'); source.media = '(max-width: 700px)';
            source.srcset = safeContentUrl(entry.image_mobile, 'image'); picture.append(source);
        }
        const image = document.createElement('img');
        image.alt = entry.translations?.fr?.image_alt || entry.image_alt || entry.partner_name;
        image.width = 1983; image.height = 793; image.decoding = 'async'; image.fetchPriority = 'high';
        image.onload = () => {
            if (token !== generation) return;
            let content = picture;
            if (entry.destination_url) {
                const anchor = document.createElement('a'); anchor.href = safeContentUrl(entry.destination_url);
                anchor.append(picture); content = anchor;
            }
            // Keep the previous working image (or the original Hero) until this image loads.
            const slide = document.createElement('div');
            slide.className = 'hero-carousel-slide';
            // Original pixels remain intact; the wider frame adds a quiet backdrop.
            slide.append(content);
            const oldSlide = frame.lastElementChild;
            for (const child of [...frame.children]) if (child !== oldSlide) child.remove();
            if (oldSlide && !reduced.matches && displayed !== entry.slug) {
                oldSlide.inert = true; oldSlide.setAttribute('aria-hidden', 'true');
                slide.classList.add('hero-carousel-slide--enter');
                frame.append(slide);
                setTimeout(() => { oldSlide.remove(); slide.classList.remove('hero-carousel-slide--enter'); }, 650);
            } else frame.replaceChildren(slide);
            displayed = entry.slug; host.hidden = false; hero.classList.add('hero--carousel');
            status.setAttribute('aria-live', manual ? 'polite' : 'off');
            status.textContent = `Bannière ${active.findIndex((item) => item.slug === entry.slug) + 1} sur ${active.length} — ${entry.partner_name}`;
            schedule();
        };
        image.onerror = () => { if (token === generation) { failed.add(entry.slug); refresh(); } };
        picture.append(image); image.src = safeContentUrl(entry.image, 'image');
    }
    function move(delta, manual = false) {
        if (!active.length) return;
        current = active[(Math.max(0, active.findIndex((item) => item.slug === current)) + delta + active.length) % active.length].slug;
        show(active.find((item) => item.slug === current), manual);
    }
    function refresh() {
        clearTimeout(boundaryTimer);
        const now = Date.now();
        active = heroBanners(entries, now).filter((entry) => !failed.has(entry.slug));
        if (!active.some((entry) => entry.slug === displayed)) {
            host.hidden = true; hero.classList.remove('hero--carousel');
        }
        controls.hidden = active.length < 2;
        previous.disabled = next.disabled = active.length < 2;
        if (!active.length) {
            ++generation; current = ''; host.hidden = true; hero.classList.remove('hero--carousel'); clearTimeout(timer);
        } else if (!active.some((entry) => entry.slug === current)) {
            let index = 0;
            if (!initialized) {
                try {
                    const last = sessionStorage.getItem('atr-hero-first');
                    index = (active.findIndex((entry) => entry.slug === last) + 1) % active.length;
                    sessionStorage.setItem('atr-hero-first', active[index].slug);
                } catch { index = Math.floor(Math.random() * active.length); }
                initialized = true;
            }
            current = active[index].slug; show(active[index]);
        } else schedule();
        const boundaries = entries.filter((entry) => entry.placement === 'hero').flatMap((entry) => {
            try { return [bannerBoundary(entry.start_date), bannerBoundary(entry.end_date, true)]; } catch { return []; }
        }).filter((time) => time > now);
        if (boundaries.length) boundaryTimer = setTimeout(refresh, Math.min(86400000, Math.min(...boundaries) - now));
    }
    host.addEventListener('mouseenter', () => { hovering = true; updatePause(); schedule(); });
    host.addEventListener('mouseleave', () => { hovering = false; updatePause(); schedule(); });
    host.addEventListener('focusin', () => { focused = true; updatePause(); schedule(); });
    host.addEventListener('focusout', (event) => { if (!host.contains(event.relatedTarget)) { focused = false; updatePause(); schedule(); } });
    host.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1, true);
        }
    });
    reduced.addEventListener('change', () => { paused = reduced.matches; updatePause(); schedule(); });
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('pageshow', refresh);
    updatePause();
    return { setEntries(value) { entries = value; refresh(); } };
}
