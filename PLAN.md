# PLAN — Bahriddin's personal website

Reference: otabek.io (see [ANALYSIS.md](ANALYSIS.md)). Status: **waiting for approval — no code
written yet.**

## Decisions I need from you

These four change what gets built. My recommendation is first in each.

1. **Admin login.** Recommended: **GitHub OAuth**, locked to your GitHub account (`bahriddeen`) by
   numeric user id. No password to store or reset. Alternatives: email + password (hash kept in
   an env var), or magic link (needs an email-sending service, so I'd avoid it).
2. **Where content lives.** Recommended: **Postgres (Neon, through the Vercel Marketplace) +
   Vercel Blob for images**. Both have free tiers that a personal blog will not exceed, but they
   are services the reference does not visibly use, so this needs your OK. Alternative with zero
   extra services: the admin commits Markdown files to this GitHub repo through the GitHub API
   and Vercel rebuilds (publishing takes about a minute; scheduling is clumsier).
3. **Home page.** The reference home is only an activity calendar, and on the live site it is
   empty. It has nowhere for your bio. Recommended: a short intro (name, "SWE | Building Sakina,
   an app for Muslims", social links) above the calendar, and fill the calendar automatically
   from your published posts and talks. Alternative: copy the reference exactly (calendar only).
4. **Extra components from spell.sh and 21st.dev** (your follow-up message). Proposed set is in
   [Extra components](#extra-components). They are copy-in shadcn-registry components written for
   Tailwind v4, and several need the `motion` package. I would port them to this project's
   Tailwind 3.4 and keep them CSS-only where possible. Need your OK on the list and on `motion`
   if a chosen component can't be done without it.

## Stack

Same as the reference unless noted.

| Area | Choice | Same as reference? |
|---|---|---|
| Framework | Next.js 16, **Pages Router**, React 19, TypeScript | Yes (TypeScript is Inferred) |
| Styling | Tailwind CSS 3.4 + `@tailwindcss/typography`, class-based dark mode, the reference's custom keyframes and easings | Yes |
| Font | Figtree via `next/font/google` | Yes |
| Icons | `@phosphor-icons/react` | Yes (Inferred) |
| Helpers | `clsx`, `tailwind-merge`, `react-intersection-observer` | Yes (Inferred) |
| Math | KaTeX | Yes |
| Hosting | **Vercel** | No — reference is on Cloudflare via OpenNext; you asked for Vercel |
| Rendering | Static generation with ISR; on-demand revalidation when the admin saves | Reference is SSG; ISR is added so the admin can publish without a redeploy |

**New dependencies — need your approval** (the reference stores posts as HTML, so it has no
visible equivalent for these):

| Package | Why |
|---|---|
| `unified`, `remark-parse`, `remark-gfm`, `remark-math`, `remark-rehype`, `rehype-katex`, `rehype-slug`, `rehype-stringify` | Markdown → HTML for posts, the About page and the editor preview |
| `prismjs` | Syntax highlighting with the same token classes the reference uses |
| `next-auth` (Auth.js) | Admin login |
| `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless` | Database access and migrations (only with storage option 2a) |
| `@vercel/blob` | Image upload (only with storage option 2a) |
| `zod` | Validating admin form input on the server |
| `vitest` (dev only) | Unit tests for slug, reading time, Markdown rendering, feed and sitemap output |
| `motion` (maybe) | Only if an approved extra component needs it |

Not included, because each needs a backend or service the request doesn't cover: running code
from posts, quizzes, the newsletter signup, the Coffee and Lectures pages, the Uzbek locale and
language switch. Analytics: none by default; Vercel Web Analytics is one line to add if you want
it (free on Hobby, but a new service — your call).

## What matches the reference and what changes

**Matched:** page shell, header with "Blog" + "More" dropdown, footer, floating theme toggle and
back-to-top, all colours, type sizes, spacing, radii, shadows, breakpoints and motion from
ANALYSIS §2–§5; the blog index (tilted featured cards with detail panel + hairline list); the
post page (progress bar, back link, date · reading time, share buttons, cover wash, prose
styles, code blocks with copy button, tables, quotes, math); the talks page (filter chips, card
grid, inline YouTube player with "Up next"); the 404 page; the ⌘K search palette; Markdown
mirrors, `llms.txt`, RSS, sitemap, JSON-LD and meta tags.

**Changed on purpose:**

| Change | Reason |
|---|---|
| English only; no EN/UZ switch, no `/uz` routes, no hreflang | Your site language |
| "More" menu contains About and Talks only | Lectures and Coffee are out of scope |
| "Enjoying the content?" cards point to your Telegram and GitHub instead of Buy Me a Coffee | Your links |
| Tags shown as small chips under the post title | The reference stores tags but never displays them; you asked for tag management |
| Talks get `event` and optional custom `thumbnail` fields | Your spec; the reference has neither |
| Markdown is served only for `.md` URLs and `Accept: text/markdown` — no user-agent sniffing | The reference's sniffing sends raw Markdown to people using AI-branded browsers |
| Visible focus rings; "More" is a real button with menu semantics; icon buttons get labels; search dialog uses the site font; dropdown follows dark theme; no horizontal overflow at 768 | Reference bugs found in ANALYSIS §4 and §8; also needed for the keyboard-navigation requirement |
| Images resized through `next/image` with explicit dimensions | The reference ships 2–4 MB originals; this is the main Lighthouse gap |
| Per-post OG image falls back to a generated card when a post has no cover | Reference uses static images only |
| No newsletter envelope, no code "Run" button, no quizzes | Need backends that are not part of this request |
| The extra agent files (`api-catalog`, `openapi.json`, `auth.md`, WebMCP script) are skipped | They describe public APIs this site won't have |

### Extra components

Proposed additions, all optional. Source code is copied into `components/extra/` and adapted;
I'll check each component's licence before copying and list anything unclear for you.

| Component | Source | Where |
|---|---|---|
| Marquee | spell.sh `marquee` | Home, under the intro: a slow strip of the tools you work with (placeholder list until you give me one) |
| Tilt Card | spell.sh | A "Sakina" project card on Home and About (placeholder copy and image) |
| Blur Reveal or Words Stagger text | spell.sh | Entrance of the one-line bio on Home |
| One background or card effect | 21st.dev (Backgrounds / Cards) | Behind the 404 numeral or the Sakina card — I'll propose a specific one with its link during the build |

The spell.sh marquee lists `motion` as a dependency but its animation is plain CSS keyframes, so
it ports without it.

## Folder structure

```
personal-website/
├─ ANALYSIS.md  PLAN.md  README.md
├─ analysis/reference/          # reference screenshots + data (git-ignored)
├─ public/                      # favicon, default OG image, robots.txt
├─ src/
│  ├─ pages/
│  │  ├─ _app.tsx  _document.tsx  404.tsx
│  │  ├─ index.tsx  about.tsx  talks.tsx
│  │  ├─ blogs/index.tsx  blogs/[slug].tsx
│  │  ├─ admin/                 # index (posts), posts/new, posts/[id], talks, about, settings, login
│  │  └─ api/
│  │     ├─ auth/[...nextauth].ts
│  │     ├─ admin/              # posts, talks, about, settings, upload, revalidate
│  │     ├─ md/[[...path]].ts   # Markdown mirrors (reached through rewrites)
│  │     ├─ og.tsx              # fallback OG image
│  │     └─ feed.ts  sitemap.ts  llms.ts  llms-full.ts
│  ├─ components/
│  │  ├─ layout/                # Shell, Header, NavDropdown, Footer, ThemeToggle, BackToTop, Seo, JsonLd
│  │  ├─ blog/                  # FeaturedCards, PostRow, PostHeader, ReadingProgress, ShareButtons, CodeBlock, Prose
│  │  ├─ talks/                 # TalkCard, TalkPlayer, FilterChips
│  │  ├─ home/                  # Intro, ActivityCalendar
│  │  ├─ search/                # CommandPalette
│  │  ├─ ui/                    # Button, SocialTile, SupportCard, Tooltip, Modal
│  │  ├─ admin/                 # MarkdownEditor, PostForm, TalkForm, ImageUpload, AdminShell
│  │  └─ extra/                 # ported spell.sh / 21st.dev components
│  ├─ lib/
│  │  ├─ db/                    # schema.ts, client.ts, queries.ts, seed.ts
│  │  ├─ markdown.ts  reading-time.ts  slug.ts  dates.ts  cn.ts
│  │  ├─ auth.ts  site.ts  seo.ts  feeds.ts  search-index.ts
│  │  └─ theme.tsx
│  └─ styles/globals.css
├─ drizzle/                     # generated migrations
├─ tests/                       # vitest unit tests
├─ tailwind.config.ts  next.config.ts  vercel.json  .env.example
```

## Data storage

Assuming option 2a (Postgres + Blob). With option 2b the same fields become Markdown front
matter in `content/posts/*.md` and JSON files for talks and settings.

**posts**

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `slug` | text, unique | auto-generated from the title, editable; changing it after publish adds a redirect row |
| `title`, `description` | text | |
| `content_md` | text | Markdown source; also what the `.md` mirror serves |
| `cover_url` | text, nullable | Blob URL |
| `tags` | text[] | |
| `status` | `draft` \| `published` | |
| `published_at` | timestamptz, nullable | a future value on a published post = **scheduled** |
| `created_at`, `updated_at` | timestamptz | `updated_at` feeds `dateModified` and sitemap `lastmod` |

**talks** — `id`, `title`, `event`, `date`, `video_url`, `thumbnail_url` (nullable; defaults to
the YouTube thumbnail when the link is a YouTube URL), `type` (`talk` \| `podcast` \| `video`),
`duration` (optional), `description` (optional).

**pages** — one row, `about`: `content_md`, `updated_at`.

**settings** — one row of JSON: site title, bio line, social links, default description, default
OG image, "support" card links.

**redirects** — `from_slug`, `to_slug` (so edited slugs don't break links).

**Publishing rule:** a post is public when `status = 'published'` and `published_at <= now()`.
Public pages are statically generated and revalidated (a) immediately when the admin saves,
through `res.revalidate()`, and (b) every 5 minutes, which is what makes a scheduled post appear
on time without a cron job. Drafts are viewable only by you at `/blogs/<slug>?preview=1` while
logged in.

**Images:** uploaded from the editor (button, drag-and-drop or paste) to Vercel Blob; the editor
inserts `![alt](url)`. Limits: images only, 5 MB each.

## Auth

- Auth.js with the GitHub provider. The sign-in callback rejects every account except the one
  whose GitHub id matches `ADMIN_GITHUB_ID`.
- JWT sessions in an HTTP-only cookie; no user table.
- Every `/admin/*` page checks the session in `getServerSideProps`; every `/api/admin/*` route
  checks it again and validates input with zod. State-changing routes accept POST/PUT/DELETE only
  and verify the request origin.
- `/admin` is `noindex`, absent from the sitemap, disallowed in robots.txt.
- You will need to create a GitHub OAuth app (2 minutes; steps will be in the README). I can't
  create it for you.

## Admin features

| Screen | What it does |
|---|---|
| Posts | Table of all posts with status (Draft / Scheduled / Published), date, quick filters, "New post" |
| Post editor | Split view: Markdown on the left, live preview on the right using the exact public post styles. Fields: title, slug (auto, editable, uniqueness check), description, tags, cover upload, publish date/time. Actions: Save draft, Publish now, Schedule, Unpublish, Preview, Delete (with confirmation). Unsaved-changes warning. |
| Talks | List + form: title, event, date, video link, thumbnail (upload or auto from YouTube), type |
| About | Markdown editor with live preview |
| Settings | Site title, bio, social links, SEO defaults (description, OG image) |

## Deployment

- Vercel project connected to the GitHub repo; `main` deploys to production, branches get
  previews.
- Environment variables (documented in `.env.example`): `NEXT_PUBLIC_SITE_URL`, `DATABASE_URL`,
  `BLOB_READ_WRITE_TOKEN`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GITHUB_ID`, `GITHUB_SECRET`,
  `ADMIN_GITHUB_ID`.
- `vercel.json` / `next.config.ts`: rewrites for `*.md`, `/feed.xml`, `/sitemap.xml`,
  `/llms.txt`, `/llms-full.txt`; long-cache headers for static assets; allowed remote image
  hosts (Blob, `img.youtube.com`).
- Database migrations run with `drizzle-kit`; a seed script inserts three placeholder posts and
  two placeholder talks.
- I will not create the Vercel project, the database, or the OAuth app, and will not deploy,
  without you asking — those act on your accounts.
- Your domain is unknown; everything reads it from `NEXT_PUBLIC_SITE_URL`.

## Build order

One commit per step (the folder is not a git repository yet; step 0 creates it).

0. `git init`, Next.js + TypeScript + Tailwind scaffold, `.gitignore` (including
   `analysis/reference/`), lint and format config.
1. **Design tokens and base layout** — Tailwind config (zinc palette usage, keyframes, easings,
   typography overrides), Figtree, global CSS, theme provider + no-flash script, page shell.
2. **Shared components** — Header and dropdown, Footer, ThemeToggle, BackToTop, Button, SocialTile,
   SupportCard, Tooltip, Modal, Seo/JsonLd.
3. **Data layer** — schema, migrations, queries, seed (3 placeholder posts, 2 placeholder talks,
   placeholder About and settings).
4. **Public pages** — Home (intro + activity calendar), About, Talks (filters, cards, player),
   404, ⌘K search.
5. **Blog rendering** — index (featured cards + list), post page, Markdown pipeline, code blocks,
   math, tables, tags, reading time, share buttons, progress bar.
6. **Markdown mirrors and feeds** — `.md` routes, `Accept` negotiation, `llms.txt`,
   `llms-full.txt`, RSS, sitemap, robots.txt, OG images.
7. **Admin** — auth, posts CRUD with editor, drafts, scheduling, image upload, talks, About,
   settings, revalidation.
8. **Extra components** — whichever of the spell.sh / 21st.dev set you approve.
9. **Deployment config** — `vercel.json`, env example, README.

Placeholders will be visibly marked (for example "PLACEHOLDER — replace in Admin → About") and
listed in the README. None of the reference's text, photos, logo or name will be used.

## Verification (Phase 4)

- Screenshots of the new site at 375 / 768 / 1280 / 1920 in both themes with the same capture
  script, placed side by side with `analysis/reference/pages/`; every visible difference listed
  and either fixed or explained.
- Lighthouse on Home and one post, mobile and desktop. Targets, at or above the reference:
  Home ≥ 99 / 93 / 81 / 100, Post ≥ 90 / 91 / 77 / 92 (performance / accessibility / best
  practices / SEO). Expected to beat it clearly on the post page because of image handling.
- Keyboard pass on every page in both themes: tab order, visible focus, dropdown, search palette,
  talk player, theme toggle.
- Admin end to end: log in, create a draft, upload an image, preview, schedule, publish, edit,
  delete — checked on the public pages, the `.md` mirror, the feed and the sitemap.
- Unit tests green.
- README: run locally, deploy, add content.

## Open items that don't block the build

- More social links (your list ended with "…"): placeholders until you send them.
- Profile photo, About copy, Sakina description and link, list of tools for the marquee:
  placeholders.
- Production domain.
