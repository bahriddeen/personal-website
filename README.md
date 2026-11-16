# Bahriddin — personal website

Personal site with a blog, talks, an about page and a private admin for writing.
Built with Next.js 16 (Pages Router), React 19, Tailwind CSS 3 and Postgres; deployed on Vercel.

- [ANALYSIS.md](ANALYSIS.md) — how the design reference (otabek.io) is built
- [PLAN.md](PLAN.md) — the plan this site was built from
- [VERIFICATION.md](VERIFICATION.md) — test results, Lighthouse scores, and every visible
  difference from the reference

## Run locally

You need Node.js 22 or newer and Docker (for the local database).

```bash
npm install
```

```bash
cp .env.example .env.local
```

Open `.env.local` and set `NEXTAUTH_SECRET` (generate one with `openssl rand -base64 32`).
To use the admin before you have a GitHub OAuth app, also set `DEV_ADMIN_LOGIN=true`.

```bash
npm run db:up
```

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev
```

The site is at http://localhost:3000 and the admin at http://localhost:3000/admin.

`db:seed` adds three placeholder posts, two placeholder talks and a placeholder About page.
It never overwrites existing rows, so it is safe to run again.

If you would rather not use Docker, create a free Neon database and put its connection string
in `DATABASE_URL`; skip `npm run db:up`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript checks |
| `npm run db:up` / `npm run db:down` | Start or stop the local Postgres container |
| `npm run db:generate` | Create a migration after changing `src/lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Insert placeholder content |

## Deploy to Vercel

1. **Push the repository to GitHub** and import it in Vercel. `vercel.json` sets the build
   command to `npm run build:vercel`, which applies database migrations and then builds.
2. **Add a database.** In the Vercel project: Storage → Create → Neon (Postgres). This sets
   `DATABASE_URL` for you. The free tier is enough for a personal blog.
3. **Add image storage.** Storage → Create → Blob. This sets `BLOB_READ_WRITE_TOKEN`.
   Without it, image uploads in the admin return an error (uploads to disk only work locally).
4. **Create a GitHub OAuth app** at https://github.com/settings/developers → New OAuth App.
   - Homepage URL: your site URL
   - Authorization callback URL: `https://<your-domain>/api/auth/callback/github`
   - Copy the client ID and generate a client secret.
5. **Find your numeric GitHub id**: open `https://api.github.com/users/bahriddeen` and copy `id`.
6. **Set environment variables** in Vercel (Settings → Environment Variables):

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-domain>` — no trailing slash |
   | `NEXTAUTH_URL` | same as above |
   | `NEXTAUTH_SECRET` | output of `openssl rand -base64 32` |
   | `GITHUB_ID`, `GITHUB_SECRET` | from the OAuth app |
   | `ADMIN_GITHUB_ID` | your numeric GitHub id — the only account allowed into `/admin` |
   | `RESEND_API_KEY` | from [resend.com](https://resend.com), after verifying your sending domain |
   | `NEWSLETTER_FROM` | sender on that domain, e.g. `Bahriddin <newsletter@example.com>` |

   Do not set `DEV_ADMIN_LOGIN` in production. It is ignored there anyway.
7. **Deploy.** The first build creates the tables. The site starts empty; either write your
   first post in the admin, or seed the placeholders once from your machine:

   ```bash
   DATABASE_URL="<your Neon connection string>" npm run db:seed
   ```

Preview deployments use the same database unless you give the Preview environment its own
`DATABASE_URL` (Neon can create a branch per preview).

## Add and edit content

Everything is done at `/admin` after signing in with GitHub.

- **Posts** — New post opens the editor: Markdown on the left, live preview on the right.
  - *Save draft* keeps it private. *Preview* shows a saved draft as it will look on the site.
  - *Publish* makes it public at once. Set a future *Publish date* first and the button
    becomes *Schedule*; the post appears on its own within five minutes of that time.
  - The slug is created from the title and can be edited. If you change the slug of a
    published post, the old address redirects to the new one.
  - Images: use the Image button, paste, or drop a file onto the text (PNG, JPEG, WebP, GIF,
    AVIF, up to 4 MB). The cover image is used on the blog index and in link previews.
  - Tags are comma-separated.
- **Talks** — title, event, date, video link, type and optional thumbnail. YouTube links play
  on the page and get their thumbnail automatically; other links open in a new tab.
- **About** — the About page in Markdown.
- **Newsletter** — subscriber counts, latest signups, and a *Send to subscribers* button for
  each published post (each post can be sent once). People sign up from the form under every
  post, on `/blogs` and on `/newsletter`; they confirm by email first (double opt-in), and every
  email has a one-click unsubscribe link. Without `RESEND_API_KEY`, production saves signups
  as waiting and Admin → Newsletter offers *Send confirmation emails* once email is set up;
  development prints emails to the server log instead.
- **Settings** — site title, bio line, the scrolling strip on the home page, social links,
  the project card, the default description and share image, and the Google booking link for
  `/book`. To get that link: Google Calendar → open the appointment schedule → *Share* → copy
  the `calendar.app.google/…` link. The page follows it and embeds the booking calendar.

Changes appear on the site immediately; there is nothing to redeploy.

### Markdown supported

Headings, bold/italic, links, lists, block quotes, tables, fenced code with syntax
highlighting (` ```ts `, ` ```python `, ` ```sql `, ` ```bash ` and others), inline math
`$a^2$` and display math `$$ … $$`. Raw HTML in Markdown is ignored.

### Placeholders to replace

| Where | What |
|---|---|
| Admin → Posts | Three posts whose titles start with "PLACEHOLDER" |
| Admin → Talks | Two entries whose titles start with "PLACEHOLDER" |
| Admin → About | The whole page, including the placeholder photo |
| Admin → Settings | Project card description and link, the first word of the home page strip ("PLACEHOLDER"), default share image, any extra social links |
| `public/placeholders/project-1200x800.jpg` | The image on the Sakina card (replace the file, keep the name) |
| `public/og-default.png`, `public/favicon.svg` | Default share image and site icon |

## How it is put together

```
src/pages/            public pages, /admin pages, API routes
src/components/       layout, blog, talks, home, search, admin, extra (ported components)
src/lib/              database access, Markdown rendering, feeds, auth, validation
drizzle/              SQL migrations
scripts/              migrate and seed
seed/                 placeholder content
tests/                unit tests
```

- **Pages are static** and refresh in two ways: at once when you save something in the admin,
  and every five minutes (which is what publishes scheduled posts).
- **Machine-readable output**: every page has a Markdown twin (add `.md`, or `/index.md` for
  home; also returned for `Accept: text/markdown`), plus `/feed.xml`, `/sitemap.xml`,
  `/robots.txt`, `/llms.txt` and `/llms-full.txt`.
- **`robots.txt`** allows search and AI answers but asks not to be used for model training
  (`Content-Signal`). Change it in `robotsTxt()` in `src/lib/feeds.ts` if you prefer otherwise.
- **Search**: press ⌘K / Ctrl+K anywhere.
- **Buy Me a Coffee**: a card in the "Want more like this?" block and a tile under "Follow me on". The address is
  a social link in Admin → Settings.
- **Extra components** in `src/components/extra/` are adapted from spell.sh (Marquee, Tilt
  Card, Blur Reveal) and from Magic UI's Dot Pattern as listed on 21st.dev (MIT). spell.sh
  does not state a licence on its site; the versions here are rewritten for this project and
  credit the originals in their file headers. Check with the author if that matters to you.

## Differences from the plan

- Database driver is `pg` instead of `@neondatabase/serverless`, so the same code talks to
  local Postgres and to Neon.
- Draft preview lives at `/admin/preview/<id>` rather than `/blogs/<slug>?preview=1`.
- Upload limit is 4 MB, not 5 MB (Vercel caps request bodies at 4.5 MB).
- `docker-compose.yml` was added for the local database.

## Known gaps

- GitHub sign-in has not been tested end to end (it needs your OAuth app). Test the first
  login after deploying.
- Lighthouse performance for the home page on mobile is 97 against the reference's 99.
  This was accepted to keep the project card at the top of the page; VERIFICATION.md has the
  cause and the two ways to close it later.
- No analytics. Vercel Web Analytics can be added later if you want it.
