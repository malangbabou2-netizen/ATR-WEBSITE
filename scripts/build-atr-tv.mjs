import { readdir, readFile, mkdir, writeFile, copyFile, lstat, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { youtubeVideo, safeImage, TV_CATEGORIES, ATR_CHANNEL_URL } from '../atr-tv-utils.mjs';
import { writeContentCatalog } from './build-cms-content.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const textFields = ['title', 'summary', 'image_alt'];

export async function buildCatalog(folder) {
    const groups = new Map();
    for (const name of (await readdir(folder)).sort()) {
        if (!name.endsWith('.json')) continue;
        const match = /^([a-z0-9][a-z0-9_-]*)\.(fr|en)\.json$/.exec(name);
        if (!match) throw new Error(`Unsupported content filename: ${name}`);
        const data = JSON.parse(await readFile(resolve(folder, name), 'utf8'));
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`Invalid object: ${name}`);
        const group = groups.get(match[1]) || {};
        group[match[2]] = data;
        groups.set(match[1], group);
    }
    const videos = [];
    for (const [slug, { fr, en = {} }] of groups) {
        if (!fr || typeof fr.title !== 'string' || !fr.title.trim()) throw new Error(`Missing French title: ${slug}`);
        // Le français fait autorité. Les anciens champs anglais dupliqués peuvent
        // diverger après une édition française ; ils restent conservés dans les sources.
        if (!TV_CATEGORIES.includes(fr.category)) throw new Error(`Invalid category: ${slug}`);
        for (const field of ['featured', 'archived']) {
            if (typeof fr[field] !== 'boolean') throw new Error(`Invalid boolean: ${slug}/${field}`);
        }
        if (!Number.isSafeInteger(fr.sort_order)) throw new Error(`Invalid sort order: ${slug}`);
        const video = youtubeVideo(fr.youtube_url);
        const image = safeImage(fr.image);
        const translations = {};
        for (const language of ['fr', 'en']) {
            translations[language] = {};
            for (const field of textFields) {
                const candidate = language === 'en' ? en[field] : fr[field];
                if (candidate !== undefined && typeof candidate !== 'string') throw new Error(`Invalid text: ${slug}/${language}/${field}`);
                translations[language][field] = candidate?.trim() || fr[field]?.trim() || '';
            }
        }
        if (!fr.archived) videos.push({ slug, category: fr.category, featured: fr.featured,
            sort_order: fr.sort_order, archived: fr.archived, youtube_url: video.url,
            video_id: video.id, embed_url: video.embed_url, image, translations });
    }
    return { version: 1, channel_url: ATR_CHANNEL_URL, videos };
}

const publicFiles = ['actualites.html', 'moto-news.mjs', 'moto-news.css', 'news/catalog.json', 'news/fallback.json', 'index.html', 'style.css', 'script.js', 'translations.js', 'atr-tv.js', 'atr-tv-utils.mjs', 'cms-content.js', 'cms-content-utils.mjs', 'hero-carousel.mjs',
    'robots.txt', 'sitemap.xml', 'CNAME'];
const publicFolders = ['images/', 'documents/', 'uploads/', 'admin/'];

export async function stageSite(destination, catalog) {
    const output = resolve(destination);
    const insideProject = relative(project, output);
    if (!insideProject || insideProject.startsWith(`..${sep}`) || insideProject === '..') throw new Error('Build directory must be inside the project');
    // Only disposable build directories may be replaced; never erase a source directory.
    if (!/^_site(?:-[a-z0-9-]+)?$/.test(insideProject)) throw new Error('Use _site or _site-<name> as the build directory');
    await rm(output, { recursive: true, force: true });
    await mkdir(output, { recursive: true });
    const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: project, encoding: 'utf8' }).split('\0').filter(Boolean);
    const files = [...new Set([...tracked.filter((name) => publicFiles.includes(name) || publicFolders.some((folder) => name.startsWith(folder))), ...publicFiles])];
    for (const name of files) {
        if (name.split('/').some((part) => part.startsWith('.')) || /(?:README|AGENTS)\.md$/.test(name)) continue;
        const source = resolve(project, name);
        const stat = await lstat(source);
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Unsafe public file: ${name}`);
        const target = resolve(output, name);
        await mkdir(dirname(target), { recursive: true });
        await copyFile(source, target);
    }
    await writeFile(resolve(output, 'atr-tv-catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
    await writeContentCatalog(resolve(project, 'content'), resolve(output, 'cms-content-catalog.json'));
    await writeFile(resolve(output, '.nojekyll'), '');
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || !['--output', '--site-dir'].includes(args[0]))) throw new Error('Usage: node scripts/build-atr-tv.mjs [--output file | --site-dir directory]');
    const catalog = await buildCatalog(resolve(project, 'content/atr-tv'));
    if (args[0] === '--site-dir') await stageSite(resolve(project, args[1]), catalog);
    else await writeFile(resolve(project, args[1] || 'atr-tv-catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
    console.log(`ATR TV: ${catalog.videos.length} active video(s), catalogue français généré (compatibilité des traductions conservée).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
