// Test support: a REAL, valid PNG of exactly the size asked for (so a test can check 399, 400 and 800 pixels precisely). Grayscale, compressed: about 1 KB however big.
import zlib from 'node:zlib';

export function makePng(width, height, shade = 200) {
  const row = Buffer.alloc(width + 1, shade); row[0] = 0;                       // filter byte 0 + the pixels
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 0;   // 8 bit, grayscale
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
