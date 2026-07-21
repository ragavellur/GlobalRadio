import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0);
  }
  return ~c >>> 0;
}

function createPNG(width, height, drawPixel) {
  const raw = [];
  for (let y = 0; y < height; y++) {
    raw.push(0);
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixel(x, y, width, height);
      raw.push(r, g, b, a);
    }
  }
  const data = deflateSync(Buffer.from(raw));

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [];

  function makeChunk(type, payload) {
    const len = payload.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4);
    payload.copy(buf, 8);
    const crcField = Buffer.alloc(4);
    const crcInput = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
    crcField.writeUInt32BE(crc32(crcInput), 0);
    crcField.copy(buf, 8 + len);
    chunks.push(buf);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  ihdr[9] = 6;  ihdr[10] = 0;  ihdr[11] = 0;  ihdr[12] = 0;
  makeChunk('IHDR', ihdr);
  makeChunk('IDAT', data);
  makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ...chunks]);
}

const sizes = [192, 512];

for (const size of sizes) {
  const png = createPNG(size, size, (x, y, w) => {
    const cx = w / 2, cy = w / 2, r = w * 0.42;
    const dx = x - cx, dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= r) return [0, 200, 100, 255];
    return [0, 0, 0, 0];
  });
  writeFileSync(`public/icon-${size}.png`, png);
  console.log(`Created public/icon-${size}.png (${size}x${size})`);
}
