import { youtubeVideo, safeImage, visibleVideos, TV_CATEGORIES, ATR_CHANNEL_URL } from './atr-tv-utils.mjs';

const section = document.querySelector('#atr-tv');
const grid = document.querySelector('#atrTvGrid');
const state = document.querySelector('#atrTvState');
const filters = document.querySelector('#atrTvFilters');
const retry = document.querySelector('#atrTvRetry');
const player = document.querySelector('#atrTvPlayer');
const embed = document.querySelector('#atrTvEmbed');
let videos = [];
let category = 'all';
let phase = 'loading';
let selectedVideo = null;
let requestNumber = 0;

const labels = () => window.atrTvTranslations.fr;
const translated = (video, field) => video.translations.fr[field]?.trim() || '';

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

function updatePlayerLabels() {
    const words = labels();
    document.querySelector('#atrTvClose').setAttribute('aria-label', words.close);
    document.querySelector('#atrTvExternal').textContent = words.external;
    if (selectedVideo) {
        const title = translated(selectedVideo, 'title');
        document.querySelector('#atrTvPlayerTitle').textContent = title;
        embed.querySelector('iframe')?.setAttribute('title', title);
    }
}

function openVideo(video) {
    const info = youtubeVideo(video.youtube_url);
    if (typeof player.showModal !== 'function') {
        window.open(info.url, '_blank', 'noopener,noreferrer');
        return;
    }
    selectedVideo = video;
    const iframe = document.createElement('iframe');
    const url = new URL(info.embed_url);
    url.searchParams.set('autoplay', '1');
    iframe.src = url.href;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    embed.replaceChildren(iframe);
    document.querySelector('#atrTvExternal').href = info.url;
    updatePlayerLabels();
    player.showModal();
}

function render() {
    const words = labels();
    const focused = document.activeElement;
    const focusedCategory = focused?.dataset.tvCategory;
    const focusedVideo = focused?.dataset.tvVideo;
    document.querySelector('#atrTvChannel').textContent = words.subscribe;
    retry.textContent = words.retry;
    filters.setAttribute('aria-label', words.filterLabel);
    filters.hidden = phase !== 'ready' || videos.length === 0;
    retry.hidden = phase !== 'error';
    grid.setAttribute('aria-busy', String(phase === 'loading'));
    grid.replaceChildren();
    filters.replaceChildren();
    updatePlayerLabels();
    if (phase !== 'ready') {
        state.hidden = false;
        state.textContent = words[phase];
        return;
    }
    const available = new Set(visibleVideos(videos).map((video) => video.category));
    for (const value of ['all', ...TV_CATEGORIES.filter((key) => available.has(key))]) {
        const button = element('button', 'atr-tv-filter', value === 'all' ? words.all : words.categories[value]);
        button.type = 'button';
        button.dataset.tvCategory = value;
        button.setAttribute('aria-pressed', String(category === value));
        button.addEventListener('click', () => { category = value; render(); });
        filters.append(button);
    }
    const shown = visibleVideos(videos, category);
    state.hidden = shown.length > 0;
    state.textContent = videos.length ? words.filteredEmpty : words.empty;
    for (const video of shown) {
        const title = translated(video, 'title');
        const card = element('article', `atr-tv-card${video.featured ? ' atr-tv-card--featured' : ''}`);
        card.dataset.videoSlug = video.slug;
        const cover = element('div', 'atr-tv-cover');
        const image = document.createElement('img');
        image.src = video.image ? new URL(safeImage(video.image), document.baseURI).href
            : `https://i.ytimg.com/vi/${video.video_id}/maxresdefault.jpg`;
        image.alt = translated(video, 'image_alt');
        image.loading = 'lazy';
        image.decoding = 'async';
        image.width = 1280;
        image.height = 720;
        // Missing custom/high-resolution covers use the standard video thumbnail.
        image.addEventListener('error', () => {
            if (!image.dataset.fallback) {
                image.dataset.fallback = 'true';
                image.src = `https://i.ytimg.com/vi/${video.video_id}/hqdefault.jpg`;
            }
        });
        cover.append(image);
        if (video.featured) cover.append(element('span', 'atr-tv-featured', words.featured));
        const copy = element('div', 'atr-tv-copy');
        copy.append(element('p', 'atr-tv-category', words.categories[video.category]), element('h3', '', title));
        const summary = translated(video, 'summary');
        if (summary) copy.append(element('p', 'atr-tv-summary', summary));
        const play = element('button', 'btn btn-primary atr-tv-play', `▶ ${words.play}`);
        play.type = 'button';
        play.dataset.tvVideo = video.slug;
        play.setAttribute('aria-label', `${words.play} — ${title}`);
        play.addEventListener('click', () => openVideo(video));
        copy.append(play);
        card.append(cover, copy);
        grid.append(card);
    }
    if (focusedCategory) [...filters.children].find((node) => node.dataset.tvCategory === focusedCategory)?.focus({ preventScroll: true });
    if (focusedVideo) [...grid.querySelectorAll('[data-tv-video]')].find((node) => node.dataset.tvVideo === focusedVideo)?.focus({ preventScroll: true });
}

function validateCatalog(data) {
    if (data?.version !== 1 || !Array.isArray(data.videos)) throw new Error('Invalid ATR TV catalog');
    const slugs = new Set();
    return data.videos.map((video) => {
        const info = youtubeVideo(video.youtube_url);
        if (!/^[a-z0-9][a-z0-9_-]*$/.test(video.slug || '') || slugs.has(video.slug) ||
            !TV_CATEGORIES.includes(video.category) || typeof video.archived !== 'boolean' || typeof video.featured !== 'boolean' ||
            !Number.isSafeInteger(video.sort_order) || typeof video.translations?.fr?.title !== 'string' || !video.translations.fr.title.trim()) {
            throw new Error('Invalid ATR TV entry');
        }
        for (const lang of ['fr', 'en']) {
            for (const field of ['title', 'summary', 'image_alt']) {
                const text = video.translations[lang]?.[field];
                if (text !== undefined && typeof text !== 'string') throw new Error('Invalid ATR TV translation');
            }
        }
        slugs.add(video.slug);
        return { ...video, image: safeImage(video.image), video_id: info.id };
    });
}

async function loadVideos() {
    const currentRequest = ++requestNumber;
    phase = 'loading';
    render();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(new URL('atr-tv-catalog.json', import.meta.url), { cache: 'no-cache', signal: controller.signal });
        if (!response.ok) throw new Error('Catalog unavailable');
        const entries = validateCatalog(await response.json());
        if (currentRequest !== requestNumber) return;
        videos = visibleVideos(entries);
        category = 'all';
        phase = 'ready';
    } catch {
        if (currentRequest !== requestNumber) return;
        videos = [];
        phase = 'error';
    } finally {
        clearTimeout(timeout);
        if (currentRequest === requestNumber) render();
    }
}

if (section) {
    document.querySelector('#atrTvChannel').href = ATR_CHANNEL_URL;
    retry.addEventListener('click', loadVideos);
    document.querySelector('#atrTvClose').addEventListener('click', () => player.close());
    player.addEventListener('close', () => { embed.replaceChildren(); selectedVideo = null; });
    player.addEventListener('click', (event) => {
        const bounds = player.getBoundingClientRect();
        if (event.target === player && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) player.close();
    });
    loadVideos();
}
