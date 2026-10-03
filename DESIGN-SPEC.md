# Suga.health — Design Specification (internal)

Brand: **Suga.health** — tagline *live naturally*. US-physician-founded telehealth clinic.
Three verticals — Weight Loss, Hair Growth, Sexual Health — all begin with the SAME 5-minute
online consultation, reviewed by a doctor.

## Concept — "The Annotated Chart"
Every page looks like it passed across a doctor's desk: clinical paper, ink typography,
one persimmon "pen" accent used for CTAs and handwritten margin notes, and a red dotted
proof-mark underline on exactly ONE key word per major headline (mirrors the wordmark).
Quiet, precise, editorial. The boldness lives in the annotations — everything else is calm.

## Tokens (already in assets/styles.css — DO NOT redefine)
- Paper `--paper #FBFAF6`, alt `--paper-2 #F4F1E9`, card `--card #FFFFFE`
- Ink `--ink #191813`, soft `--ink-soft #57544A`, faint `--ink-faint #8A867A`
- Pen accent `--pen #C2410C` (ONLY accent; buttons, links, annotations)
- Proof red `--proof #DF2E2A` (ONLY for dotted underlines + tiny marks, never large fills)
- Vital green `--vital #2E6B44` (positive clinical states only: success, "in range")
- Dark ink surfaces `--ink-bg #171610` (footer, dark chart panels)
- Rule `--rule #E3DFD2` hairlines

## Type (loaded in styles.css via Google Fonts)
- Display: **Archivo** — weight 800, `font-stretch: 125%` (class `.display`), tight leading
- Body/UI: **Public Sans** (400/500/600) — 17px/1.6
- Pen script: **Caveat** (600) — class `.pen-note`, color `--pen`, slight rotation
- Never introduce another font. Max sizes: h1 `clamp(2.9rem, 6.4vw, 5.4rem)`.

## Signature devices (use, don't reinvent)
- `.u-proof` — red dotted underline on ONE word per big headline
- `.pen-note` — handwritten margin annotation (use 1–2 per page MAX, e.g. beside hero or a stat)
- `.eyebrow` — small caps label with hairline rule, like a chart field label
- `.chart-card` — patient-chart styled card: header strip + ruled lines
- `.stamp` — "REVIEWED" style ink stamp (rotated, bordered) — use sparingly (1 per page max)
- `.reveal` — scroll fade-in (24px, once). Do not animate anything else on scroll.

## Layout rules
- `.container` max-width 1160px. Sections `.section` (96px vertical) alternate paper/paper-2.
- ONE primary CTA per screen: "Start consultation" → `consultation.html` (pass `?goal=` on
  condition pages: `weight-loss` | `hair-growth` | `sexual-health`).
- Nav (`.nav`): brand wordmark (dotted-underlined "Suga.health" + tiny Caveat "live naturally"),
  links: Weight Loss / Hair Growth / Sexual Health / About, one `.btn` CTA. Mobile: hamburger
  (already wired in app.js — copy nav markup EXACTLY from index.html).
- Footer (`.footer`, dark ink): brand, page links, medical disclaimer, "Not for emergencies —
  call your local emergency number", © 2026 Suga.health.
- NO stock photos. Visuals = inline SVG line-art in ink/pen (1.75px strokes, slightly organic),
  chart motifs, big typography. No emoji as icons.
- Copy: plain, warm, specific, no hype. Sentence case. Buttons say what they do.
  Medical claims conservative + cite ranges ("patients typically lose 10–15%…") with
  footnote-style disclaimers. This client is a physician — accuracy over marketing.

## Accessibility / quality floor
- Visible `:focus-visible` outlines (in styles.css), labels on every input, keyboard navigable,
- `prefers-reduced-motion` respected (styles.css handles), semantic landmarks
  (`header/nav/main/section/footer`), unique `<title>` + meta description per page.
- Responsive to 360px. Test wide tables/rows for overflow.

## Page inventory
1. `index.html` — landing (hero thesis, three verticals, how-it-works, why-us, FAQ, final CTA)
2. `weight-loss.html`, `hair-growth.html`, `sexual-health.html` — condition pages
   (condition hero, "what we treat", science/treatment options, expectations timeline, FAQ, CTA)
3. `about.html` — the clinic: US-trained physician story, care philosophy, safety/privacy
4. `consultation.html` — 6-step intake wizard (see CONSULT-SPEC in build prompt)

Shared assets: `assets/styles.css`, `assets/app.js` (nav + reveal), `assets/consult.js`
(wizard only, loaded by consultation.html).

## Hard rules for builders
- NEVER edit `assets/styles.css` or `assets/app.js`. Page-specific styles go in ONE
  `<style>` block in that page's `<head>`, prefixed classes `pg-…`.
- Copy the exact nav + footer markup from `index.html` (single source of truth).
- All internal links must resolve (relative, same folder).
- Every page: `<html lang="en">`, `.reveal` on major sections, skip-link provided by pattern
  in index.html.
