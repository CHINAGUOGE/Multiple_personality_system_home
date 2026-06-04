import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = fileURLToPath(new URL('../dist-lab', import.meta.url));
const token =
  process.env.LAB_CLOUDFLARE_WEB_ANALYTICS_TOKEN ||
  process.env.PUBLIC_LAB_CLOUDFLARE_WEB_ANALYTICS_TOKEN ||
  process.env.CLOUDFLARE_WEB_ANALYTICS_TOKEN ||
  process.env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN;

if (!token) {
  console.log('Lab Web Analytics token not set; skipping injection.');
  process.exit(0);
}

if (!existsSync(distDir)) {
  console.log('dist-lab does not exist; skipping Lab Web Analytics injection.');
  process.exit(0);
}

const escapeAttribute = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const beaconConfig = escapeAttribute(JSON.stringify({ token }));
const analyticsSnippet = `  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${beaconConfig}'></script>\n`;

async function findHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        return findHtmlFiles(fullPath);
      }

      return entry.isFile() && entry.name.endsWith('.html') ? [fullPath] : [];
    })
  );

  return files.flat();
}

const htmlFiles = await findHtmlFiles(distDir);
let injectedCount = 0;

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');

  if (html.includes('static.cloudflareinsights.com/beacon.min.js')) {
    continue;
  }

  const updated = html.replace(/<\/head>/i, `${analyticsSnippet}</head>`);

  if (updated === html) {
    continue;
  }

  await writeFile(file, updated);
  injectedCount += 1;
}

console.log(`Injected Lab Web Analytics into ${injectedCount} HTML file(s).`);
