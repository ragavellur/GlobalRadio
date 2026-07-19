#!/usr/bin/env node

/**
 * Data Preprocessing Pipeline
 * 
 * Reads the raw stations.json (17.9 MB) and produces optimized shards:
 *   - index.json (0.48 MB) — all city coords as compact arrays
 *   - countries.json (0.08 MB) — country code → city indices
 *   - stations/{cc}.json — station data per country
 *   - grid_5deg.json — spatial grid for viewport queries
 * 
 * Run: node scripts/preprocess.mjs
 * Input: ../Downloads/stations.json (or pass path as arg)
 * Output: ../public/data/
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const INPUT_PATH = process.argv[2] || join(PROJECT_ROOT, '..', 'Downloads', 'stations.json');
const OUTPUT_DIR = join(PROJECT_ROOT, 'public', 'data');
const STATIONS_DIR = join(OUTPUT_DIR, 'stations');

console.log(`Reading: ${INPUT_PATH}`);
const startTime = performance.now();
const rawText = readFileSync(INPUT_PATH, 'utf-8');
// stations.json contains invalid JSON with NaN values; replace with null
const raw = JSON.parse(rawText.replace(/\bNaN\b/g, 'null'));
console.log(`Parsed ${Object.keys(raw).length} cities in ${((performance.now() - startTime) / 1000).toFixed(1)}s`);

// Ensure output dirs exist
mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(STATIONS_DIR, { recursive: true });

// ─── Step 1: Build index.json (compact city coords) ─────────────────────
// Format: [city, countryCode, lat, lon, stationCount]
const entries = Object.entries(raw);
const index = entries.map(([key, val]) => {
  const lastComma = key.lastIndexOf(',');
  const city = lastComma > 0 ? key.slice(0, lastComma).trim() : key;
  const cc = lastComma > 0 ? key.slice(lastComma + 1).trim() : '';
  return [
    city,
    cc,
    Math.round(val.coords.n * 10000) / 10000,
    Math.round(val.coords.e * 10000) / 10000,
    val.urls.length
  ];
});
writeFileSync(join(OUTPUT_DIR, 'index.json'), JSON.stringify(index));
console.log(`index.json: ${(Buffer.byteLength(JSON.stringify(index)) / 1024).toFixed(0)} KB`);

// ─── Step 2: Build countries.json ───────────────────────────────────────
const countries = {};
index.forEach((entry, i) => {
  const cc = entry[1];
  if (!countries[cc]) countries[cc] = [];
  countries[cc].push(i);
});
writeFileSync(join(OUTPUT_DIR, 'countries.json'), JSON.stringify(countries));
console.log(`countries.json: ${(Buffer.byteLength(JSON.stringify(countries)) / 1024).toFixed(0)} KB (${Object.keys(countries).length} countries)`);

// ─── Step 3: Build per-country station files ────────────────────────────
const countryData = {};
entries.forEach(([key, val]) => {
  const lastComma = key.lastIndexOf(',');
  const cc = lastComma > 0 ? key.slice(lastComma + 1).trim() : 'ZZ';
  
  if (!countryData[cc]) countryData[cc] = {};
  
  // Compact format: station name + url as array pair
  countryData[cc][key] = val.urls
    .filter(s => s.name && s.url && typeof s.name === 'string')
    .map(s => [s.name, s.url]);
});

let totalStationBytes = 0;
for (const [cc, data] of Object.entries(countryData)) {
  const json = JSON.stringify(data);
  totalStationBytes += Buffer.byteLength(json);
  writeFileSync(join(STATIONS_DIR, `${cc.toLowerCase()}.json`), json);
}
console.log(`stations/*.json: ${(totalStationBytes / 1024 / 1024).toFixed(1)} MB across ${Object.keys(countryData).length} files`);

// ─── Step 4: Build spatial grid ─────────────────────────────────────────
const grid5 = {};
index.forEach((entry, i) => {
  const lat = entry[2];
  const lon = entry[3];
  const cellLat = Math.floor(lat / 5) * 5;
  const cellLon = Math.floor(lon / 5) * 5;
  const key = `${cellLat},${cellLon}`;
  if (!grid5[key]) grid5[key] = [];
  grid5[key].push(i);
});
writeFileSync(join(OUTPUT_DIR, 'grid_5deg.json'), JSON.stringify(grid5));
console.log(`grid_5deg.json: ${(Buffer.byteLength(JSON.stringify(grid5)) / 1024).toFixed(0)} KB (${Object.keys(grid5).length} cells)`);

// ─── Summary ────────────────────────────────────────────────────────────
const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
console.log(`\nDone in ${elapsed}s. Output: ${OUTPUT_DIR}`);
console.log(`  index.json         — ${(Buffer.byteLength(JSON.stringify(index)) / 1024).toFixed(0)} KB (→ ~${(Buffer.byteLength(JSON.stringify(index)) * 0.17 / 1024).toFixed(0)} KB gzipped)`);
console.log(`  countries.json     — ${(Buffer.byteLength(JSON.stringify(countries)) / 1024).toFixed(0)} KB`);
console.log(`  stations/*.json    — ${(totalStationBytes / 1024 / 1024).toFixed(1)} MB total`);
console.log(`  grid_5deg.json     — ${(Buffer.byteLength(JSON.stringify(grid5)) / 1024).toFixed(0)} KB`);
