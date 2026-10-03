# Suga.health — V2 "Soft Clinic" (MedVi-style) — internal spec

Client reference: https://home.medvi.org/ — modern DTC telehealth: white base, soft pastel
tinted rounded panels (one per vertical), friendly geometric sans (Red Hat), checkmark benefit
lists, pill buttons, caps eyebrows, testimonial wall, trust marquee, guarantee strip.

V2 lives entirely in /v2/ — NEVER touch files outside /v2/ except nothing. The classic design
at the site root stays as-is. V2 is ONE long landing page (v2/index.html) whose CTAs point to
the EXISTING working consultation at ../consultation.html (with ?goal= params).

## Brand (unchanged across designs)
Wordmark stays the logo: bold ink "Suga.health" with red dotted underline + Caveat script
"live naturally" in pen orange. Everything AROUND it goes soft.

## Tokens (in v2/assets/v2.css — do not redefine)
- Base: --bg #FFFFFF, --bg-soft #FAF9F7, --ink #242220, --ink-soft #5D5954, --line #ECE8E3
- Vertical tints: --sage #EDF3E4 (+ --sage-deep #DFEBD3) = weight loss;
  --blush #F7E9E4 (+ --blush-deep #F1DCD3) = hair growth;
  --blue #E6EDF4 (+ --blue-deep #D8E4EE) = sexual health
- Primary action: --green #2E6B44 (pill buttons), hover --green-deep #245436
- Accents: --amber #E8A33D (stars), proof red #DF2E2A ONLY in the wordmark underline
- Radius: cards 20px, big panels 32px, buttons/pills 999px
- Shadows: soft ambient only (no hard offsets — that's v1's language)

## Type
- Headings: 'Red Hat Display' 600/700 (friendly, NOT heavy black). h1 clamp(2.6rem,5.6vw,4.5rem), line-height 1.06
- Body/UI: 'Red Hat Text' 400/500/600, 17px/1.6
- Caveat only for the brand tag. No other fonts.
- Eyebrows: 12-13px, 700, letter-spacing .16em, uppercase, muted color (or tint-deep color inside panels)

## Signature devices (v2)
- .panel — huge tinted rounded section card (radius 32, padding ~72px desktop / 28px mobile),
  grid-2 inside (copy side + visual side), alternate visual left/right per panel
- .check-list — checkmark rows (green circle-check SVG inline) — the MedVi benefit list
- .pill-btn — solid green pill; .pill-btn--ghost outline ink
- .cat-pill — hero category chips with tiny icon linking to panels
- .marquee — slow infinite caps trust strip (pauses on reduced-motion): LICENSED PHYSICIANS ·
  100% ONLINE · CLEAR PRICING BEFORE TREATMENT · DISCREET DELIVERY · FOLLOW-UP INCLUDED
- .float-card — small white rounded stat/feature cards floating over panel visuals (gentle bob)
- .t-card — testimonial card: stars (amber), quote, — First name. Testimonial section MUST carry
  a visible small-print: "Sample testimonials shown for design preview — to be replaced with real
  patient feedback." (client is a doctor; we never fake real reviews)
- Motion: .reveal fade-up on scroll (24px, once), marquee scroll, illustration bob (6s, 8px),
  card hover lift. ALL gated on prefers-reduced-motion. No parallax, no confetti.

## Page structure (v2/index.html)
1. Top announcement strip (soft green): "Every consultation is reviewed by a licensed physician — typically within 24 hours."
2. Sticky white nav: brand | Weight Loss / Hair Growth / Sexual Health / How it works (in-page anchors) | pill CTA "Start consultation" → ../consultation.html
3. Hero (centered): eyebrow "DOCTOR-LED TELEHEALTH — 100% ONLINE"; h1 "Feel like yourself again." (brand headline carries over); sub: three journeys, one 5-minute consultation; pill CTA + "Free to start · 5 minutes · Confidential"; row of 3 .cat-pill anchors; soft radial tint blobs behind (CSS only).
4. Trust marquee.
5. #weight-loss .panel (sage): eyebrow "DOCTOR-GUIDED WEIGHT LOSS"; h2 "Weight loss made honest, built around you"; sub; check-list (GLP-1 medication when appropriate · 1:1 physician guidance · Typically 10–15% of body weight in 6–12 months · Follow-ups included · Clear pricing before you start); pill CTA → ../consultation.html?goal=weight-loss; visual: inline SVG spot illustration (scale + descending progress curve) + .float-card "Typical: −12 kg by month 9*". Small-print disclaimer under panel.
6. #hair-growth .panel (blush, reversed): "PROVEN HAIR REGROWTH CARE"; h2 "Keep the hair you have. Regrow what you can."; check-list (First-line medication chosen by a doctor · ~9 in 10 men stop further loss · Root causes checked: thyroid, iron, hormones · A 12-month plan, not a 12-day promise); visual: hair/leaf sprout illustration + float-card "Month 3: shedding stabilises".
7. #sexual-health .panel (blue): "PRIVATE SEXUAL HEALTH CARE"; h2 "Effective care, zero waiting-room small talk"; check-list (ED & PE treated with proven options · Whole-history screening — ED can be an early heart signal · Plain, unmarked delivery · Nobody ever has to know); visual: shield/heart illustration + float-card "Privacy: by design".
8. "Everything in one place" (bg-soft): 3 white cards — Track your progress / Message your doctor anytime / Plans that adapt as your body responds.
9. How it works (#how-it-works): 4 steps with round number badges (Share your story → A doctor reads it → Your plan arrives → We stay with you).
10. Testimonial wall: 6 .t-cards, 3-col grid (1-col mobile), star rows, first names only + the REQUIRED sample-preview small-print.
11. Guarantee strip: 3 items with icons — Doctor-led plans · No hidden fees · Discreet, tracked delivery.
12. FAQ: 5 rounded-card accordions (same honest answers as classic design).
13. Final CTA: deep-green rounded panel, white text: "Start where every good outcome starts." + white pill button.
14. Footer (white, hairline): brand, anchors, link "Prefer the classic look? → ../index.html" label "View classic design", the two medical disclaimer lines from v1 footer, © 2026 Suga.health.

## Rules
- All medical copy stays conservative (ranges + disclaimers). No invented doctors, no prices,
  no FDA claims. Testimonials ONLY with the sample-preview label.
- Google Fonts CDN for Red Hat Display/Text (+ Caveat for brand tag) is OK in v2.
- Responsive to 360px; labels/focus/keyboard; unique title+meta; lang=en.
- v2 pages reference v2 assets relatively (assets/v2.css), and ../consultation.html for CTAs.
