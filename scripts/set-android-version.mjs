import { readFileSync, writeFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map((n) => parseInt(n, 10) || 0);
const versionName = pkg.version;
const versionCode = major * 10000 + minor * 100 + patch;

const gradlePath = 'android/app/build.gradle';
let gradle = readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode \d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName "[^"]*"/, `versionName "${versionName}"`);
writeFileSync(gradlePath, gradle);
console.log(`Android version set to ${versionName} (versionCode ${versionCode})`);
