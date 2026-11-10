import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { put } from '@vercel/blob';
import type { NextApiRequest } from 'next';
import { IMAGE_TYPES, MAX_UPLOAD_BYTES, imageSize, sniffImageType } from '@/lib/admin/images';
import { withAdmin } from '@/lib/admin/server';
import { slugify } from '@/lib/format';

// The file arrives as the raw request body, so Next's JSON parser is switched off.
export const config = { api: { bodyParser: false } };

class TooLarge extends Error {}

async function readBody(req: NextApiRequest, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > limit) throw new TooLarge();
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

export default withAdmin({
  POST: async (req, res) => {
    let body: Buffer;
    try {
      body = await readBody(req, MAX_UPLOAD_BYTES);
    } catch (err) {
      if (err instanceof TooLarge) {
        return res.status(413).json({ error: 'That image is larger than 4 MB. Resize or compress it and try again.' });
      }
      throw err;
    }
    if (body.length === 0) return res.status(400).json({ error: 'No file was received.' });

    const type = sniffImageType(body);
    if (!type) {
      return res.status(415).json({ error: 'Only PNG, JPEG, WebP, GIF and AVIF images can be uploaded.' });
    }

    // File name: readable stem + random suffix + pixel size. The size lets pages reserve
    // the right space for the image before it loads (see src/lib/markdown.ts).
    const original = decodeURIComponent(String(req.headers['x-filename'] ?? 'image'));
    const stem = slugify(original.replace(/\.[^.]+$/, '')) || 'image';
    const dims = imageSize(body, type);
    const suffix = randomBytes(4).toString('hex');
    const name = `${stem}-${suffix}${dims ? `-${dims.width}x${dims.height}` : ''}.${IMAGE_TYPES[type]}`;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`uploads/${name}`, body, {
        access: 'public',
        contentType: type,
        addRandomSuffix: false,
      });
      return res.status(201).json({ url: blob.url, width: dims?.width ?? null, height: dims?.height ?? null });
    }

    if (process.env.NODE_ENV !== 'production') {
      // Local development without a Blob token: keep uploads on disk under public/.
      const dir = path.join(process.cwd(), 'public', 'uploads');
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name), body);
      return res.status(201).json({ url: `/uploads/${name}`, width: dims?.width ?? null, height: dims?.height ?? null });
    }

    return res.status(503).json({
      error: 'Image storage is not set up. Add a Vercel Blob store to the project (BLOB_READ_WRITE_TOKEN).',
    });
  },
});
