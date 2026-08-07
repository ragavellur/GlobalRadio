import { readFileSync } from 'fs';
import { mkdirSync } from 'fs';
import sharp from 'sharp';

const svg = readFileSync('public/icon.svg');

const res = 'android/app/src/main/res';

const legacySizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const fgSizes = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

for (const [dpi, size] of Object.entries(legacySizes)) {
  await sharp(svg).resize(size, size).png().toFile(`${res}/mipmap-${dpi}/ic_launcher.png`);
  await sharp(svg).resize(size, size).png().toFile(`${res}/mipmap-${dpi}/ic_launcher_round.png`);
  const fg = size * (fgSizes[dpi] / legacySizes[dpi]) * 0.68;
  const canvas = fgSizes[dpi];
  await sharp({
    create: { width: canvas, height: canvas, channels: 4, background: { r: 10, g: 10, b: 10, alpha: 1 } },
  })
    .composite([{ input: await sharp(svg).resize(Math.round(fg), Math.round(fg)).png().toBuffer(), left: Math.round((canvas - fg) / 2), top: Math.round((canvas - fg) / 2) }])
    .png()
    .toFile(`${res}/mipmap-${dpi}/ic_launcher_foreground.png`);
  console.log(`Generated mipmap-${dpi} icons (${size}px)`);
}

const splashDirs = [
  'drawable',
  'drawable-land-mdpi',
  'drawable-land-hdpi',
  'drawable-land-xhdpi',
  'drawable-land-xxhdpi',
  'drawable-land-xxxhdpi',
  'drawable-port-mdpi',
  'drawable-port-hdpi',
  'drawable-port-xhdpi',
  'drawable-port-xxhdpi',
  'drawable-port-xxxhdpi',
];

for (const dir of splashDirs) {
  mkdirSync(`${res}/${dir}`, { recursive: true });
  const [w, h] = dir.startsWith('drawable-land') ? [1024, 512] : [512, 1024];
  await sharp({
    create: { width: w, height: h, channels: 4, background: { r: 10, g: 10, b: 10, alpha: 1 } },
  })
    .composite([{ input: await sharp(svg).resize(240, 240).png().toBuffer(), left: Math.round((w - 240) / 2), top: Math.round((h - 240) / 2) }])
    .png()
    .toFile(`${res}/${dir}/splash.png`);
}
console.log('Generated splash screens');
