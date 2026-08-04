#!/usr/bin/env node

/**
 * Builds a global, deduplicated station search index from the per-country
 * shards. Output: public/data/stations_search.json
 *
 * Format: [name, url, cityIdx] where cityIdx is the position of the city in
 * index.json. Deduplicated by URL (a station is listed once, in the first
 * city where it appears).
 *
 * Run: node scripts/build-station-index.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const DATA_DIR = join(PROJECT_ROOT, 'public', 'data');
const STATIONS_DIR = join(DATA_DIR, 'stations');

const index = JSON.parse(readFileSync(join(DATA_DIR, 'index.json'), 'utf8'));

// cityKey ("City,CC") -> position in index.json
const cityIdx = new Map();
index.forEach((entry, i) => {
  const city = String(entry[0]).trim().toLowerCase();
  const cc = String(entry[1]).trim().toLowerCase();
  cityIdx.set(`${city},${cc}`, i);
});

const byUrl = new Map();
let unknownCity = 0;
for (const f of readdirSync(STATIONS_DIR)) {
  const cc = f.replace(/\.json$/, '').toLowerCase();
  const data = JSON.parse(readFileSync(join(STATIONS_DIR, f), 'utf8'));
  for (const [key, stations] of Object.entries(data)) {
    const cityKey = `${key.split(',')[0].trim().toLowerCase()},${cc}`;
    const idx = cityIdx.get(cityKey);
    if (idx === undefined) {
      unknownCity++;
      continue;
    }
    for (const [name, url] of stations) {
      if (typeof name !== 'string' || !name || !url) continue;
      if (!byUrl.has(url)) byUrl.set(url, [name, idx]);
    }
  }
}

const rows = [...byUrl.entries()]
  .map(([url, [name, idx]]) => [name, url, idx])
  .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

writeFileSync(join(DATA_DIR, 'stations_search.json'), JSON.stringify(rows));
console.log(`stations_search.json: ${rows.length} stations, ${(Buffer.byteLength(JSON.stringify(rows)) / 1024).toFixed(0)} KB (unknown cities: ${unknownCity})`);
