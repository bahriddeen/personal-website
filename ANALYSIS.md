# ANALYSIS — otabek.io (design and architecture reference)

Analysed on 2026-11-10. Reference build id `rQYEuXj6YAGjx1j8Vil0t`.

**How this was measured.** The reference serves Markdown instead of HTML to any client whose
user agent looks like an AI agent (see §7), which includes Claude's in-app browser. All HTML
inspection was therefore done with a local headless Google Chrome (via `puppeteer-core`) using a
standard desktop Chrome user agent, plus `curl` for headers and static files, and Lighthouse 13.6
for the baseline. Raw evidence is in [`analysis/reference/`](analysis/reference/):

- `pages/` — full-page screenshots, 7 pages × 4 widths × 2 themes (56 files)
- `states/` — interaction-state screenshots (dropdown, search, hover, focus, player, …)
- `data/computed-styles.json` — computed styles read from the live DOM, light and dark
- `data/network_*.json` — per-page request logs; `data/ref_*.json` — Lighthouse reports

Labels used below: **Observed** = read directly from headers, markup, CSS, JS bundles or computed
styles. **Inferred** = a conclusion drawn from observed evidence. **Unknown** = could not be
determined from public output.

> `analysis/reference/` contains screenshots of another person's site and photos. It is for local
> comparison only and should stay out of the public repo (see PLAN.md).

---

## 1. Tech stack

| Layer | Finding | Evidence | Confidence |
|---|---|---|---|
| Framework | Next.js **16.4.2**, **Pages Router** | `x-powered-by: Next.js`; `/_next/static/chunks/pages/_app-*.js`, `pages/index-*.js`, `pages/blogs/[slug]-*.js`; `data-next-head` attributes; `__NEXT_DATA__` with `"page":"/blogs/[slug]"`; version literal `"16.4.2"` in `main-*.js` | Observed (version literal is Inferred to be Next's) |
| UI library | React **19.0.0** | version string in `framework-*.js` | Observed |
| Rendering | Blog index and posts are **SSG** (`getStaticProps`, `"gsp":true`, `__N_SSG`). Home, About, Talks are **automatic static export** with content hard-coded in the page bundle (`"autoExport":true`, empty `pageProps`). Post route has fallback handling (`router.isFallback` branch) and a draft-preview prop (`isDraftPreview`). | `__NEXT_DATA__` on each page; `[slug]` chunk | Observed |
| i18n | Next built-in i18n routing, locales `en` (default) and `uz`; `/uz/...` mirrors | `"locales":["en","uz"]` in `__NEXT_DATA__`; `/uz/blogs/hyperloglog` → 200 | Observed |
| Hosting / CDN | **Cloudflare Workers via OpenNext** (not Vercel) | `server: cloudflare`, `cf-ray`, `x-opennext: 1`, `x-opennext-cache: HIT` | Observed |
| Caching | HTML: `s-maxage=31536000` (+ `stale-while-revalidate=2592000` on SSG pages). Hashed assets: `public, max-age=31536000, immutable`. Markdown mirrors: `s-maxage=3600, stale-while-revalidate=86400` | response headers | Observed |
| CSS | **Tailwind CSS 3.4.17**, class-based dark mode (`:is(.dark *)`), `@tailwindcss/typography` (`prose`), custom keyframes/easings in the Tailwind config | banner `tailwindcss v3.4.17` in CSS; utility classes in markup; `--tw-prose-*` variables | Observed |
| Class helpers | `clsx` + `tailwind-merge` wrapped as `cn()` | `cn=(...e)=>twMerge(clsx(e))` shape in chunk 116 | Inferred from minified shape |
| Fonts | **Figtree** variable (300–900) through `next/font/google`, self-hosted woff2, `font-display: swap`, metric-matched Arial fallback. Code: `"Fira Code","Fira Mono",Menlo,monospace` (not loaded as a webfont, so it falls back to Menlo). 404 numeral uses the system mono stack. KaTeX fonts on posts with math. | `@font-face` rules, `--figtree` variable, `data-next-font="size-adjust"` preload; computed `font-family` | Observed |
| Icons | Phosphor Icons (React) plus hand-inlined Heroicons-style SVG paths | weight map `bold/duotone/fill/light/regular/thin` in bundle; `viewBox="0 0 256 256"` | Inferred |
| Scroll reveal | `react-intersection-observer` (`useInView`, `triggerOnce`) | call shape `{threshold:.2,triggerOnce:!0}`; `IntersectionObserver` in chunk 955 | Inferred |
| Images | `next/image` with blur placeholders. Local post covers are served as the original files (2–3 MB PNGs), so optimisation is effectively off for them; `/_next/image` exists and responds | request log; `/_next/image?url=…` → 200 | Observed |
| Code blocks | `react-simple-code-editor` (editable textarea overlay) + Prism-style `.token` spans; some blocks have a **Run** button | class `npm__react-simple-code-editor__textarea`; `.token` spans | Observed (Prism itself Inferred) |
| Math | KaTeX (CSS + MathML output) | KaTeX `@font-face`, `<math>` in post DOM | Observed |
| Analytics | Google tag via `@next/third-parties` (the request is `gtag/js?id=` with an **empty id**, so GA appears misconfigured) and **Cloudflare Web Analytics** (`static.cloudflareinsights.com/beacon.min.js`) | request log; `GoogleAnalytics` component in `_app` | Observed |
| Third-party hosts | `www.googletagmanager.com`, `static.cloudflareinsights.com`, `img.youtube.com` (talk thumbnails), `miro.medium.com` and `telegra.ph` (older post images), YouTube embed on play | request logs | Observed |
| Site APIs | `POST /api/execute-code`, `/api/execute-problem`, `/api/quiz/validate`, `/api/coffee-invite`, `/api/form/submit`, `/api/addEntry` (newsletter) | `/openapi.json`, bundle strings | Observed |
| CMS / data store | Posts have numeric `id`, `is_published`, bilingual `title`, HTML `content`. Where they are authored and stored is not visible. | `__NEXT_DATA__` | **Unknown** |
| Code execution backend | "configured execution backend"; the Run bar shows `sqlite3 3.36.0` | `/api-docs.md`, DOM | **Unknown** (which service) |

---

## 2. Design tokens

All values below were read from computed styles (`data/computed-styles.json`) and cross-checked
against the compiled CSS. The palette is the stock Tailwind **zinc** scale plus a few accents.

### Colour — light theme

| Role | Value | Tailwind |
|---|---|---|
| Page background | `#ffffff` | `white` |
| Body text default | `#18181b` | `zinc-900` |
| Header / brand text | `#3f3f46` | `zinc-700` |
| Nav link text | `#52525b` | `zinc-600` |
| Section text, headings on index pages | `#27272a` | `zinc-800` |
| Secondary text (dates, meta values, about copy) | `#52525b` | `zinc-600` |
| Muted text (footer, year pill, talk dates, subtitle) | `#71717a` | `zinc-500` |
| Hairline (blog list rows) | `#e4e4e7` | `zinc-200` |
| Chip / pill background | `#f4f4f5` | `zinc-100` |
| Quick-link tile background (404) | `#fafafa` | `zinc-50` |
| Inverse surface (calendar card) | `#27272a`, empty cell `rgba(63,63,70,.5)` | `zinc-800`, `zinc-700/50` |
| Primary button / active filter | bg `#18181b`, text `#fff` | `zinc-900` |
| Prose body | `#3f3f46` | `zinc-700` |
| Prose headings, strong | `#18181b` | `zinc-900` |
| Prose link | `#61829a`, hover `#618e9a`, visited `#6247aa`, visited hover `#4a3786` | custom |
| Blockquote | text `#52525b`, 4px left border `#e4e4e7` | |
| Inline code | bg `#f4f4f5`, text `#18181b` | |
| Selection | `rgba(97,130,154,.3)` on `#18181b` text | custom |
| Reading progress | track `#e4e4e7`, bar gradient `cyan-500 → blue-500` | |
| 404 numeral | gradient `blue-500 → purple-500 → pink-500` clipped to text | |

### Colour — dark theme

| Role | Value | Tailwind |
|---|---|---|
| Page background | `#18181b` | `zinc-900` |
| Body text | `#f4f4f5` | `zinc-100` |
| Brand, nav link, footer text | `#ffffff` | `white` |
| Index headings, list titles and dates | `#d4d4d8` | `zinc-300` |
| Meta values, muted | `#a1a1aa` | `zinc-400` |
| Surfaces (theme button, chips, lang switch) | `#27272a` | `zinc-800` |
| Active chip | `#3f3f46` | `zinc-700` |
| Active filter / primary button (inverted) | bg `#fff`, text `#18181b` | |
| Prose body / lists | `#d4d4d8`; headings `#f4f4f5`; strong `#ececec`; generic `div` `#a8a8a8` | |
| Prose link | `#87c7e0`, hover `#9fdcf5`, visited `#a78fec`, visited hover `#b9a8f0` | custom |
| Blockquote | text `#a1a1aa`, border `#3f3f46` | |
| Inline code | bg `#27272a`, text `#e4e4e7` | |
| Selection | `rgba(135,199,224,.3)` on `#f4f4f5` | |
| Support cards | bg `#1f2937`, border `#374151` | `gray-800/700` |

Code blocks are the same in both themes: container `#282a36` with `1px` border `gray-700`,
text `#e4e4e7`, run bar `#1e1f29` with top border `#44475a`. Token colours: keyword `#cc99cd`,
string `#7ec699`, function/number/boolean `#f08d49`, class-name `#f8c555`, operator `#67cdcc`,
punctuation `#cccccc`, comment `#999999` (these match Prism's "Tomorrow Night" theme — Inferred).

Accent sets: talk badges — Video `red-100/red-700` (dark `red-900/30` / `red-400`), Podcast
`purple-100/purple-700`, Conference `blue-100/blue-700`. Calendar activity types — Misc
`emerald-400`, Life `teal-400`, Work `sky-400`, Blog `blue-400`, Side Project `violet-400`,
Feature `fuchsia-400`. Social tiles — tinted `*-50` background, `*-200` border, coloured glow on
hover (e.g. GitHub `gray-50` / `gray-200` / `0 0 15px rgba(0,0,0,.3)`).

### Typography

Family: `Figtree, "Figtree Fallback", ui-sans-serif, system-ui, sans-serif, emoji…`.
Root 16px, antialiased.

| Element | Size / line-height | Weight | Notes |
|---|---|---|---|
| Brand (site title) | 20 / 28 | 600 | |
| Nav link, dropdown item | 16 / 24 | 500 | |
| Year pill | 12 / 16 | 700 | |
| Calendar card title | 14 / 20 | 700 | letter-spacing 0.7px (`tracking-wider`) |
| Index section title ("Recent Blogs", "Blogs") | 20 / 28 | 500 | |
| Blog list title / date | 16 / 24 · 14 / 20 | 500 · 400 | `text-balance` on title |
| Featured meta label / value | 16 / 24 · 14 / 20 | 700 · 400 | |
| "Read more" button | 14 / 20 | 550 | |
| About `h2` | 30 / 36 | 500 | body 16 / 28, weight 400 |
| Talks `h1` | 30 / 36 | 700 | subtitle 16 / 24 |
| Talk title / badge / date / duration | 16 / 22 · 12 / 16 · 12 / 16 · 12 / 16 | 500 · 500 · 400 · 500 | title `line-clamp-2` |
| Filter chip | 14 / 20 | 500 | |
| Post `h1` | 36 / 40 | 700 | |
| Post `h2` / `h3` / `h4` | 30 / 36 · 24 / 32 · 20 / 28 | 600 | margin-top 1.75em / 1.5em, bottom 0.75em |
| Post body | 16 / 28 | 400 | paragraph margin-bottom 24px |
| Post meta line | 14 / 24.5 | 400 | "date · N min read" |
| Inline code | 14 (0.875em) | 600 | padding 0.2em 0.4em, radius 4px |
| Code block | 14 / 21 | 400 | padding 16px, `white-space: pre-wrap` |
| Table | 14 / 24 | th 600 | cell padding 8px |
| 404 numeral | 120 / 120 (mobile), 180 / 180 (≥640) | 900 | mono |
| Footer | 16 / 24 | 400 | |

### Spacing, radii, shadows, widths

- **Spacing scale:** stock Tailwind 4px scale. Recurring values: header top margin 24px (mobile)
  / 64px (≥640); page gutters 24px (mobile) / 40px (≥640); section vertical margin 80px / 128px
  (About, Talks, 404 use 40px on mobile); footer padding 160px top, 48px bottom; nav link padding
  10 × 16; dropdown item 12 × 16; calendar card padding 28px, cell gap 8px; talk grid gap 24px;
  blog list row `py-2` + 24px bottom margin.
- **Radii:** 4px (inline code, duration tag, kbd), 6px (copy button), 8px (calendar cells, code
  block, social tiles, support cards), 12px (dropdown items, talk thumbnails, post images, 404
  tiles), 16px (nav links, dropdown panel, buttons), 24px (calendar card, blog cover cards,
  modal), 9999px (pills, chips, round buttons).
- **Shadows:** stock Tailwind `shadow-sm`, `shadow-md`, `shadow-lg` (theme button, dropdown with
  `zinc-900/5` tint, play button), `shadow-xl` (calendar card, blog cards), `shadow-2xl` (card
  hover, newsletter panel with `zinc-500/10` tint).
- **Container widths:** main column `max-w-lg` = **512px** (header nav, about, blog list, post,
  404, footer). Calendar card `max-w-sm` = 384px. Featured card row `max-w-min`. Talks is
  full-width with 16px / 48px inner padding. Search dialog ≈ 544px. Talk player meta `max-w-4xl`.
- **Breakpoints:** Tailwind defaults — `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536 —
  plus one arbitrary `min-[400px]` (calendar cell height 32 → 40px). In practice only `sm`,
  `md` (support cards row) and `lg` (talk grid, talks padding) change layout.

---

## 3. Layout at 375 / 768 / 1280 / 1920

Global shell: a CSS grid `min-h-screen grid-rows-[auto_1fr_auto]` — header, main, footer. The
header is not sticky. The content column is centred and 512px wide from 640px up, so **768, 1280
and 1920 look the same except for side whitespace** (Talks is the exception). There is no layout
change above 1024px.

Fixed overlays on every page: theme toggle (48px circle, bottom-right 32px), back-to-top (40px
circle above it, appears after 400px of scroll), newsletter envelope (bottom-left 32px; hidden on
`/blogs/*`), and a blurred decorative blob in the bottom-left corner.

| Page | 375 | 768 | 1280 | 1920 |
|---|---|---|---|---|
| Home | [light](analysis/reference/pages/home_375_light.jpg) · [dark](analysis/reference/pages/home_375_dark.jpg) | [light](analysis/reference/pages/home_768_light.jpg) · [dark](analysis/reference/pages/home_768_dark.jpg) | [light](analysis/reference/pages/home_1280_light.jpg) · [dark](analysis/reference/pages/home_1280_dark.jpg) | [light](analysis/reference/pages/home_1920_light.jpg) · [dark](analysis/reference/pages/home_1920_dark.jpg) |
| About | [light](analysis/reference/pages/about_375_light.jpg) · [dark](analysis/reference/pages/about_375_dark.jpg) | [light](analysis/reference/pages/about_768_light.jpg) · [dark](analysis/reference/pages/about_768_dark.jpg) | [light](analysis/reference/pages/about_1280_light.jpg) · [dark](analysis/reference/pages/about_1280_dark.jpg) | [light](analysis/reference/pages/about_1920_light.jpg) · [dark](analysis/reference/pages/about_1920_dark.jpg) |
| Blogs | [light](analysis/reference/pages/blogs_375_light.jpg) · [dark](analysis/reference/pages/blogs_375_dark.jpg) | [light](analysis/reference/pages/blogs_768_light.jpg) · [dark](analysis/reference/pages/blogs_768_dark.jpg) | [light](analysis/reference/pages/blogs_1280_light.jpg) · [dark](analysis/reference/pages/blogs_1280_dark.jpg) | [light](analysis/reference/pages/blogs_1920_light.jpg) · [dark](analysis/reference/pages/blogs_1920_dark.jpg) |
| Post (long, code/math/tables) | [light](analysis/reference/pages/post-long_375_light.jpg) · [dark](analysis/reference/pages/post-long_375_dark.jpg) | [light](analysis/reference/pages/post-long_768_light.jpg) · [dark](analysis/reference/pages/post-long_768_dark.jpg) | [light](analysis/reference/pages/post-long_1280_light.jpg) · [dark](analysis/reference/pages/post-long_1280_dark.jpg) | [light](analysis/reference/pages/post-long_1920_light.jpg) · [dark](analysis/reference/pages/post-long_1920_dark.jpg) |
| Post (short, quiz) | [light](analysis/reference/pages/post-short_375_light.jpg) · [dark](analysis/reference/pages/post-short_375_dark.jpg) | [light](analysis/reference/pages/post-short_768_light.jpg) · [dark](analysis/reference/pages/post-short_768_dark.jpg) | [light](analysis/reference/pages/post-short_1280_light.jpg) · [dark](analysis/reference/pages/post-short_1280_dark.jpg) | [light](analysis/reference/pages/post-short_1920_light.jpg) · [dark](analysis/reference/pages/post-short_1920_dark.jpg) |
| Talks | [light](analysis/reference/pages/talks_375_light.jpg) · [dark](analysis/reference/pages/talks_375_dark.jpg) | [light](analysis/reference/pages/talks_768_light.jpg) · [dark](analysis/reference/pages/talks_768_dark.jpg) | [light](analysis/reference/pages/talks_1280_light.jpg) · [dark](analysis/reference/pages/talks_1280_dark.jpg) | [light](analysis/reference/pages/talks_1920_light.jpg) · [dark](analysis/reference/pages/talks_1920_dark.jpg) |
| 404 | [light](analysis/reference/pages/404_375_light.jpg) · [dark](analysis/reference/pages/404_375_dark.jpg) | [light](analysis/reference/pages/404_768_light.jpg) · [dark](analysis/reference/pages/404_768_dark.jpg) | [light](analysis/reference/pages/404_1280_light.jpg) · [dark](analysis/reference/pages/404_1280_dark.jpg) | [light](analysis/reference/pages/404_1920_light.jpg) · [dark](analysis/reference/pages/404_1920_dark.jpg) |

Screenshot note: headless Chrome freezes composited entrance animations near their first frame,
which hides animated-in elements. These captures force animations to their end state, so they
show the settled layout, not the motion.

**Home (`/`).** A sticky year pill ("2025") then one "Activites" [sic] calendar card: 384px wide,
dark, 7-column grid of day cells for one month. Nothing else — no hero, no bio, no post list. In
the live data the only entry is on day 31 of a 30-day month, so **every cell renders empty**; the
home page is effectively showing its empty state. Page height equals the viewport at all widths.
At 375 the card spans the gutters (327px) and cells are 32px tall; from 400px they are 40px.

**About (`/about`).** One 512px column, centred `h2` "About me", then alternating paragraphs
(16/28, zinc-600) and full-column-width images, ending with "Follow me on" and a wrapped row of
five 64px social tiles. At 375 the column is 327px; nothing else changes. Height ≈ 3480 (375) /
4090 (≥768).

**Blogs (`/blogs`).** Two sections.
1. "Recent Blogs 🔥": the four newest posts as cover cards.
   - ≥640: a row of 213 × 160 cards (4:3), each randomly rotated between −20° and +20°,
     overlapping by 40px, with a detail panel below (Title / Published on the left third,
     Description + "Read more" on the right two-thirds) that shows whichever card was last
     hovered. At 768 the rotated row is wider than the column and causes a small horizontal
     overflow (document scroll width 794px) — a reference bug.
   - <640: cards stack vertically, full width, 16:9, unrotated, each with its own title + date
     line underneath; the detail panel is hidden.
2. "Blogs": the remaining posts as hairline-separated rows, title left and date right. Long
   titles wrap under a non-shrinking date at 375.
Then an "Enjoying the content?" block with two support cards (side by side from 768, stacked
below).

**Post (`/blogs/[slug]`).** 512px column. A 4px reading-progress bar is fixed to the top of the
viewport. Header: "Back to blogs" link (left) and EN/UZ switch (right); `h1`; then one row with
"date · N min read" (left) and Share: X, LinkedIn, Telegram, copy-link (right; wraps under the
date at 375). The cover image is also used as an 800px-tall, 10%-opacity (5% dark) soft-light
wash behind the header. Body is `prose`. The support block follows the article. Tags are in the
data and meta tags but are **not rendered** on the page.

**Talks (`/talks`).** Centred `h1` + counts line, a row of filter chips, then a card grid: 1
column at 375, 2 at 640–1023, 3 from 1024. Card width is 352px at 1280 and ≈565px at 1920 (the
grid simply stretches; there is no max width). "Follow me on" social tiles close the page.

**404.** Centred column: gradient "404" numeral with three pulsing dots, a one-line message, a
"Try searching with ⌘K" pill, a 2 × 2 grid of quick links, and a "Back to Home" pill button.
Served with HTTP 404 and `cache-control: private, no-store`.

---

## 4. Components and states

Interaction screenshots are in [`analysis/reference/states/`](analysis/reference/states/).

**Header nav.** Brand link left; "Blog" link and "More" trigger right. Links are 44px tall pills
(radius 16px). Hover (≥640 only): white background (invisible on the white page in light theme;
`zinc-800` in dark). Active: `scale(.95)`. "More" opens on **click** (not hover) — verified: the
panel stays hidden on hover and opens on click; an outside click closes it. Panel: 144px wide,
white, radius 16px, padding 4px, `shadow-lg`; items 48px tall, radius 12px, hover `zinc-100`.
The trigger is an `<a href="/">` rather than a button and the panel has no ARIA roles. The panel
keeps a white background in dark theme. There is no current-page indicator.
([open](analysis/reference/states/nav_click_more.png),
[item hover](analysis/reference/states/nav_dropdown_item_hover.png))

**Focus.** No custom focus styles anywhere; elements show the browser default outline
(`rgb(9,93,191) auto 1px` in Chrome). Inputs explicitly remove it (`focus:outline-none`).
([focus](analysis/reference/states/focus_nav.png))

**Footer.** One centred line, "© {year} {domain}", fade-in on load.

**Theme toggle.** Fixed 48px white circle (dark: `zinc-800`), `shadow-lg`; hover `scale(1.05)` +
`shadow-xl`; active `scale(.95)`. Sun and moon icons cross-fade with rotate/scale. `aria-label`
switches between "Switch to dark mode" / "Switch to light mode". Stores `theme` in localStorage;
first visit follows `prefers-color-scheme`. A blocking inline script sets the class before paint
(`html.prevent-flash` hides the page until then).

**Back to top.** Fixed 40px dark circle above the theme toggle; hidden (`opacity 0`,
`translateY(16px)`, no pointer events) until `scrollY > 400`; smooth-scrolls to top.

**Search palette (⌘K / Ctrl+K).** Modal over a `black/50` blurred backdrop. Input row with
magnifier icon and an "ESC" hint; results grouped under uppercase headings (Blog Posts, Talks,
Lectures), each row with a tinted icon tile, title and one-line description; footer with key
hints. ↑/↓ move the highlight, Enter navigates, Esc or ⌘K closes. Empty query: "Start typing to
search…". No match: "No results found for "…"". Search is client-side over data bundled into the
JS. It is keyboard-only — there is no visible search button, and the 404 page is the only place
that mentions it. The dialog renders in a serif fallback font because it is mounted outside the
font wrapper (reference bug).
([empty](analysis/reference/states/search_empty.png),
[results](analysis/reference/states/search_results.png))

**Newsletter envelope.** A floating envelope button (hover: tilt −3° and shrink) that opens a
card with an email field and "Subscribe". Currently disabled: the input is `disabled` and a
pinned sticky note reads "Taking a break : )". Posts to `/api/addEntry`. Hidden on post pages.
([open](analysis/reference/states/newsletter_open.png))

**Activity calendar (home).** States: *empty day* (dim cell), *day with activity* (cell coloured
by type, tooltip with the type name on hover, hover `scale(.9)`, active `scale(.75)`), and
*takeover* — clicking a coloured day scales that cell ×20 so its colour floods the card, then
shows a "back" pill and a stack of content blocks (text block with title/body, image with
expand-to-modal, link button). Clicking outside resets it. Only the empty state is reachable on
the live site.

**Post card (featured row).** White card, radius 24px, `shadow-xl`, 5px `white/50` inner border,
pulsing white dot in the top-left corner. Hover (≥640): card un-rotates to 0°, scales 1.1,
`shadow-2xl`, inner border grows to 8px, and the card's negative margin relaxes so neighbours
slide apart; the detail panel below swaps to that post. Active: scale back to 1, border 12px.
Unpublished posts get a `black/50` overlay reading "Coming soon…". Cover images fade in on load
over a blurred placeholder.

**"Read more" button.** White pill; on hover the arrow slides out to the right while a second
arrow slides in from the left.

**Post list row.** Title + date on a hairline. Hover: text colour `zinc-800 → zinc-600` over
200ms (dark: `zinc-300 → white`).

**Post page.**
- Reading progress bar: width follows scroll percentage, 150ms ease-out.
- "Back to blogs": sits shifted 20px left; on hover it slides right and a hidden arrow appears.
- Language switch: segmented pill, active segment white with `shadow-sm`.
- Share buttons: 32px `zinc-100` circles, hover `zinc-200`; copy-link swaps to a check mark.
- Headings: `h1` 36px/700, `h2` 30px/600, `h3` 24px/600; no anchor links, no table of contents.
- Links: no underline at rest; a 1px underline grows from the left on hover/focus (animated
  `background-size`, 300ms); distinct visited colour.
- Images: full column width, radius 12px, 32px vertical margin.
- Blockquote: italic, 4px left border.
- Tables: plain typography tables, bottom borders only.
- Inline code: tinted chip, no backticks.
- Code block: Dracula-style container; a "Copy" button appears top-right on hover
  ([hover](analysis/reference/states/code_hover.png)). Blocks are rendered through an editable
  code editor; runnable ones have a footer bar with language + version and a green "Run" button.
- Math: KaTeX inline and display.
- Quiz: embedded multi-question card (progress bar, option buttons, "Check Answer").
- Reading time: `ceil(words / 200)`, minimum 1, computed from the text content.
- Tags: present in data, JSON-LD and `article:tag` meta; not shown in the UI.

**Talk card.** 16:9 thumbnail (radius 12px) from `img.youtube.com`, `black/20` scrim, centred
56px white play button, duration tag bottom-right. Hover: thumbnail zooms to 1.05 over 500ms,
scrim darkens to 40%, play button scales 1.1, and a share button fades in top-right (copies the
YouTube URL). Below: type badge, date, two-line-clamped title.
([hover](analysis/reference/states/talk_card_hover.png))

**Talks filter chips.** All / Podcasts / Videos with counts. Active: `zinc-900` bg, white text
(inverted in dark). Idle: `zinc-100`, hover `zinc-200`. An empty filter result has no dedicated
empty state.

**Talk player.** Clicking a card replaces the grid with an inline black player panel: YouTube
iframe (autoplay), then badge, date, duration, title, share, "Watch on YouTube" and "Close";
the other talks are listed below as "Up next".
([playing](analysis/reference/states/talk_playing.png))

**Social tiles.** 64px rounded squares, tinted per network. Hover: lift 4px, coloured glow, icon
scales 1.1, label tooltip fades in. ([hover](analysis/reference/states/social_hover.png))

**Support cards.** Icon circle + title + subtitle on a tinted card. Hover: lift 4px, glow, icon
scales 1.1, text nudges right, a blurred copy of the icon fades in behind.

---

## 5. Motion

Custom easings and keyframes are defined in the Tailwind config (read from the compiled CSS).

| Name | Definition |
|---|---|
| `ease-bounce` | `cubic-bezier(.2, -.25, 0, 1.6)` — used for most hover transitions |
| `fade` | opacity 0 → 1; `animate-fadeSm` .4s, `animate-fade` .8s, `animate-fadeMd` 1.2s, `animate-fadeLg` 1.6s (all `forwards`) |
| `reveal` | opacity 0 + `translateY(40px)` → rest; `animate-revealSm` .8s `cubic-bezier(.5,-.2,.1,1.2)` |
| `scaleFade` | opacity 0 + `scale(.75)` → rest; `animate-scaleFade` .4s `cubic-bezier(.7,0,.5,2)`; `animate-scaleFadeBlog` .8s `cubic-bezier(.2,0,0,1.2)` |
| `rotate` / `rotateAlt` | opacity 0 + `translateY(40px) rotate(±6deg)` → rest; 1s `cubic-bezier(.5,-.5,.1,1.8)` / `cubic-bezier(.5,1,.1,1.8)` |
| `modalReveal` | opacity 0 + `scale(.7) translateY(100px)` → rest; .6s `cubic-bezier(0,1,0,1.1)` |
| `bouncy` | `translateX(50px)`, 3s ease, infinite alternate (background blob) |
| stock | `animate-ping` 1s, `animate-pulse` 2s, `animate-spin` 1s |

Where it is used:

- **Page load:** footer fades in (.8s); post header staggers `fadeSm` → `fade` → `fadeMd`, article
  body `fadeMd`, cover wash `fadeLg`.
- **Scroll-triggered (once, via IntersectionObserver):** year pill reveals at 50% visibility; the
  calendar card rotates in at 20% visibility (direction alternates by month); day cells
  `scaleFade` in with a stagger of `index/50 + 0.04s`.
- **Blog cards:** enter with `scaleFadeBlog` staggered by 0.1s per card (plain `reveal` on
  mobile); hover transitions are 300ms `ease-bounce`.
- **Dropdown:** 200ms `ease-bounce`, from `scale(.9)` + opacity 0, origin top.
- **Theme switch:** body colours transition 300ms; icons 500ms `cubic-bezier(.34,1.56,.64,1)`.
- **Buttons:** `active:scale-95` almost everywhere, 150ms.
- **Reduced motion:** the `.reveal`, `.fade` and `.scaleFade` start states are neutralised under
  `prefers-reduced-motion`, so content is visible without animation. Hover transitions are not
  reduced.
- No parallax, no scroll-linked animation other than the reading progress bar.

---

## 6. Content model

**Post** (from `__NEXT_DATA__` on `/blogs` and `/blogs/[slug]`):

| Field | Type | Notes |
|---|---|---|
| `id` | number | sequential (27 posts, ids up to 27) |
| `title` | `{ en, uz }` | per-locale string |
| `slug` | string | URL segment; not always derived from the English title |
| `thumbnail` | string | local path or remote URL; also the OG image |
| `description` | string | list excerpt, meta description, feed description |
| `date` | `YYYY-MM-DD` | displayed as "March 26, 2026" |
| `tags` | string[] | meta/JSON-LD/search only |
| `is_published` | boolean | unpublished posts can appear as "Coming soon…" cards |
| `content` | HTML string | post page only; split client-side into blocks of type `html`, `code` (language, code), `katex` (math, inline), `quiz` |

Derived: reading time (words / 200). A draft-preview mode exists (`isDraftPreview` shows
"Draft · Unpublished" in place of the date); how it is reached is not public.

**Talk** (hard-coded array in the talks page bundle):
`id`, `title`, `description`, `youtubeId`, `date` ("April 26, 2025" as a display string),
`type` (`podcast` | `youtube` | `conference`), `duration` ("1:42:30"), optional `featured`,
optional `img` (thumbnail filename override, default `maxresdefault.jpg`). Sorted by date,
newest first. There is no event/venue field and no per-talk page.

**About page:** not modelled — the copy, four images and social links are written directly in
the page component.

**Home activity** (hard-coded): months of `{ month, year, days: [{ day, type, content[] }] }`,
where `type` is one of Misc / Life / Work / Blog / Side Project / Feature and content blocks are
`TextBlock {title, body}`, `Image`, or `LinkButton {text, href, external}`.

**URL structure:** `/`, `/about`, `/blogs`, `/blogs/<slug>`, `/talks`, plus `/lectures`,
`/coffee`, `/form`, `/10xDasturchi`, `/x-dasturchi` (not analysed in depth — outside the
requested scope). Uzbek versions under `/uz/…`. Every page has a `.md` twin (§7).

**Pagination / filtering / search:** no pagination — the blog index lists every post on one page.
No tag or category pages. Talks have a client-side type filter. Site-wide client-side search via
⌘K. The home JSON-LD advertises `/blogs?search={query}`, but the blogs page has no visible search
box (whether that query parameter is handled is Unknown).

---

## 7. SEO and machine-readable output

**Meta tags (every page).** `<title>`, `description`, `keywords` (tags on posts, empty elsewhere),
canonical, `robots` and `googlebot` `index,follow`, Open Graph (`og:title`, `og:description`,
`og:image`, `og:type`, `og:site_name`, `og:url`), Twitter (`summary_large_image`, site/creator
handle, title, description, image, image alt), `<link rel="alternate" type="text/markdown">`
pointing at the `.md` twin, and `<link rel="alternate" type="application/rss+xml" href="/feed.xml">`.
Posts add `og:type=article`, `article:published_time` and one `article:tag` per tag. Index pages
all reuse one site-wide description.

**Open Graph images.** Static files, not generated: a site-wide photo (`/me.jpg`, and
`/og.jpeg` ≈ 900 KB) for index pages, and the post cover for posts. No dynamic OG image route.

**JSON-LD.** Home: `WebSite` with `author` Person, `sameAs` social links and a `SearchAction`.
Post: `BlogPosting` with headline, description, image, `datePublished`, `dateModified`, author,
publisher, `mainEntityOfPage`, `keywords`, `articleSection`. None on About, Blogs or Talks.

**robots.txt.** Allows everything; repeats the allow block for named AI crawlers (GPTBot,
ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot, CCBot); adds
`Content-Signal: ai-train=no, search=yes, ai-input=yes`; links the sitemap.

**sitemap.xml.** 36 URLs, each with `lastmod` (the build time for all entries), `changefreq`,
`priority`, `xhtml:link` hreflang alternates for en/uz, and a `news:news` block.

**Feed.** RSS 2.0 at `/feed.xml` (`/rss.xml` is 404): channel title, link, description,
language, `lastBuildDate`, `atom:link rel="self"`, channel image; items carry title, link,
permalink guid, description and `pubDate`. No full content. Only the most recent posts are
included.

**Markdown mirrors.** Append `.md` to any page URL (`/index.md` for home). Served as
`text/markdown; charset=utf-8` with a `Link: <canonical>; rel="canonical"` header. Each starts
with YAML front matter — `title`, `description`, `canonical_url`, `md_url`, `language`,
`last_updated`, and `tags` on posts — followed by an `# H1` and the content, ending with a link
to `/sitemap.md`.
- `/index.md`: description, primary pages, recent posts.
- `/about.md`: short third-person bio, links, site content links.
- `/blogs.md`: every post as `- [Title](/blogs/slug.md): description. Published YYYY-MM-DD.`
- `/blogs/<slug>.md`: the full article in Markdown (fenced code with languages, images, quotes).
- `/talks.md`: each talk linking to YouTube with description and date.
- `/sitemap.md`: all pages and posts, plus agent files.

**Content negotiation.** The canonical HTML URLs return Markdown when the request has
`Accept: text/markdown` **or** when the user agent does not look like a regular browser — `curl`,
`ClaudeBot`, `GPTBot`, and any UA containing "Claude" all received Markdown (`Vary: Accept,
User-Agent`). Side effect: a human using an AI-branded browser gets raw Markdown instead of the
site.

**Other agent-facing files.** `/llms.txt` (curated index), `/llms-full.txt` (entire corpus,
≈480 KB), `/.well-known/api-catalog` (RFC 9727 linkset), `/openapi.json`, `/api-docs.md`,
`/.well-known/status`, `/.well-known/agent-skills/index.json`, `/.well-known/oauth-protected-resource`,
`/auth.md`, an HTTP `Link` header advertising them, and an inline script that registers WebMCP
tools (`get_markdown_url`, `get_agent_discovery`, `search_blog_posts`) when
`navigator.modelContext` exists. No web app manifest.

---

## 8. Baseline: Lighthouse and page weight

Lighthouse 13.6.0, headless Chrome, default throttling, one run each (scores vary a few points
between runs).

| Page | Mode | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS | Speed Index |
|---|---|---|---|---|---|---|---|---|---|---|
| Home | Mobile | **99** | **93** | **81** | **100** | 1.6 s | 1.6 s | 30 ms | 0 | 2.9 s |
| Home | Desktop | **100** | **93** | **81** | **100** | 0.4 s | 0.4 s | 0 ms | 0 | 0.8 s |
| Post (`/blogs/hyperloglog`) | Mobile | **90** | **91** | **77** | **92** | 1.1 s | 1.2 s | 20 ms | 0 | 11.8 s |
| Post (`/blogs/hyperloglog`) | Desktop | **90** | **91** | **77** | **92** | 0.5 s | 1.0 s | 0 ms | 0 | 3.4 s |

Page weight (transfer size, from Lighthouse):

| Page | Total | Requests | JS | CSS | Fonts | Images | Document |
|---|---|---|---|---|---|---|---|
| Home | **≈440 KB** | 41 | 268 KB (19 files) | 17 KB | 20 KB | 0 | 10 KB |
| Post | **≈7.9 MB** | 55 | 384 KB (23 files) | 22 KB | 79 KB | **7.2 MB** (4 files) | 18 KB |

Uncompressed, the home page loads ≈1.15 MB of JavaScript and 99 KB of CSS. Other pages for
context (decoded bytes from the request logs): Blogs ≈12 MB (10 MB images), About ≈7.4 MB (one
4.5 MB JPEG), Talks ≈1.7 MB.

What costs the reference points (targets for doing better):

- **Images:** multi-megabyte PNG/JPEG/GIF served unresized and without explicit dimensions
  (`unsized-images`, `total-byte-weight`, slow Speed Index on the post).
- **Accessibility:** icon-only buttons with no accessible name (`button-name` — the envelope and
  modal close buttons), low-contrast text (`color-contrast`), form fields without labels
  (`label` — the code-editor textareas), `label-content-name-mismatch`.
- **Best practices:** deprecated API use, errors logged to the console on posts (a `_next/data`
  request for the literal `[slug]` returns 404).
- **SEO (post):** non-descriptive link text (`link-text`).
- Unused JS/CSS and legacy polyfills on every page.

---

## Could not be determined

| Question | Default I will use |
|---|---|
| Where posts are authored and stored (CMS, database, files in the repo) | Design the storage from the content model (PLAN.md) |
| The admin UI, its auth, and how draft preview is reached | Design from scratch (PLAN.md) |
| Which service runs code for the "Run" button | Leave code execution out |
| Newsletter provider behind `/api/addEntry` | Leave the newsletter out unless you want it |
| Whether `/blogs?search=` is handled | Implement search only through the ⌘K palette |
| Exact library names behind minified code (Phosphor, react-intersection-observer, clsx, tailwind-merge, Prism) | Use those libraries; they match the observed behaviour |
| Hover-driven motion as it feels in a real browser (headless capture freezes animations) | Rebuild from the exact CSS durations and easings in §5, then compare by eye in Phase 4 |
