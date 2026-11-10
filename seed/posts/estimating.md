---
title: "PLACEHOLDER: Notes on estimating"
slug: placeholder-notes-on-estimating
description: "Placeholder post. It shows inline and display math, a comparison table and nested headings."
date: 2026-08-03
tags: Placeholder, Math
cover: /placeholders/cover-3.jpg
---

> **This is placeholder content.** Edit or delete it in Admin → Posts.

Math is written in LaTeX between dollar signs. Inline math such as $O(n \log n)$ sits in the line, and display math gets its own block.

## Display math

The mean of $n$ values:

$$
\bar{x} = \frac{1}{n} \sum_{i=1}^{n} x_i
$$

And the standard error of an estimate built from $m$ independent buckets:

$$
\sigma \approx \frac{1.04}{\sqrt{m}}
$$

## A table

| Buckets ($m$) | Memory | Typical error |
| ---: | ---: | ---: |
| 1,024 | about 1 KB | 3.25% |
| 4,096 | about 3 KB | 1.63% |
| 16,384 | about 12 KB | 0.81% |

### Reading the table

Four times the buckets halves the error. That trade is the whole idea: spend a little memory, accept a small and known uncertainty.

## A short list of steps

1. Decide how much error is acceptable
2. Pick the number of buckets from the table
3. Measure the real error on real data

## Closing

> An estimate with a known error is often more useful than an exact answer that arrives too late.
