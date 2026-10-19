import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

export const SITE_ORIGIN = 'https://africatwinriders.sn';
// Only inspect the publication artifact, never the repository or CMS branches.
const excluded = new Set(['admin', 'content', 'auth-worker', 'draft', 'drafts', 'brouillons', 'preview', 'previews', 'tests', 'docs', 'images', 'uploads', 'documents', 'node_modules']);
export function attributes(tag) {
    return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
        .map((match) => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4]]));
}
export function pageMetadata(html) {
    const head = (html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '').replace(/<!--[\s\S]*?-->/g, '');
    const tags = [...head.matchAll(/<(meta|link)\b[^>]*>/gi)].map((match) => ({ tag: match[1].toLowerCase(), ...attributes(match[0]) }));
    const meta = Object.fromEntries(tags.filter((item) => item.tag === 'meta').map((item) => [(item.name || item.property || '').toLowerCase(), item.content || '']));
    const canonicals = tags.filter((item) => item.tag === 'link' && item.rel?.toLowerCase().split(/\s+/).includes('canonical'));
    return { meta, canonicals, noindex: tags.some((item) => ['robots', 'googlebot'].includes(item.name?.toLowerCase()) && /\b(noindex|none)\b/i.test(item.content || '')), title: head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim(),
        redirect: tags.some((item) => item['http-equiv']?.toLowerCase() === 'refresh') };
}
export async function publicHtmlPages(root) {
    const files = [];
    async function walk(folder) {
        for (const item of await readdir(folder, { withFileTypes: true })) {
            if (item.name.startsWith('.') || excluded.has(item.name.toLowerCase())) continue;
            const path = resolve(folder, item.name);
            if (item.isDirectory()) await walk(path);
            else if (item.isFile() && /\.html?$/i.test(item.name) && item.name !== '404.html') files.push(path);
        }
    }
    await walk(resolve(root));
    return files.sort();
}
const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
export async function renderSitemap(root) {
    const urls = [];
    for (const file of await publicHtmlPages(root)) {
        const { noindex, canonicals, redirect } = pageMetadata(await readFile(file, 'utf8'));
        if (redirect || noindex) continue;
        const path = relative(resolve(root), file).split(sep).map(encodeURIComponent).join('/').replace(/(^|\/)index\.html$/i, '$1');
        const expected = new URL('/' + path, SITE_ORIGIN).href;
        if (canonicals.length !== 1 || canonicals[0].href !== expected) throw new Error(`Missing or non-self canonical: ${path || 'index.html'}`);
        urls.push(expected);
    }
    if (!urls.includes(`${SITE_ORIGIN}/`)) throw new Error('Missing indexable home page');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...new Set(urls)].sort().map((url) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`).join('\n')}\n</urlset>\n`;
}
export async function writeSitemap(root) {
    const xml = await renderSitemap(root);
    await writeFile(resolve(root, 'sitemap.xml'), xml);
}
