// Erzeugt die App-Icons (Pixel-Goldmünze) als PNG ohne Abhängigkeiten. Aufruf: npm run make-icons
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// 16×16-Pixelbild: . Hintergrund, o Rand, g Gold, h Glanz, d Schatten
const ART = [
  '................',
  '.....oooooo.....',
  '...oogggggdoo...',
  '..oghhgggggddo..',
  '..ohhggggggddo..',
  '.oghgggoogggddo.',
  '.ogggggoogggddo.',
  '.ogggggoogggddo.',
  '.ogggggoogggddo.',
  '.ogggggoogggddo.',
  '.ogggggoogggddo.',
  '..ogggggggggdo..',
  '..oggggggggddo..',
  '...oogggggdoo...',
  '.....oooooo.....',
  '................',
];
const COLORS = { '.': [93, 156, 59], o: [122, 74, 0], g: [249, 207, 58], h: [255, 246, 194], d: [201, 138, 6] };

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = COLORS[ART[Math.floor((y * 16) / size)][Math.floor((x * 16) / size)]];
      const i = y * (size * 3 + 1) + 1 + x * 3;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 bit, RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('icons', { recursive: true });
for (const size of [180, 192, 512]) writeFileSync(`icons/icon-${size}.png`, png(size));
console.log('icons/icon-{180,192,512}.png geschrieben');
