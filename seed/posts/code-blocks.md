---
title: "PLACEHOLDER: A tour of code blocks"
slug: placeholder-code-blocks
description: "Placeholder post. It shows syntax-highlighted code in several languages, inline code and a table."
date: 2026-09-14
tags: Placeholder, Code
cover: /placeholders/cover-2.jpg
---

> **This is placeholder content.** Edit or delete it in Admin → Posts.

Code blocks are highlighted at build time and each one has a copy button. Fenced blocks take a language name after the opening backticks.

## TypeScript

```ts
type Post = {
  slug: string;
  title: string;
  publishedAt: Date | null;
};

function isPublic(post: Post, now = new Date()): boolean {
  return post.publishedAt !== null && post.publishedAt <= now;
}
```

## Python

```python
from dataclasses import dataclass


@dataclass
class Counter:
    """Counts how many times each word appears."""

    counts: dict[str, int]

    def add(self, word: str) -> None:
        self.counts[word] = self.counts.get(word, 0) + 1


counter = Counter(counts={})
for word in "the quick brown fox jumps over the lazy dog".split():
    counter.add(word)
print(counter.counts["the"])  # 2
```

## SQL

```sql
SELECT slug, title
FROM posts
WHERE status = 'published'
  AND published_at <= now()
ORDER BY published_at DESC
LIMIT 10;
```

## Shell

```bash
npm install
npm run db:up
npm run dev
```

## Plain text

A block without a language is shown as-is:

```
Request  →  Server  →  Database
Response ←  Server  ←  Database
```

## Inline code and a table

Use `npm run build` for a production build. The table below lists the scripts.

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts the development server |
| `npm run build` | Builds for production |
| `npm run db:migrate` | Applies database migrations |
| `npm test` | Runs the unit tests |

A very long line inside a block scrolls sideways instead of wrapping:

```js
const url = `https://example.com/api/items?page=1&pageSize=50&sort=createdAt&order=desc&include=author,tags,comments`;
```
