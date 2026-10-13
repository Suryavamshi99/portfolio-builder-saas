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

* **Primary Accent:** Electric Blue (`#3457E8` / `rgb(52, 87, 232)`), paired with `FluidOrb` WebGL shader (`color="#3457E8"`).
  * `--accent`: `52 87 232`
  * `--accent-foreground`: `255 255 255`
  * Active hover / glow: `#5B8CFF` to `#2A46D8` gradients.
* **Neutrals (Obsidian Dark Palette):**
  * Canvas Background (`--background`): `rgb(9, 9, 11)` (`9 9 11`)
  * Card Surfaces (`--card`): `rgb(24, 24, 27)` (`24 24 27`)
  * Borders & Dividers (`--border`): `rgb(39, 39, 42)` (`39 39 42`)
  * Foreground Text (`--foreground`): `rgb(250, 250, 250)` (`250 250 250`)
  * Muted Foreground (`--muted-foreground`): `rgb(161, 161, 170)` (`161 161 170`)
* **Semantic Accents:**
  * Success: Emerald Green (`rgb(34, 197, 94)` / `34 197 94`)
  * Warning: Amber (`rgb(251, 191, 36)` / `251 191 36`)
  * Destructive: Rose Red (`rgb(244, 63, 94)` / `244 63 94`)

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
