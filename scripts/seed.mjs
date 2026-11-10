// Insert placeholder content so every page renders: 3 posts, 2 talks, the About page
// and an empty settings row (defaults from src/lib/site.ts apply until you save Settings).
// Existing rows are never overwritten, so it is safe to run more than once.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { databaseUrl } from './env.mjs';

function parseFrontMatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error('Missing front matter');
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    meta[key] = line
      .slice(i + 1)
      .trim()
      .replace(/^"(.*)"$/, '$1');
  }
  return { meta, body: m[2].trim() + '\n' };
}

const pool = new pg.Pool({ connectionString: databaseUrl(), max: 1 });

try {
  const postsDir = path.join('seed', 'posts');
  let insertedPosts = 0;
  for (const file of readdirSync(postsDir).filter((f) => f.endsWith('.md'))) {
    const { meta, body } = parseFrontMatter(readFileSync(path.join(postsDir, file), 'utf8'));
    const tags = (meta.tags || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const res = await pool.query(
      `INSERT INTO posts (slug, title, description, content_md, cover_url, tags, status, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'published', $7)
       ON CONFLICT (slug) DO NOTHING`,
      [meta.slug, meta.title, meta.description, body, meta.cover || null, tags, `${meta.date}T09:00:00Z`],
    );
    insertedPosts += res.rowCount;
  }

  const talks = [
    {
      title: 'PLACEHOLDER talk — replace me in Admin → Talks',
      event: 'Placeholder Conf 2026',
      date: '2026-09-05',
      // "Big Buck Bunny" (Blender Foundation, CC BY) stands in for a real recording.
      videoUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      thumbnailUrl: null,
      type: 'talk',
      duration: '10:35',
      description: 'Placeholder entry with a YouTube link, so the inline player can be checked.',
    },
    {
      title: 'PLACEHOLDER podcast episode — replace me',
      event: 'Placeholder Podcast',
      date: '2026-06-18',
      videoUrl: 'https://example.com/placeholder-episode',
      thumbnailUrl: '/placeholders/talk-1280x720.jpg',
      type: 'podcast',
      duration: '42:10',
      description: 'Placeholder entry with a custom thumbnail and a non-YouTube link.',
    },
  ];
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM talks');
  let insertedTalks = 0;
  if (rows[0].n === 0) {
    for (const t of talks) {
      await pool.query(
        `INSERT INTO talks (title, event, date, video_url, thumbnail_url, type, duration, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [t.title, t.event, t.date, t.videoUrl, t.thumbnailUrl, t.type, t.duration, t.description],
      );
      insertedTalks += 1;
    }
  }

  await pool.query(
    `INSERT INTO pages (slug, content_md) VALUES ('about', $1) ON CONFLICT (slug) DO NOTHING`,
    [readFileSync(path.join('seed', 'about.md'), 'utf8')],
  );
  await pool.query(`INSERT INTO settings (id, data) VALUES (1, '{}'::jsonb) ON CONFLICT (id) DO NOTHING`);

  console.log(`Seeded: ${insertedPosts} post(s), ${insertedTalks} talk(s), about page, settings.`);
} catch (err) {
  console.error('Seeding failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
