# Shipfolio — Design Contract & Design System (DESIGN.md)

This document defines the authoritative design contract for **Shipfolio** (`portfolio-builder-saas`). All user interface surfaces, components, and interactions adhere strictly to these principles and tokens, codified in accordance with `taste-skill` standards.

---

## 1. Design Read

* **Product Category:** Developer & Creator Career SaaS (AI Resume-to-HTML Portfolio Builder & Deployment Platform).
* **Target Audience:** Software engineers, systems architects, tech students, product builders, recruiters, and hiring managers.
* **Aesthetic Language:** Obsidian graphite surfaces, Electric Blue accents (`#3457E8` / `rgb(52, 87, 232)`), fluid WebGL motion (`FluidOrb`), high contrast, crisp typography, and zero generic AI slop.
* **Design Dials:**
  * `DESIGN_VARIANCE: 8` (Intentional asymmetry, dynamic bento rhythms, high editorial distinction).
  * `MOTION_INTENSITY: 6` (Fluid WebGL shader canvas, organic physics on primary surfaces, micro-tactile button responses).
  * `VISUAL_DENSITY: 4` (Generous breathing room, clear hierarchy, zero cluttered cockpits).
* **Model Output Philosophy:** No rigid JSON steps or static themes. The LLM writes clean, bespoke, self-contained HTML/CSS directly based on the user's resume, design intensity (Minimal vs. Bold), reference screenshots, and guardrail rules. The resulting HTML is displayed inside a sandboxed iframe in Studio.

---

## 2. Hard Layout Principles

1. **Viewport Stability:**
   * Full-height sections use `min-h-[100dvh]`, never `h-screen`, preventing mobile browser bar jumping.
   * Hero top padding is strictly capped at `pt-20` / `pt-24` on desktop so content never floats awkwardly far down the screen.
   * `overflow-x: clip` on `html, body` (never `overflow-x: hidden`, which breaks sticky elements).

2. **Hero Stack Discipline (Max 4 Text Elements):**
   * Eyebrow: At most one single eyebrow or brand badge.
   * Headline: Maximum 2 lines on desktop; tightly tracked (`tracking-tighter`).
   * Subtext: Maximum 20 words, max 3–4 lines, relaxed leading, max width 65ch.
   * CTAs: 1 primary + max 1 secondary. Visible above the fold without scrolling.
   * Banned in hero: Micro trust walls, lengthy feature bullets, pricing teasers.

3. **Eyebrow Restraint:**
   * Maximum 1 eyebrow label per 3 sections.
   * Never repetitively tag every section with uppercase monospace labels. Let headlines and spatial hierarchy do the framing.

4. **Section Layout Rhythm & Anti-Repetition:**
   * Bento grids must feature exact cell counts (no orphaned empty tiles) with visual variation (tinted cards, gradient highlights, shader accents).
   * Zigzag alternation ("left-image / right-text") capped at max 2 consecutive blocks. Break the pattern with full-width showcases, interactive terminals, or bento layouts.

5. **Navigation Discipline:**
   * Single-line layout on desktop up to breakpoints. Height capped at 56px–64px (`h-14` / `h-16`).
   * Backdrop blur (`backdrop-blur-md`) with subtle border separator (`border-border/80`).

---

## 3. Typography Hierarchy

* **Display / Headlines:**
   * Hero: `text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08]`.
   * Section Titles: `text-2xl sm:text-4xl font-extrabold tracking-tight`.
   * Sub-headings: `text-lg sm:text-xl font-semibold text-foreground`.
* **Body Copy:**
   * Paragraphs: `text-sm sm:text-base text-muted-foreground leading-relaxed max-w-[65ch]`.
   * Fine print / Captions: `text-xs sm:text-sm text-muted-foreground`.
* **Monospace & Code:**
   * Reserved for metrics, terminal commands, verified skill evidence, latency badges, and schema attributes.

---

## 4. Color Tokens & Theme Calibration

The application operates in **Dark Mode by default** (`<html class="dark">`). Token definitions live in `src/styles.css` matching Tailwind v4 conventions:

The palette is the logo's palette (source of truth: `brand/logo/GUIDELINES.md`). Tailwind classes: `text-aurora-blue`, `text-aurora-cyan`, `text-aurora-mint` and the semantic tokens below.

* **Aurora (accents):**
  * Aurora Blue `#3457E8` (`52 87 232`): the primary accent (`--accent`, buttons, links, active states), paired with `FluidOrb` (`color="#3457E8"`).
  * Aurora Cyan `#06B6D4` (`6 182 212`): focus rings (`--ring`) and the middle of the brand gradient.
  * Aurora Mint `#34D399` (`52 211 153`): success states (`--success`) and the end of the gradient.
  * Brand gradient: blue → cyan → mint, top-left to bottom-right (logo) or left to right (hero word: `--hero-word-gradient`). Never reorder it.
* **Neutrals (Graphite family):**
  * Canvas background (`--background`): Graphite `#0B0D12` (`11 13 18`)
  * Card surfaces (`--card`, `--muted`): Ink `#14161C` (`20 22 28`)
  * Borders and dividers (`--border`, `--secondary`): Slate `#232732` (`35 39 50`)
  * Foreground text (`--foreground`, `--primary`): Mist `#F6F6F3` (`246 246 243`)
  * Muted foreground (`--muted-foreground`): Fog `#9AA0B0` (`154 160 176`)
* **Status colours (not part of the brand palette):**
  * Success: Aurora Mint (above)
  * Warning: Amber (`251 191 36`)
  * Destructive: Rose (`244 63 94`)
* **Rule:** use tokens (`bg-card`, `text-success`, `border-destructive/30`), not raw Tailwind colours such as `emerald-500` or `rose-500`. The only hard-coded colours allowed are third-party brand marks (Google, Claude) and the inline-styled server pages (`sites-serve.ts`, `watermark.ts`, `authorize.ts`), which use the hex values above.

---

## 5. Motion & FluidOrb Integration

* **FluidOrb Canvas (`src/components/ui/fluid-orb.tsx`):**
  * Integrated into high-impact visual anchors using `#3457E8`:
    * **Hero Background & Showcase:** Provides organic depth behind the headline and interactive showcase mockup.
    * **AI Generation Status (Wizard Step 6):** Ambient processing core that pulses during generation.
    * **Auth Page (`/login`):** Ambient backdrop element providing high visual distinction.
    * **Settings:** Status accent card sphere.
* **Tactile Micro-Interactions:**
  * Buttons and interactive cards respond with `active:scale-[0.98]` or `-translate-y-0.5` on hover.
  * Transitions standardized at `transition-all duration-200 ease-out`.

---

## 6. Mobile Responsiveness & Viewport Discipline

* **Root-Level Overflow Isolation:**
  * `html, body { overflow-x: clip; }` prevents horizontal scroll jitter caused by scaled WebGL canvases.
  * `.no-scrollbar` utility enables touch-swipeable tab ribbons without intrusive scrollbars.
* **Header & Navigation Drawer:**
  * Sticky `h-14` navbar collapses navigation links into mobile sheet drawer.
  * Minimum 44px touch target height for mobile action items.
* **Studio Workspace:**
  * Responsive iframe preview with multi-viewport switching (Desktop, Tablet, Mobile) and safe sandbox isolation (`allow-scripts`).
