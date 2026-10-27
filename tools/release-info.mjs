// Select the newest published tarn-lng/tarn release and stage what the site
// needs from it: assets/release.js (version and archive architectures) and
// install.sh, copied from the release's own verified installer asset.
// Usage: node tools/release-info.mjs <output-dir>
import { writeFileSync } from 'node:fs';

const out = process.argv[2] ?? '.';
const headers = { accept: 'application/vnd.github+json', 'user-agent': 'tarn-website' };
if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const response = await fetch('https://api.github.com/repos/tarn-lng/tarn/releases?per_page=50', { headers });
if (!response.ok) throw new Error(`GitHub releases API returned ${response.status}`);

const parse = tag => /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag)?.slice(1).map(Number);
const newer = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
// Only complete releases: a checksum file, the installer and at least one archive.
const releases = (await response.json())
  .filter(r => !r.draft && parse(r.tag_name))
  .map(r => {
    const version = r.tag_name.slice(1);
    const names = new Set(r.assets.map(a => a.name));
    const archives = ['x86_64', 'aarch64'].filter(arch => names.has(`tarn-${version}-linux-${arch}.tar.gz`));
    return { version, parts: parse(r.tag_name), names, archives, assets: r.assets };
  })
  .filter(r => r.archives.length > 0 && r.names.has('SHA256SUMS') && r.names.has('install.sh'))
  .sort((a, b) => newer(b.parts, a.parts));
if (releases.length === 0) throw new Error('no complete Tarn release found');

const latest = releases[0];
const installer = await fetch(latest.assets.find(a => a.name === 'install.sh').browser_download_url);
if (!installer.ok) throw new Error(`install.sh download returned ${installer.status}`);
const script = await installer.text();
// The site always passes --version, so the installer's own default may lag.
if (!script.startsWith('#!') || !script.includes('--version')) {
  throw new Error(`install.sh from v${latest.version} is not the Tarn installer`);
}

writeFileSync(`${out}/install.sh`, script);
writeFileSync(`${out}/assets/release.js`,
  '// Generated at deployment by tools/release-info.mjs; do not edit.\n' +
  `const tarnRelease = ${JSON.stringify({ version: latest.version, archives: latest.archives })};\n`);
console.log(`Tarn v${latest.version}: ${latest.archives.join(', ')}`);
