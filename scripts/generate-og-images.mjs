import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const games = [
  ["pd", [21, 94, 117]],
  ["stag-hunt", [91, 107, 53]],
  ["battle-of-the-sexes", [124, 63, 103]],
  ["chicken", [180, 83, 9]],
  ["matching-pennies", [71, 85, 105]],
  ["iterated-pd", [35, 107, 87]],
];
const width = 1200;
const height = 630;

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

function image([slug, color]) {
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const offset = y * (width * 3 + 1);
    rows[offset] = 0;
    for (let x = 0; x < width; x += 1) {
      const stripe = ((Math.floor(x / 75) + Math.floor(y / 63)) % 2) * 18;
      const glow = Math.round((x / width) * 30 + (y / height) * 18);
      const pixel = offset + 1 + x * 3;
      rows[pixel] = Math.min(255, color[0] + stripe + glow);
      rows[pixel + 1] = Math.min(255, color[1] + stripe + glow);
      rows[pixel + 2] = Math.min(255, color[2] + stripe + glow);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return [
    slug,
    Buffer.concat([
      Buffer.from("89504e470d0a1a0a", "hex"),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(rows)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  ];
}

const out = resolve(import.meta.dirname, "../public/og");
mkdirSync(out, { recursive: true });
for (const definition of games) {
  const [slug, png] = image(definition);
  writeFileSync(resolve(out, `${slug}.png`), png);
}
