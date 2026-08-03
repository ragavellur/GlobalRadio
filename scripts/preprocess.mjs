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

// ─── Step 0: Remove runaway stations (keep each in a home city) ─────────
// The source dump appends ~5 "featured" stations to every city in a country.
// A station URL is "runaway" when it appears in >=90% of a country's cities
// (countries with >=20 cities). Such stations are dropped from every city
// EXCEPT one "home" city, so no real station disappears entirely.
const ccCities = {};
for (const key of Object.keys(raw)) {
  const cc = key.slice(key.lastIndexOf(',') + 1).trim();
  if (!ccCities[cc]) ccCities[cc] = [];
  ccCities[cc].push(key);
}

const runawayByCc = {};
for (const [cc, cities] of Object.entries(ccCities)) {
  if (cities.length < 20) continue;
  const urlCount = {};
  for (const key of cities) {
    for (const s of raw[key].urls || []) {
      if (s.url) urlCount[s.url] = (urlCount[s.url] || 0) + 1;
    }
  }
  const threshold = cities.length * 0.9;
  runawayByCc[cc] = new Set(
    Object.entries(urlCount)
      .filter(([, n]) => n >= threshold)
      .map(([url]) => url)
  );
}

// Known local stations that the source dump copied into every city.
// Keep them in their actual broadcast city.
const HOME_OVERRIDES = {
  'https://cast1.my-control-panel.com/proxy/geethan3/stream': 'Madurai', // Vaigai Fm
  'https://listen.openstream.co/6812/audio': 'Kodaikanal', // Kodaicity Fm
  'https://cast6.my-control-panel.com/proxy/kodairagamradio/stream': 'Kodaikanal', // Kodairagam Rad
  'https://spserver.sscast2u.in/8124/stream': 'Dindigul', // Dindigul Rad
  'https://spserver.sscast2u.in/ssradionatham/stream': 'Natham', // Ss Rad Natham
};

// Capital / largest city per affected country (data uses legacy 2-letter codes).
// City names in the source are truncated to 13 chars; match on that prefix.
const PRIMARY_CITY = {
  CA: 'Toronto', ES: 'Madrid', DN: 'Copenhagen', DE: 'Berlin', NL: 'Amsterdam',
  BE: 'Brussels', NG: 'Lagos', BR: 'Sao Paulo', RUS: 'Moscow', RU: 'Moscow',
  US: 'New York', VE: 'Caracas', CO: 'Bogota', GB: 'London', AR: 'Buenos Aires',
  IN: 'New Delhi', ME: 'Mexico City', GH: 'Accra', IT: 'Rome', PE: 'Lima',
  SR: 'Belgrade', DZ: 'Algiers', GR: 'Athens', FR: 'Paris', PH: 'Manila',
  GT: 'Guatemala City', UR: 'Montevideo', ID: 'Jakarta', BO: 'La Paz',
  NZ: 'Auckland', SW: 'Stockholm', LK: 'Colombo', FI: 'Helsinki', CR: 'San Jose',
  RO: 'Bucharest', UG: 'Kampala', NO: 'Oslo', EC: 'Quito', IS: 'Reykjavik',
  PO: 'Warsaw', HN: 'Tegucigalpa', UKR: 'Kyiv', UK: 'Kyiv', TZ: 'Dar es Salaam',
  KE: 'Nairobi', DO: 'Santo Domingo', HR: 'Zagreb', ZA: 'Johannesburg',
  HU: 'Budapest', TH: 'Bangkok', NP: 'Kathmandu', BI: 'Sarajevo', CU: 'Havana',
  CZ: 'Prague', HT: 'Port-au-Prince', CHN: 'Beijing',
};

const cityName = (key) => key.slice(0, key.lastIndexOf(',')).toLowerCase();
const truncated = (name) => name.toLowerCase().slice(0, 13);

function findHome(cities, cc, url, name) {
  // 1) explicit override by URL
  const override = HOME_OVERRIDES[url];
  if (override) {
    const hit = cities.find((k) => cityName(k).startsWith(override.toLowerCase()));
    if (hit) return hit;
  }
  // 2) station name contains a city name
  const target = name.toLowerCase();
  for (const key of cities) {
    const cn = cityName(key);
    if (cn.length >= 4 && target.includes(cn)) return key;
  }
  // 3) primary city for the country
  const primary = PRIMARY_CITY[cc];
  if (primary) {
    const hit = cities.find((k) => truncated(cityName(k)).startsWith(truncated(primary)));
    if (hit) return hit;
  }
  // 4) largest city after removing runaway stations
  const runaway = runawayByCc[cc];
  let best = null;
  let max = -1;
  for (const key of cities) {
    const n = raw[key].urls.filter((s) => s.url && !(runaway && runaway.has(s.url))).length;
    if (n > max) {
      max = n;
      best = key;
    }
  }
  return best;
}

let runawayStations = 0;
let runawayEntries = 0;
let missingHomes = 0;
for (const [cc, runaway] of Object.entries(runawayByCc)) {
  const cities = ccCities[cc];
  for (const url of runaway) {
    let name = '';
    for (const key of cities) {
      const s = (raw[key].urls || []).find((s) => s.url === url);
      if (s) {
        name = s.name || '';
        break;
      }
    }
    if (!name) continue; // unnamed entries are filtered out later anyway
    const home = findHome(cities, cc, url, name);
    if (!home) {
      missingHomes++;
      console.warn(`  no home city for ${cc}: ${name}`);
      continue;
    }
    for (const key of cities) {
      const before = raw[key].urls.length;
      raw[key].urls = (raw[key].urls || []).filter((s) => !(s.url === url));
      runawayEntries += before - raw[key].urls.length;
    }
    raw[home].urls.push({ name, url }); // keep it in exactly one city
  }
}
runawayStations = Object.values(runawayByCc).reduce((sum, s) => sum + s.size, 0);
if (runawayStations > 0) {
  console.log(`Cleanup: ${runawayStations} runaway stations kept in one city each (${runawayEntries} duplicated entries removed)`);
  if (missingHomes > 0) console.log(`  WARNING: ${missingHomes} stations had no home city`);
}

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
