# Shipfolio — Brand Guidelines

Version v1 · 2026-10-24. This file covers the whole brand: who we are, how we sound, and how we look. Detail for the logo is in `brand/logo/GUIDELINES.md`. The app's UI rules are in the root `DESIGN.md`. Marketing asset sizes are in the marketing plan's `DESIGN.md`. Positioning and audience are in `.agents/product-marketing.md`.

## 1. Who we are
- **Name:** Shipfolio. Written as one word, capital S. The wordmark is "ship" + "folio"; the lockup is drawn, never retyped.
- **What we do:** turn a resume into a live portfolio website, written for you, in about 30 seconds.
- **Idea behind the name:** a *folio* (a page) that you *ship* (launch). The logo is a leaf of paper with an upward chevron.
- **Promise:** your story, online today, and it's yours to keep.

## 2. Who we're talking to
Freshers, students and early-career professionals, mainly in India, who have a resume and no site. They are busy, price-sensitive and read on a phone. Talk to them as a capable friend would.

## 3. Voice
Four traits. Write every line so it passes all four.

| Trait | Do | Don't |
|---|---|---|
| **Plain** | Short words, short sentences, one idea per line | Jargon, buzzwords, long clauses |
| **Honest** | State what it does, what it costs, and what it can't do | Invent numbers, users or claims; hide the price |
| **Quick** | Get to the point; respect the reader's time | Pad, tease, or make them hunt |
| **Encouraging** | Treat their work as worth showing | Cheerlead, flatter, or hype |

### Tone by context
- **Product UI:** clear and calm. Verbs first ("Upload your resume").
- **Errors:** say what happened and what to do next. Never blame the user. ("We couldn't read that file. Try a PDF under 5 MB.") **[confirm the real limit before using this example]**
- **Support:** warm, direct, fix first, apologise once.
- **Launch posts:** a short true story in the first person; specific; no hype words.
- **Social:** the founder speaking, one idea per post, a real before/after.
- **Pricing and billing:** exact amounts and dates, up front. $9 / ₹499 once; hosting renews $7.99 / ₹449 per year from year two.

### Words
| Use | Avoid | Why |
|---|---|---|
| resume, portfolio, live link, your site | "AI-powered", "revolutionary", "synergy", "platform" | Vague or hype |
| free preview, yours to keep | "no subscription" | Hosting renews from year two |
| in minutes, about 30 seconds | "instant", "magic" | We measure ~20–30 s; don't overclaim |
| built from your resume | "we know you", invented claims | Only use what's in the resume |
| Pro, hosting | "premium", "VIP" | Keep the names we use in the product |

### Writing rules
1. Lead with what the reader gets.
2. One call to action per message.
3. Numbers must be real and checkable; if unsure, leave it out.
4. Indian rupee prices use ₹ and are fixed, not converted on the fly; show both only where the reader's region is unknown.
5. Avoid the "it's not X, it's Y" pattern and lists of "no X, no Y, no Z".
6. Read it aloud. If you'd not say it to a friend, rewrite it.

### Messaging pillars
1. **Fast:** a live portfolio from your resume in about 30 seconds.
2. **Made for you:** each site is written from your resume, not filled into a template.
3. **Yours to keep:** clean HTML, zip, GitHub, your own domain.
4. **Honest:** checked against your resume; private by default; clear price.

### Taglines (pick one per surface; do not mix)
- Primary: **Turn your resume into a live portfolio.**
- Alternates: **Your resume, as a website.** · **Live in minutes, not weeks.**

## 4. Visual identity
### Logo
Leaf Launch in the Aurora colourway. Use the files in `brand/logo/svg/`. Clear space 1 × x (about a quarter of the symbol height). Minimum width: lockup 96 px, symbol 24 px. Don'ts: stretch, recolour, add shadows or glows, reorder the gradient, retype the wordmark.

### Colour
| Name | Hex | Role |
|---|---|---|
| Aurora Blue | `#3457E8` | Primary accent, buttons, links |
| Aurora Cyan | `#06B6D4` | Focus, gradient middle |
| Aurora Mint | `#34D399` | Success, gradient end |
| Graphite | `#0B0D12` | Dark background |
| Ink | `#14161C` | Cards, panels |
| Slate | `#232732` | Borders |
| Mist | `#F6F6F3` | Text on dark, light background |
| Fog | `#9AA0B0` | Secondary text |

The gradient runs blue → cyan → mint, top-left to bottom-right (headline word: left to right). Use it once per layout. Never put body text in it.

### Typography
Inter everywhere. Fallback `system-ui, -apple-system, "Segoe UI", sans-serif`. Headlines Black or ExtraBold with tight tracking, max two lines. Body Regular. Numbers and short labels may use a mono face.

### Imagery
Real screenshots of real Shipfolio sites, shown as a before/after next to the resume. Use a person's site or name only with their permission. No stock photos, fake dashboards or invented testimonials.

### Motion
Short, soft and purposeful. In the app and video: ease-out, under 400 ms for UI, no flashing. Respect reduced-motion settings.

## 5. Accessibility
Text contrast at least 4.5:1. Never use colour alone to carry meaning. Alt text on every image, captions on every video, focus rings (Aurora Cyan) always visible.

## 6. Applying the brand
| Surface | Rule |
|---|---|
| Website / app | Dark by default; Aurora Blue for the primary button; one gradient accent |
| Social posts | One headline, one visual, one logo, one link |
| Product Hunt / directories | Symbol on Graphite tile; 5 gallery images |
| Email | Mist background, Ink text, Aurora Blue button |
| Checkout | Logo from `brand/logo/png/app-icon-dark-1024.png` |
| Documents | Inter, Ink on Mist |

## 7. Do and don't, in one glance
Do: say it plainly · show real work · state the price · keep one idea per asset.
Don't: hype · invent numbers · say "no subscription" · use stock images · bend the logo or gradient.

## 8. Open items
- Trademark search for the name and mark has not been done.
- The wordmark is Inter Bold, not custom lettering.
- The logo is not yet wired into the app header, favicon, OG image or Dodo checkout (see the project notes).
- Voice traits are drawn from the landing page and founder decisions; confirm or edit them.
