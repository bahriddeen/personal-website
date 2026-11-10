/** Upload checks: what kind of image a file really is, and how large it is in pixels. */

export const IMAGE_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
} as const;

export type ImageMime = keyof typeof IMAGE_TYPES;

// Vercel rejects request bodies over 4.5 MB, so the limit sits just below that.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const ascii = (buf: Buffer, start: number, end: number) => buf.toString('latin1', start, end);

/**
 * Identify an image from its first bytes. The Content-Type header is whatever the client
 * says it is; this is what gets trusted. SVG is deliberately not accepted (it can carry
 * scripts).
 */
export function sniffImageType(buf: Buffer): ImageMime | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && ascii(buf, 1, 4) === 'PNG') return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (ascii(buf, 0, 4) === 'GIF8') return 'image/gif';
  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WEBP') return 'image/webp';
  if (ascii(buf, 4, 8) === 'ftyp' && /^(avif|avis)$/.test(ascii(buf, 8, 12))) return 'image/avif';
  return null;
}

/** Pixel dimensions for PNG, GIF, JPEG and WebP; null when they cannot be read (e.g. AVIF). */
export function imageSize(buf: Buffer, type: ImageMime): { width: number; height: number } | null {
  try {
    if (type === 'image/png' && buf.length >= 24) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (type === 'image/gif' && buf.length >= 10) {
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    }
    if (type === 'image/webp' && buf.length >= 30) {
      const chunk = ascii(buf, 12, 16);
      if (chunk === 'VP8X') {
        return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
      }
      if (chunk === 'VP8 ') {
        return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      }
      if (chunk === 'VP8L') {
        const bits = buf.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
    }
    if (type === 'image/jpeg') {
      // Walk the segments until a start-of-frame marker, which holds the size.
      let offset = 2;
      while (offset + 9 < buf.length) {
        if (buf[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = buf[offset + 1];
        const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
        if (isSof) {
          return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5) };
        }
        offset += 2 + buf.readUInt16BE(offset + 2);
      }
    }
  } catch {
    // Truncated or malformed header: fall through.
  }
  return null;
}
