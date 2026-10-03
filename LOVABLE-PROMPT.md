# Lovable AI — Master Prompt for Suga.health
Paste PROMPT 1 into a new Lovable project. Then run the two short follow-up prompts.

---

## PROMPT 1 — the master build prompt

Build a premium multi-page telehealth website called **Suga.health** (tagline: *live naturally*). The founder is a US-trained physician with very high design standards — this must look like a $10,000 agency site, not a template. Three services — Weight Loss, Hair Growth, Sexual Health — all begin with the SAME 5-minute online consultation reviewed by a real doctor.

### DESIGN CONCEPT — "The Annotated Chart"
Every page should feel like it passed across a doctor's desk: clinical paper background, ink-black editorial typography, ONE warm "doctor's pen" accent color, handwritten margin annotations, and a red dotted underline on exactly ONE key word per major headline (like a proofreader's mark). Calm, precise, editorial. The boldness lives only in the annotations — everything else stays quiet.

### DESIGN TOKENS (follow exactly)
- Background paper: #FBFAF6, alternate section: #F4F1E9, cards: #FFFFFE
- Ink text: #191813, soft text: #57544A, faint: #8A867A
- Pen accent (the ONLY accent — buttons, links, annotations): #C2410C, hover #9A3409
- Proof red #DF2E2A — used ONLY for the dotted underlines and tiny marks, never fills
- Success green #2E6B44 (positive clinical states only)
- Dark sections & footer: #171610 with warm off-white text #F2EFE6
- Hairline rules: #E3DFD2. Border radius 10px. Never pure black or pure white anywhere.

### TYPOGRAPHY (Google Fonts, exactly these three)
- Display headlines: **Archivo** ExtraBold, expanded width, tight leading, letter-spacing -0.02em. H1 around 72–86px desktop / 44px mobile.
- Body/UI: **Public Sans** 400/500/600, 17px, line-height 1.6
- Handwritten annotations: **Caveat** 600 in the pen color, slightly rotated (-2deg)

### SIGNATURE DEVICES (reuse everywhere, don't invent new ones)
1. **Proof-mark**: red dotted underline (text-decoration dotted) on ONE word per big headline.
2. **Pen note**: short handwritten Caveat annotation in pen orange — max 2 per page (e.g. "no waiting rooms →").
3. **Patient chart card**: white card, 1.5px ink border, hard offset shadow (4px 4px 0 rgba(25,24,19,.1)), black header strip with tiny uppercase letter-spaced title + small red dot, body of ruled rows (dashed hairline separators, uppercase small label left, value right — some values in Caveat handwriting).
4. **Ink stamp**: rotated bordered uppercase stamp like "REVIEWED" — max 1 per page.
5. **Eyebrow labels**: tiny uppercase letter-spaced labels with a short hairline after, like chart field names.
6. Scroll animation: sections fade up 24px once, 0.7s ease. Nothing else animates on scroll. Respect prefers-reduced-motion.

### GLOBAL
- Sticky nav: brand wordmark "Suga.health" (bold, with the red dotted underline) with tiny Caveat "live naturally" under it; links Weight Loss / Hair Growth / Sexual Health / About; ONE pill button "Start consultation". Hamburger on mobile.
- Footer (dark ink): brand, care links, clinic links, and legal lines: "Suga.health provides medical consultations through licensed physicians. Treatment is prescribed only when clinically appropriate — a consultation does not guarantee a prescription." + "Not for medical emergencies — call your local emergency number." + © 2026 Suga.health.
- ONE primary CTA per screenful. Secondary actions are text links with arrows.
- NO stock photos, NO emoji icons. Visuals are minimal inline SVG line-art (1.75px ink strokes, rounded caps) and the chart cards.
- Copy: warm, plain, specific, sentence case, medically honest — ranges not hype ("typically 10–15%"), small-print disclaimers near clinical claims. NEVER invent doctor names, testimonials, ratings, or prices.
- Fully responsive to 360px, keyboard accessible, visible focus rings, labels on every input.

### PAGES

**1. Home (/)**
- Hero (~85vh, 2 columns): eyebrow "Doctor-led telehealth"; H1 `Feel like yourself again.` (dotted underline on "yourself"); lede: "Weight loss. Hair growth. Sexual health. Three different journeys — one honest starting point: a private five-minute consultation, reviewed by a real doctor."; big button "Start consultation"; small line "Free to start · 5 minutes · Confidential"; pen note "no waiting rooms →". RIGHT: patient chart card "PATIENT CHART — CONFIDENTIAL" with rows GOAL → handwritten "feel healthy again"; CONSULTATION → "5 minutes, online"; DOCTOR REVIEW → "within 24 hours"; YOUR PLAN → "personal, evidence-based"; FOLLOW-UP → "always included"; a rotated "Reviewed" stamp overlapping its corner.
- What we treat (alt bg): 3 cards (Weight loss / Hair growth / Sexual health) with line-art icons, two honest sentences each, a "typically…" expectation line, arrow links to their pages.
- How it works: 4 numbered steps — 01 Share your story, 02 A doctor reads it (within 24 hours), 03 Your plan arrives (treatment only when appropriate, clear pricing first), 04 We stay with you. Pen note: "same four steps, every goal".
- The standard (dark section): stats 5 min / <24 hrs / 100% of charts read by a physician + 3 principle lines (no auto-prescriptions; private by design; follow-up included, not an upsell).
- FAQ (5 accordion items incl. honest "Will I definitely get medication?" → no, only if appropriate; "What does it cost?" → consultation free, clear pricing before treatment).
- Final CTA.

**2. Weight Loss (/weight-loss)** — every CTA passes goal=weight-loss to the consultation
- Hero: H1 `Lose the weight. Keep the life.` (underline "Keep") + chart card "WEIGHT — EXPECTED COURSE": Months 1–3 "appetite quiets down" / 3–6 "steady, visible loss" / 6–12 handwritten "10–15% of body weight" / After "maintenance, not rebound" + small disclaimer.
- Interactive mini-calculator: one weight input with kg/lb toggle → live result "Typically X–Y kg in 6–12 months" (X = 10% of weight, Y = 15%), handwritten number styling, disclaimer "Estimate only — your doctor sets a personal target", CTA.
- The science: 3 cards — GLP-1 medication if appropriate / a metabolic look under the hood (thyroid, sleep, meds) / habits that survive real life.
- Who this is NOT for (honesty section): pregnancy or breastfeeding, history of medullary thyroid cancer or MEN2, eating disorders (need dedicated care), under 18 — framed kindly.
- FAQ (4) + final CTA.

**3. Hair Growth (/hair-growth)** — goal=hair-growth
- Hero: H1 `Your hair has a window.` (underline "window"); lede about pattern loss being progressive — follicles kept today are the ones you can save. Chart card "HAIR — TREATMENT TIMELINE": 1–3 shedding stabilises / 3–6 first regrowth / 6–12 handwritten "visible density returns" / ongoing "keep what you regrew".
- The science: first-line medication (finasteride/minoxidil, doctor decides; ~9 in 10 men stop further loss) / root causes checked (thyroid, iron, hormones — for women hair loss is often a symptom first) / a 12-month plan.
- For men / for women: two honest side-by-side cards.
- Expectation strip: "Month 3 usually looks like nothing. Month 9 is when other people notice." + pen note "patience is the active ingredient".
- FAQ (4) + final CTA.

**4. Sexual Health (/sexual-health)** — goal=sexual-health, discreet and adult, zero sleaze
- Hero: H1 `The visit most men keep postponing.` (underline "postponing"). Chart card "PRIVACY — BY DESIGN": YOUR CHART → "encrypted, care team only" / PACKAGING → "plain and unmarked" / YOUR DOCTOR → "licensed physician" / SMALL TALK → handwritten "none".
- What we treat: ED (proven daily or on-demand options; affects ~half of men over 40 at some point) / PE / low testosterone (symptoms + labs, never guesswork).
- Dark section "Sometimes it's not about sex at all." — ED can be an early cardiovascular/metabolic signal; that's why the consultation reviews your whole history.
- Privacy points, FAQ (4), final CTA.

**5. About (/about)**
- H1 `Care worth trusting.` (underline "trusting"). Story: founded by a US-trained physician (NO invented name) — "the standard of care shouldn't depend on the length of the queue."
- "What live naturally actually means": medicine as a bridge, not a subscription trap — treat, stabilise, then the least medicine your health needs.
- 3 principles: We listen first / We prescribe only when appropriate / We follow up.
- Safety & privacy section, dark stats section, final CTA.

**6. Consultation (/consultation) — THE MOST IMPORTANT PAGE. A 6-step wizard.**
Two columns on desktop: the form inside a patient chart card titled "SUGA.HEALTH — CONFIDENTIAL PATIENT INTAKE", plus a sticky sidebar chart card "YOUR CHART" that fills in LIVE as the user types (Goal, Name, Age/Sex, Height/Weight, BMI, Conditions, Medications, Allergies — empty rows show a dash). Under it a pen note: "a real doctor reads every line". Progress bar "Step N of 6". Back/Continue, per-step validation with inline red errors, Enter advances. Save a draft to localStorage and restore it on reload. Read ?goal= from the URL to preselect step 1.

- **Step 1 — What brings you in today?** Three selectable cards: Weight loss / Hair growth / Sexual health. Note: "All three start with the same consultation — your doctor tailors everything after this."
- **Step 2 — About you.** Full name; Age (block under 18 with "Suga.health treats adults 18 and over."); Sex at birth segmented control Female/Male/Other (Other reveals an optional text field). Note that sex at birth is needed for safe prescribing.
- **Step 3 — Your body.** Metric/Imperial toggle (cm+kg vs ft·in+lb, converts entered values). Height + Weight. When both valid, AUTO-POPULATE a live callout: BMI to 1 decimal with category; if BMI ≥ 25 show potential weight loss: low = 10% of weight, high = min(18% of weight, weight − 21×height²m), rounded — "Patients starting where you are typically lose LOW–HIGH kg (10–18% of body weight) over 6–12 months with medical support." + disclaimer "An estimate, not a promise — your doctor will set a personal target." If BMI < 25 show a green healthy-range message instead.
- **Step 4 — Medical history.** (a) Current conditions: autocomplete tag picker over this ICD-10 list (search by name or code, keyboard navigable, selected items become removable chips showing name + code; free text allowed as custom chip; a "No current medical conditions" checkbox clears/disables it): I10 High blood pressure; E11.9 Type 2 diabetes; E78.5 High cholesterol; E66.9 Obesity; K21.9 Acid reflux (GERD); E03.9 Underactive thyroid; E05.90 Overactive thyroid; E28.2 PCOS; G47.33 Sleep apnea; F32.9 Depression; F41.9 Anxiety; J45.909 Asthma; M10.9 Gout; N18.9 Chronic kidney disease; K76.0 Fatty liver; I25.10 Coronary artery disease; I48.91 Atrial fibrillation; E55.9 Vitamin D deficiency; D50.9 Iron-deficiency anemia; L64.9 Pattern hair loss; L63.9 Alopecia areata; L21.9 Seborrheic dermatitis; N52.9 Erectile dysfunction; F52.4 Premature ejaculation; E29.1 Low testosterone; N40.0 Enlarged prostate; F51.01 Insomnia; G43.909 Migraine; M54.5 Low back pain; K58.9 IBS; L40.9 Psoriasis; L20.9 Eczema; I63.9 Prior stroke; Z86.711 History of blood clots; B18.2 Chronic hepatitis C; E10.9 Type 1 diabetes. (b) Surgical history textarea (placeholder: "e.g. Appendix removal (2015), C-section (2019) — or leave blank"). (c) Family history multi-select chips: Diabetes, Heart disease, High blood pressure, High cholesterol, Cancer, Thyroid disorder, Obesity, Hair loss, Depression or anxiety, None of these ("None" clears others) + optional detail box.
- **Step 5 — Medications & allergies.** (a) Medications tag input with suggestions (Metformin, Insulin, Atorvastatin, Rosuvastatin, Amlodipine, Telmisartan, Losartan, Metoprolol, Aspirin, Levothyroxine, Sertraline, Escitalopram, Omeprazole, Pantoprazole, Vitamin D3, Multivitamin, Sildenafil, Tadalafil, Finasteride, Minoxidil) + "I do not take any medications" checkbox. (b) Allergies tag picker with suggestions: No known allergies; Penicillin; Sulfa drugs; Aspirin; NSAIDs; Codeine or other opioids; Local anaesthetics; Contrast dye; Latex; Eggs; Peanuts; Tree nuts; Shellfish; Soy; Dairy (lactose); Gluten; Dust mites; Pollen; Insect stings; Pet dander. "No known allergies" is mutually exclusive with the rest. Free text allowed.
- **Step 6 — Last things.** "Anything else your doctor should know?" textarea (optional) + three required consent checkboxes: "I confirm the information I provided is true and complete", "I consent to telehealth care — my consultation will be reviewed remotely by a licensed physician who may contact me", "I accept the privacy terms — my health information is stored securely and shared only with my care team". Submit button "Send to my doctor" stays disabled until all three are checked.
- **On submit:** store the record (localStorage; generate a reference id like SH-XXXXXX) and show a success view: an ink stamp "Received", then "Thank you, {first name}." and then EXACTLY this sentence, prominent: **"A doctor will review this and get back to you soon."** — followed by a full chart-card summary of everything entered, the reference id, a handwritten sign-off "— we'll take it from here", and a link back home. No confetti, no emoji.

Build all six pages now with this exact system.

---

## PROMPT 2 — polish pass (send after reviewing the first build)

Polish pass, change nothing structural: 1) Verify every headline has exactly ONE red-dotted word and each page has max 2 handwritten pen notes and max 1 stamp — remove extras. 2) Check mobile at 375px: nav collapses, chart cards stack below hero text, wizard sidebar hides, no horizontal scroll. 3) Make all fade-up scroll reveals subtle (24px, 0.7s, once) and disable them under prefers-reduced-motion. 4) Confirm every CTA routes to /consultation with the right ?goal= param from condition pages. 5) Tighten hero whitespace and type scale so the first screen feels expensive — generous air, nothing cramped.

## PROMPT 3 — consultation flow test pass

Test the consultation wizard end-to-end and fix anything broken: age 17 must block with the adults-18+ message; switching metric→imperial must convert values both ways; BMI math must be kg/m²; the potential-loss estimate must only appear when BMI ≥ 25; "No known allergies", "No medications" and "No current medical conditions" must clear and disable their pickers; the ICD-10 autocomplete must work with keyboard arrows + Enter; submit must stay disabled until all three consents are checked; the draft must survive a page reload; and the success screen must contain exactly: "A doctor will review this and get back to you soon."
