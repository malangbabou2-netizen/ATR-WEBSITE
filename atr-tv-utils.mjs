export const ATR_CHANNEL_URL = 'https://www.youtube.com/@AfricaTwin-riders221';
export const TV_CATEGORIES = ['road-trips', 'off-road', 'safety-training', 'events', 'ride-give'];

function seconds(value) {
    if (/^\d+$/.test(value)) return Number(value);
    const duration = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
    if (duration && duration[0]) return Number(duration[1] || 0) * 3600 + Number(duration[2] || 0) * 60 + Number(duration[3] || 0);
    throw new Error('Invalid YouTube start time');
}

export function youtubeVideo(value) {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be', 'www.youtube-nocookie.com'].includes(host)) {
        throw new Error('Use an HTTPS YouTube video URL');
    }
    const parts = url.pathname.split('/').filter(Boolean);
    const id = host.endsWith('youtu.be') ? parts[0]
        : url.pathname === '/watch' ? url.searchParams.get('v')
        : ['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : null;
    if (!/^[A-Za-z0-9_-]{11}$/.test(id || '')) throw new Error('Invalid YouTube video ID');
    const embed = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
    const start = url.searchParams.get('start') || url.searchParams.get('t') || new URLSearchParams(url.hash.slice(1)).get('t');
    if (start) embed.searchParams.set('start', String(seconds(start)));
    // Preserve supported playback parameters; the external link keeps the entire original URL.
    for (const key of ['end', 'index', 'list', 'loop', 'playlist']) {
        const parameter = url.searchParams.get(key);
        if (parameter !== null) embed.searchParams.set(key, parameter);
    }
    return { id, url: url.href, embed_url: embed.href };
}

export function safeImage(value) {
    if (!value) return '';
    if (typeof value !== 'string' || !/^\/?(?:uploads|images)\//.test(value) ||
        value.includes('\\') || value.split('/').includes('..') || /[?#]/.test(value) ||
        !/\.(?:png|jpe?g|webp|gif|avif)$/i.test(value)) throw new Error('Invalid local cover image');
    return value.replace(/^\//, '');
}

export function visibleVideos(videos, category = 'all') {
    return videos.filter((video) => video.archived === false && (category === 'all' || video.category === category))
        .sort((a, b) => Number(b.featured) - Number(a.featured) || a.sort_order - b.sort_order || a.slug.localeCompare(b.slug));
}
