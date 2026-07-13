/**
 * Generates the project-owned CacheWraith source icon (1024x1024 PNG) with
 * zero dependencies: pixels are drawn into an RGBA buffer and encoded as a
 * PNG using node:zlib. Run `npx tauri icon src-tauri/icons/source.png`
 * afterwards to produce all platform icon sizes.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 1024;

// ---- tiny PNG encoder ----
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(rgba, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- drawing helpers ----
const img = Buffer.alloc(SIZE * SIZE * 4);

function blend(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || a <= 0) return;
  const i = (y * SIZE + x) * 4;
  const da = img[i + 3] / 255;
  const outA = a + da * (1 - a);
  if (outA <= 0) return;
  img[i] = Math.round((r * a + img[i] * da * (1 - a)) / outA);
  img[i + 1] = Math.round((g * a + img[i + 1] * da * (1 - a)) / outA);
  img[i + 2] = Math.round((b * a + img[i + 2] * da * (1 - a)) / outA);
  img[i + 3] = Math.round(outA * 255);
}

function insideBody(x, y) {
  const cx = 512;
  const domeCy = 460;
  const domeR = 300;
  const bottom = 730;
  const hem = bottom + 42 * Math.abs(Math.sin((Math.PI * (x - cx + domeR)) / 150));
  if (y < domeCy) {
    const dx = x - cx;
    const dy = y - domeCy;
    return dx * dx + dy * dy <= domeR * domeR;
  }
  return Math.abs(x - cx) <= domeR && y <= hem;
}

function insideEllipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

// ---- render ----
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    // Soft cyan/purple glow behind the ghost.
    const gd = Math.hypot(x - 512, y - 500);
    if (gd < 480) {
      const t = 1 - gd / 480;
      blend(x, y, 120, 150, 255, 0.28 * t * t);
    }

    if (insideBody(x, y)) {
      // Body with a slight vertical shade.
      const shade = 1 - Math.max(0, (y - 300) / 1400);
      blend(x, y, Math.round(191 * shade + 20), Math.round(168 * shade + 20), 255, 1);
      // Edge tint for readability on light wallpapers.
      const nearEdge =
        !insideBody(x - 14, y) ||
        !insideBody(x + 14, y) ||
        !insideBody(x, y - 14) ||
        !insideBody(x, y + 14);
      if (nearEdge) blend(x, y, 122, 100, 220, 0.85);
    }

    // Eyes.
    if (insideEllipse(x, y, 424, 430, 42, 60) || insideEllipse(x, y, 600, 430, 42, 60)) {
      blend(x, y, 43, 27, 77, 1);
    }
    // Eye highlights.
    if (insideEllipse(x, y, 438, 408, 13, 13) || insideEllipse(x, y, 614, 408, 13, 13)) {
      blend(x, y, 255, 255, 255, 0.92);
    }
    // Mouth.
    if (insideEllipse(x, y, 512, 540, 26, 32)) {
      blend(x, y, 43, 27, 77, 1);
    }
    // Blush.
    if (insideEllipse(x, y, 344, 500, 34, 20) || insideEllipse(x, y, 680, 500, 34, 20)) {
      blend(x, y, 255, 154, 213, 0.55);
    }
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'src-tauri', 'icons', 'source.png');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, encodePng(img, SIZE, SIZE));
console.log(`wrote ${out}`);
