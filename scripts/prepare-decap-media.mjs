// Reproducible, offline patch of the exact Decap bundle previously loaded by ATR.
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const UPSTREAM_URL = 'https://cdn.jsdelivr.net/npm/decap-cms@3.16.3/dist/decap-cms.js';
export const UPSTREAM_SHA256 = '7c1efd6b616b4786e279aeef194dd21649a72058d3bc8d1f78901b574610dfb8';
export const VENDOR_FILE = 'admin/vendor/decap-cms-3.16.3-atr.1.js';
export const ANCHOR = 'function Wc({collection:e,entry:t,path:n,field:r}){return(i,o)=>{if(!n)return qc;const a=o(),s=oh(a.config,e,t,n,r);';
export const SOURCE_MAP_REFERENCE = '\n//# sourceMappingURL=decap-cms.js.map';

// These aliases are verified against the pinned bundle and its official source map:
// Wc=getAsset, ih=selectMediaFolder, ah=selectMediaFilePublicPath,
// Vo=basename, aa.join=path.join. Never apply this patch to another build/version.
export const INSERTION = `
/* ATR draft media preview: prefer the actual draft asset before any public URL cache. */
if(n.startsWith("/")&&!n.startsWith("//")){
    const atrMediaPath=(0,aa.join)(ih(a.config,e,t,r),Vo(n));
    const atrDraftAsset=a.medias[atrMediaPath]?.asset;
    if(atrDraftAsset&&ah(a.config,e,atrMediaPath,t,r)===n)return atrDraftAsset;
}
`;

export function patchDecap(source) {
    if (createHash('sha256').update(source).digest('hex') !== UPSTREAM_SHA256) {
        throw new Error('Unexpected Decap bundle hash. Refusing to patch a different build.');
    }
    if (source.split(ANCHOR).length !== 2 || source.split(SOURCE_MAP_REFERENCE).length !== 2) {
        throw new Error('Unexpected Decap patch location. Review upstream code before updating.');
    }
    return source.replace(ANCHOR, ANCHOR + INSERTION).replace(SOURCE_MAP_REFERENCE, '');
}

const project = resolve(fileURLToPath(new URL('..', import.meta.url)));
async function main() {
    const [flag, path, ...extra] = process.argv.slice(2);
    if (flag !== '--source' || !path || extra.length) throw new Error('Usage: node scripts/prepare-decap-media.mjs --source <original-decap-cms.js>');
    const patched = patchDecap(await readFile(resolve(path), 'utf8'));
    const output = resolve(project, VENDOR_FILE);
    await mkdir(resolve(project, 'admin/vendor'), { recursive: true });
    await writeFile(output, patched);
    console.log(`Wrote ${VENDOR_FILE}; SHA256 ${createHash('sha256').update(patched).digest('hex')}`);
    console.log(`HTML integrity: sha384-${createHash('sha384').update(patched).digest('base64')}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
