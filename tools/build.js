// Builds a release folder and (with --zip) the archive to upload.
//
//   node tools/build.js                       -> dist/               (itch.io, any static host)
//   node tools/build.js --zip                 -> dist/ + rassvet-<version>.zip
//   node tools/build.js --target yandex --zip -> dist-yandex/ + rassvet-<version>-yandex.zip
//
// No dependencies. The scripts between the markers in index.html are packed, in order, into one
// game.js; Phaser is copied from vendor/. The Yandex build also loads the portal SDK (/sdk.js),
// which Yandex serves itself. Checks run first and stop the build.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const targetIndex = argv.indexOf('--target');
const target = targetIndex >= 0 ? argv[targetIndex + 1] : 'web';
if (!['web', 'yandex'].includes(target)) {
  console.error(`Unknown target "${target}". Use: web (default) or yandex.`);
  process.exit(1);
}
const yandex = target === 'yandex';
const distName = yandex ? 'dist-yandex' : 'dist';
const dist = path.join(root, distName);
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const problems = [];
const fail = (msg) => problems.push(msg);

// Files that are copied as they are (besides game.js and index.html, which are generated).
const STATIC_FILES = ['style.css', 'boot.js', 'favicon.svg', 'vendor/phaser.min.js'];

// ---- version: config.js and package.json must agree --------------------------
const pkg = JSON.parse(read('package.json'));
const version = (read('src/config.js').match(/R\.VERSION = '([^']+)'/) || [])[1];
if (!version) fail('R.VERSION not found in src/config.js');
else if (version !== pkg.version) fail(`version mismatch: src/config.js ${version}, package.json ${pkg.version}`);

// ---- the script list of index.html ------------------------------------------
const html = read('index.html');
const begin = '<!-- scripts:begin';
const end = '<!-- scripts:end -->';
const bi = html.indexOf(begin);
const ei = html.indexOf(end);
if (bi < 0 || ei < bi) fail('scripts:begin / scripts:end markers missing in index.html');
const block = bi >= 0 && ei > bi ? html.slice(html.indexOf('\n', bi), ei) : '';
const sources = [...block.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
if (sources.length === 0) fail('no scripts found between the markers');
for (const src of sources) if (!fs.existsSync(path.join(root, src))) fail('missing file: ' + src);

// the SDK marker: replaced by the SDK tag (Yandex) or removed (everything else)
const sdkMarker = /[ \t]*<!-- platform:sdk[^>]*-->\n/;
if (!sdkMarker.test(html)) fail('platform:sdk marker missing in index.html');

// every file in src/ must be in the list (a forgotten file would silently be missing in the build)
const walk = (dir) =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name).split(path.sep).join('/')]
  );
for (const file of walk('src')) if (!sources.includes(file)) fail('src file not listed in index.html: ' + file);
for (const file of STATIC_FILES) if (!fs.existsSync(path.join(root, file))) fail('missing file: ' + file);

// everything index.html loads must exist (the SDK is the only exception: the portal serves it)
for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const ref = m[1];
  if (ref === '/sdk.js') continue;
  if (/^[a-z]+:/i.test(ref) || ref.startsWith('/')) fail('index.html refers to something outside the game: ' + ref);
  else if (!fs.existsSync(path.join(root, ref))) fail('index.html refers to a missing file: ' + ref);
}

// ---- leftovers that must not ship -------------------------------------------
for (const src of [...sources, 'boot.js']) {
  read(src)
    .split('\n')
    .forEach((line, i) => {
      if (/\bdebugger\b|console\.(log|debug)\(|\b(TODO|FIXME|XXX)\b/.test(line)) fail(`${src}:${i + 1}: leftover: ${line.trim()}`);
    });
}
for (const file of ['index.html', 'style.css', 'boot.js']) {
  if (/https?:\/\/(?!www\.w3\.org)/.test(read(file))) fail(`${file} refers to an external URL (the build must work offline)`);
}
// strict hosts (Yandex) may refuse inline code: the page must not contain any
if (/<script(?![^>]*\bsrc=)[^>]*>/.test(html) || /<style[\s>]/.test(html)) fail('index.html has inline <script> or <style>: move it to a file');

if (problems.length) {
  console.error('Build stopped:\n - ' + problems.join('\n - '));
  process.exit(1);
}

// ---- tests ---------------------------------------------------------------------
console.log('Running tests...');
execFileSync(process.execPath, [path.join(root, 'tests/logic.test.js')], { stdio: 'inherit' });

// ---- build -----------------------------------------------------------------------
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'vendor'), { recursive: true });

const banner = `/* Рассвет v${version} (${target}) - build ${new Date().toISOString().slice(0, 10)} */\n`;
const game = sources.map((src) => `/* ---- ${src} ---- */\n${read(src).trimEnd()}\n`).join('\n');
fs.writeFileSync(path.join(dist, 'game.js'), banner + game);

let outHtml = html.slice(0, bi) + `<script src="game.js?v=${version}"></script>\n  ` + html.slice(ei + end.length);
outHtml = outHtml.replace(sdkMarker, yandex ? '  <script src="/sdk.js"></script>\n' : '');
fs.writeFileSync(path.join(dist, 'index.html'), outHtml);
for (const file of STATIC_FILES) fs.copyFileSync(path.join(root, file), path.join(dist, file));

// ---- checks on the result ------------------------------------------------------
const files = [];
const walkDist = (dir) => {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walkDist(p);
    else files.push(path.relative(dist, p).split(path.sep).join('/'));
  }
};
walkDist(dist);
const resultProblems = [];
if (!files.includes('index.html')) resultProblems.push('index.html is not in the root');
for (const f of files) if (/[^\x21-\x7e]/.test(f)) resultProblems.push('file name with spaces or non-ASCII characters (Yandex refuses it): ' + f);
const totalBytes = files.reduce((n, f) => n + fs.statSync(path.join(dist, f)).size, 0);
if (totalBytes > 100 * 1024 * 1024) resultProblems.push('the game is larger than 100 MB');
if (yandex && !/<script src="\/sdk\.js"><\/script>/.test(outHtml)) resultProblems.push('the SDK tag is missing');
if (!yandex && /sdk\.js/.test(outHtml)) resultProblems.push('the web build must not load the portal SDK');
if (resultProblems.length) {
  console.error('Build stopped:\n - ' + resultProblems.join('\n - '));
  process.exit(1);
}

const kb = (f) => (fs.statSync(path.join(dist, f)).size / 1024).toFixed(0) + ' KB';
console.log(`\nBuilt ${distName}/ (v${version}, ${target}): ${files.length} files, ${(totalBytes / 1024).toFixed(0)} KB (game.js ${kb('game.js')}, phaser ${kb('vendor/phaser.min.js')})`);

// ---- zip: index.html must sit at the root of the archive -----------------------
if (argv.includes('--zip')) {
  const zipName = `rassvet-${version}${yandex ? '-yandex' : ''}.zip`;
  const zipPath = path.join(root, zipName);
  fs.rmSync(zipPath, { force: true });
  try {
    execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: dist, stdio: 'inherit' });
  } catch (e) {
    // no `zip` program: fall back to Python's standard library
    execFileSync('python3', ['-m', 'zipfile', '-c', zipPath, ...fs.readdirSync(dist)], { cwd: dist, stdio: 'inherit' });
  }
  console.log(`Wrote ${zipName} (${(fs.statSync(zipPath).size / 1024).toFixed(0)} KB)`);
}
