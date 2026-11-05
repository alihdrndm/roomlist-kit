# Design direction: "the ledger" (2026-11-05)

## Idea

A rooming list is a ledger: names, nights, rooms, totals that must reconcile with a contract. The redesign treats the app as a precise working document in hotel stationery: a warm paper canvas, ink-dark type, one blue-ink accent for what you can act on, and red / amber / green kept strictly for status. Nothing decorative that does not carry information. The one visual signature is the **night strip**: a row of nights with the block window and shoulder nights marked, the shape hotels and planners already think in.

What it is not: no gradients, no glass, no illustrations, no dark mode (the spec keeps the app light-only), no motion beyond feedback.

## Principles

1. **Verdict first.** Every result opens with the answer: ready, ready with warnings, or blocked, and what to do next.
2. **Show what was understood.** Column mapping, the parsed guests, which checks ran. Trust comes from transparency.
3. **Fix, don't just report.** Every issue points to the setting, row or field that resolves it.
4. **Numbers are data.** Tabular figures, right-aligned counts, ISO dates in mono where they are values, weekday labels where people read them.
5. **Honest by default.** Assumptions are shown where a format is chosen; the privacy promise is always visible.

## Typography

| Role | Face | Use |
|---|---|---|
| Display | Newsreader (variable, OFL) | page titles, section titles, big figures |
| Text / UI | IBM Plex Sans (variable, OFL) | everything else; tabular figures on |
| Data | IBM Plex Mono 400/500 (OFL) | codes (R004), dates as values, file names, row numbers |

Self-hosted woff2 in `apps/web/public/fonts` (latin + latin-ext for Plex Sans so guest names with diacritics render in the same face), so builds stay offline. Scale: 12 / 13 / 14 / 15 / 16 / 20 / 24 / 32 / 40 px.

## Colour tokens (light only; contrast measured)

| Token | Hex | Role | Contrast |
|---|---|---|---|
| `canvas` | #F7F5F0 | page | – |
| `surface` | #FFFFFF | cards | – |
| `sunken` | #F1EEE7 | wells, table heads | – |
| `line` | #E2DDD2 | hairlines (decorative) | – |
| `line-strong` | #CFC8BA | stronger dividers | – |
| `field` | #8F8878 | input borders | 3.5:1 on white (WCAG 1.4.11) |
| `ink` | #16171B | text | 16.4–17.9:1 |
| `ink-2` | #45464E | secondary text | 8.1–9.4:1 |
| `ink-3` | #686760 | muted text | 4.9–5.7:1 |
| `accent` | #2742B0 | links, focus, selection, data bars | 7.3–8.4:1 |
| `accent-strong` | #1C3290 | hover | 9.5–11:1 |
| `accent-soft` | #EDF0FB | selected backgrounds | – |
| `danger` / `-ink` / `-soft` | #B3261E / #9A1F18 / #FCEFED | errors, blocked | ≥6:1 |
| `warning` / `-ink` / `-soft` | #8A5300 / #7A4A00 / #FBF3E2 | warnings, shoulder | ≥5.5:1 |
| `success` / `-ink` / `-soft` | #16704A / #13603F / #EAF5EF | ready | ≥5.2:1 |

Primary buttons are ink (#16171B) with white text: the main action reads like a stamp, while blue is reserved for navigation and selection.

## Shape, space, elevation

Radii 6 (controls), 10 (cards), 14 (large panels), pill for chips. Spacing on Tailwind's 4px scale. Elevation by hairline + a soft shadow only on raised layers (menus, sticky bars). Content width 1280px; gutters 16 / 24 / 32px.

## Components (in `apps/web/src/components/ui/`)

Button (primary, secondary, ghost, danger; sm/md; pending), Field (label, hint, error, required) with Input/Select/Textarea, Segmented control, Tabs (roving focus), Card/Panel, Stat (labelled group, one `<p>` value), Badge/Chip, Callout (info/success/warning/danger), ProblemNotice, EmptyState, Status (live region), Pagination, Icon set (hand-drawn SVG, 1.5px stroke, `aria-hidden`).

## Motion

120–180 ms ease-out on colour, border and opacity; a 160 ms fade-up when a result appears; an indeterminate bar while a request runs. All of it is disabled under `prefers-reduced-motion`.

## Responsive behaviour

- ≥1280: Validate is a two-pane workbench (setup rail 360px + report).
- 1024–1279: the same with a 320px rail.
- 640–1023: one column; setup cards first, report below.
- <640: tables become cards (issues, guests, changes); the nav becomes a full-width segmented row; sticky bottom action only where it helps.

## Screen map

| Route | Purpose | Primary action |
|---|---|---|
| `/` Validate & convert | load list + block → verdict → review → export | Validate / Download |
| `/compare` | two versions → change brief for the hotel | Compare / Copy update |
| `/formats` | choose and trust a target | – (reference) |
| `/guide` | how to prepare a list; every check explained; template | Download template |
| 404 / error | recover | back to Validate |
