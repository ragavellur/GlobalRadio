import { readFileSync } from 'fs';
import sharp from 'sharp';

const svg = readFileSync('public/icon.svg');

const sizes = [48, 72, 96, 128, 144, 152, 192, 384, 512];

for (const size of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(`public/icon-${size}.png`);
  console.log(`Created public/icon-${size}.png (${size}x${size})`);
}

await sharp(svg).resize(48, 48).png().toFile('public/favicon.png');
console.log('Created public/favicon.png');
