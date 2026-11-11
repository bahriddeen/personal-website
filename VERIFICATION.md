# VERIFICATION — Phase 4 results

Checked on 2026-11-10/11 against a production build (`next build` + `next start`) on
localhost with the seeded placeholder content. The reference is otabek.io as analysed in
[ANALYSIS.md](ANALYSIS.md).

Evidence is in `analysis/verify/` (git-ignored, local only):

- `compare/` — 56 side-by-side images, reference left and this site right, for 7 pages × 4
  widths (375 / 768 / 1280 / 1920) × 2 themes
- `pages/` — this site's full-page screenshots on their own
- `data/` — Lighthouse reports; `admin_*.png` — admin screenshots

## Summary

| Requirement | Result |
|---|---|
| Screenshots at four widths, compared with the reference | Done — differences listed below |
| Lighthouse at or above the reference | Met on 15 of 16 scores. **Not met: Home, mobile, performance — 97 against 99** (details below) |
| Keyboard navigation on every page, both themes | 32 of 33 scripted checks pass; the one failure was a fault in the test and passes when re-tested separately (8 of 8 theme checks) |
| Admin: create, edit, publish, delete end to end | 43 of 43 checks pass (dev server), 20 of 20 (production build) |
| Unit tests | 46 of 46 pass |
| README | [README.md](README.md) |

**Not re-checked on screen:** the last change — a readable base colour for display math in the
dark theme (`src/styles/globals.css`) — was made after the final build. Docker Desktop was
paused at that point, so the site could not be rebuilt. It is a two-rule CSS change; the
screenshots in `analysis/verify/` still show the faint math. Rebuild and look at
`/blogs/placeholder-notes-on-estimating` in dark mode to confirm.

## Lighthouse

Lighthouse 13.6, headless Chrome, default (simulated) throttling — the same method as the
baseline in ANALYSIS §8. Scores are performance / accessibility / best practices / SEO.

| Page | Mode | Reference | This site | |
|---|---|---|---|---|
| Home | Mobile | 99 / 93 / 81 / 100 | **97** / 100 / 100 / 100 | performance 2 below |
| Home | Desktop | 100 / 93 / 81 / 100 | 100 / 100 / 100 / 100 | at or above |
| Post | Mobile | 90 / 91 / 77 / 92 | 98 / 100 / 100 / 100 | above |
| Post | Desktop | 90 / 91 / 77 / 92 | 100 / 100 / 100 / 100 | above |

Page weight: Home 236 KB (reference 440 KB), post 251 KB (reference 7.9 MB).

**The one miss.** Home on mobile measured 97 in the final run, and 97–98 in the four runs
after the last performance change (95–96 before it). Every metric is fast except Lighthouse's *simulated* largest contentful paint (2.4–2.6 s). The
measured values in the same runs are 80–90 ms. The cause is the project card image: it is the
largest element on the first screen, and when the largest element is an image, Lighthouse's
model adds the cost of all JavaScript that finished loading before it painted. On localhost,
with no network delay, that is all of it. The reference home has no image at all.

To check that this is the model and not the page, both sites were also measured with
*applied* throttling (`--throttling-method=devtools`, real slow-4G and 4× CPU slowdown):

| Page (mobile, applied throttling) | Reference | This site |
|---|---|---|
| Home | 79 / 93 / 81 / 100 — LCP 3.8 s | 100 / 100 / 100 / 100 — LCP 1.4 s |
| Post | 65 / 91 / 77 / 92 — LCP 5.5 s | 100 / 100 / 100 / 100 — LCP 1.5 s |

What was done about it: the image is small (3.6 KB at phone size), loads with high priority,
has no entrance fade, and off-screen calendar months are skipped until scrolled to. What would
close the last two points under the simulated method: remove the image from the project card,
or move the card below the first calendar on phones. I left that choice to you because it
changes the home page you approved. The score on Vercel (HTTP/2, real latency) may also differ
from localhost; re-run after the first deploy.

Other pages, mobile, for context: Blog index 100 / 100 / 100 / 100 (after fixing a generic
"Read more" label that had cost SEO points), About 99 / 100 / 100 / 100, Talks 93 / 100 / 100 /
100 (same image effect, with a YouTube thumbnail).

## Keyboard and themes

Run with a script that drives a real Chrome using only key presses. These checks ran on the
build before the last performance changes (bio animation by word, off-screen calendar months
deferred, one link label, image priority) and were not repeated afterwards, because the local
database was no longer reachable.

- Every page (home, about, blog index, post, talks, 404) in light and dark: every tab stop is
  visible and shows a focus ring, and focus never gets stuck. 11–26 stops per page.
- First stop on each page is a "Skip to content" link.
- Header menu: Enter opens, arrow keys move, Escape closes and returns focus, Enter follows.
- Theme toggle: works from the keyboard, label switches, choice survives reload and carries
  across pages; first visit follows the system setting and stores nothing until a choice is made.
- Search: ⌘K opens with focus in the field, Tab stays inside the dialog, Enter opens the
  highlighted result, Escape closes.
- Home calendar: Enter opens a day and moves focus to "back", the day's link is reachable,
  Escape closes and returns focus to the day.
- Blog index: focusing a card updates the detail panel; Enter opens the post.
- Post: code "Copy" buttons are reachable and become visible on focus.
- Talks: Enter plays a talk and moves focus to Close, Escape closes, filter chips toggle.

One check in the first run reported the theme not surviving a reload. That was the test
resetting the theme on every load, not the site; it was re-tested separately (8 of 8 pass).

## Admin

**Dev server, through the UI (43 of 43):** `/admin` redirects to login when signed out; API
writes and uploads are refused without a session (401), from another origin (403), with bad
input (400), and for non-image files (415). Signed in: slug generated from the title, live
preview with highlighted code, image upload inserted as Markdown with its pixel size, draft
saved and not public anywhere (page, Markdown mirror, feed), draft preview visible to the admin
only, future date turns Publish into Schedule and the post stays private, publishing makes it
appear on the post page, blog index, Markdown mirror, feed, sitemap and search, title and slug
edit with the old address redirecting, duplicate slug refused (409), unpublish, delete.
Talks: add, edit, delete. About and Settings: edit shows on the site, then restored. Sign out.

**Production build, through the API (20 of 20):** dev login does not exist; a session without
the admin flag is refused; publishing, editing, changing the slug and deleting a post each
update the statically generated pages immediately (post page, blog index, home).

GitHub sign-in itself was **not** exercised: it needs your OAuth app. The allow-list logic is
covered only by code review, so test the first real login after setting it up.

Bugs these checks found, all fixed:

- A `javascript:` link in Markdown was rendered as a clickable link. Links and image
  addresses are now limited to web, mail, phone and same-site addresses.
- After deleting a post whose slug had been changed, the old address kept redirecting for up
  to five minutes. Old addresses are now refreshed on delete.
- Phones scrolled sideways on the home page (the scrolling strip widened the layout).
- The calendar cards never appeared (the scroll observer was re-attached on every render).
- Security headers blocked one of Next's own development files.

## Visible differences from the reference

Everything below is intentional. "Kept" means the difference stays and why.

### Site-wide

| Difference | Why |
|---|---|
| Name, text, images and links are yours or marked placeholders | Required: none of the reference's content is used |
| Footer reads "© 2026 Bahriddin" instead of a domain | Your domain is not known yet; it follows the site title |
| No newsletter envelope and no blurred blob in the bottom-left corner | Newsletter is out of scope (needs an email service); the blob was part of it |
| "More" menu has two items (About Me, Talks) | Lectures and Coffee pages are out of scope |
| Nav links show a light grey background on hover in the light theme | The reference's hover colour is white on white, so nothing visibly happens; kept the visible version |
| "More" menu is dark in the dark theme | The reference leaves it white; fixed |
| Visible focus rings and a skip link | Needed for keyboard use; the reference has browser defaults only |
| Search dialog uses the site font, lists posts and talks only | The reference's dialog falls back to a serif font (bug); no Lectures here |
| Theme follows the system until you pick one | The reference stores a choice on first visit, which stops it following the system |

### Home

| Difference | Why |
|---|---|
| Bio line, social icons, scrolling strip and Sakina card above the calendar | Approved additions (plan decisions 3 and 4) |
| Several month cards with coloured days, month name on each card | The calendar is filled from posts and talks; the reference shows one empty month |
| "Activities" spelled correctly | The reference has a typo ("Activites") |
| The Sakina card has no entrance animation | It holds the largest image on the first screen; fading it in delays the largest paint |

### Blog index

| Difference | Why |
|---|---|
| Headings read "Recent Posts 🔥" and "All Posts" | Own wording |
| Three cards, and the list repeats them | Only three placeholder posts exist; with more than four posts the list shows the rest, as the reference does |
| Card tilt is fixed per post instead of random on each load | Random angles differ between server and browser and cause a visible jump on load |
| Link under the description reads "Read this post" | "Read more" fails Lighthouse's link-text check |
| "Want more like this?" cards for Telegram and GitHub with line icons | Your links; the reference uses Buy Me a Coffee and animated GIF icons |
| Row dividers are dark grey in the dark theme | The reference keeps light-theme dividers in dark (too bright) |
| No sideways overflow at 768px | Reference bug (ANALYSIS §3) |

### Post

| Difference | Why |
|---|---|
| No EN / UZ switch | English only |
| Tag chips under the title | You asked for tags; the reference stores them but never shows them |
| Code blocks are read-only, with no Run bar, and long lines scroll instead of wrapping | Running code is out of scope; wrapped code is harder to read |
| No quiz block | Out of scope |
| The faint cover backdrop does not fade in | It is the page's largest paint; loading it early keeps that fast |
| Block quotes have no decorative quotation marks | Cleaner with the italic style |
| Display math in the dark theme was faint | Fixed after the final build — see the note at the top |

### Talks

| Difference | Why |
|---|---|
| Types are Talk / Podcast / Video; Talk has a blue badge | Your content model includes conference talks |
| Event name under each title | New field you asked for |
| Non-YouTube links show an "open" icon and open in a new tab | Only YouTube can play in the page |
| Counts line reads "2 items • 1 talk • 1 podcast" | Correct singulars; the reference prints "1 podcasts" |
| Three social tiles | Your three links |

### About and 404

| Difference | Why |
|---|---|
| About content comes from Markdown you edit in the admin | The reference hard-codes it |
| 404 has a dot pattern behind the number, own wording, an RSS quick link, and the search hint is a button | Approved extra component; the button lets touch users open search |

### Not compared

Hover and entrance motion were rebuilt from the reference's exact CSS durations and easings
(ANALYSIS §5) but could not be compared frame by frame: headless Chrome freezes those
animations. Worth a look by eye in a real browser.
