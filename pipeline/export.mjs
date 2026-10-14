// Rebuild the per-level GLBs: bundle src/main.js, render it headless, call the in-page GLTFExporter,
// then dedup + weld + quantize with gltf-transform (never `optimize`/`join` — they destroy node names).
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'build'); mkdirSync(out, { recursive: true });
const models = join(here, '..', 'models');

await build({ entryPoints: [join(here, 'src/main.js')], bundle: true, format: 'iife', minify: true, outfile: join(out, 'bundle.js'), logLevel: 'warning' });
const page = readFileSync(join(here, 'shell.html'), 'utf8').replace('/*BUNDLE*/', () => readFileSync(join(out, 'bundle.js'), 'utf8').replaceAll('</script>', '<\\/script>'));
writeFileSync(join(out, 'export.html'), page);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const p = await browser.newPage({ viewport: { width: 1400, height: 800 } });
p.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
await p.goto('file://' + join(out, 'export.html'));
await p.waitForFunction(() => window.__app);
for (const key of ['gf', 'ff']) {
  const b64 = await p.evaluate(async (k) => {
    const buf = await window.__app.exportGLB(k);
    let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(s);
  }, key);
  const raw = join(out, `${key}_raw.glb`);
  writeFileSync(raw, Buffer.from(b64, 'base64'));
  const gt = (...a) => execFileSync('npx', ['gltf-transform', ...a], { cwd: here, stdio: 'inherit' });
  gt('dedup', raw, join(out, `${key}_dd.glb`));
  gt('weld', join(out, `${key}_dd.glb`), join(out, `${key}_w.glb`));
  gt('quantize', join(out, `${key}_w.glb`), join(models, `${key}.glb`));
  console.log(`models/${key}.glb written`);
}
await browser.close();
