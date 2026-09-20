# Shipfolio — Design Contract & Design System (DESIGN.md)

This document defines the authoritative design contract for **Shipfolio** (`portfolio-builder-saas`). All user interface surfaces, components, and interactions adhere strictly to these principles and tokens, codified in accordance with `taste-skill` standards.

---

## 1. Design Read

* **Product Category:** Developer & Creator Career SaaS (AI Resume-to-Portfolio Builder & Edge Deployment Platform).
* **Target Audience:** Software engineers, systems architects, tech students, product builders, recruiters, and hiring managers.
* **Aesthetic Language:** Elite modern tech — obsidian graphite surfaces, Cyber Emerald accents (`#10B981`), fluid WebGL motion (`FluidOrb`), high contrast, crisp typography, and zero generic AI slop.
* **Design Dials:**
  * `DESIGN_VARIANCE: 8` (Intentional asymmetry, dynamic bento rhythms, high editorial distinction).
  * `MOTION_INTENSITY: 6` (Fluid WebGL shader canvas, organic physics on primary surfaces, micro-tactile button responses).
  * `VISUAL_DENSITY: 4` (Generous breathing room, clear hierarchy, zero cluttered cockpits).

---

## 2. Hard Layout Principles

1. **Viewport Stability:**
   * Full-height sections use `min-h-[100dvh]`, never `h-screen`, preventing mobile browser bar jumping.
   * Hero top padding is strictly capped at `pt-20` / `pt-24` on desktop so content never floats awkwardly far down the screen.

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

* **Primary Accent:** Cyber Emerald (`#10B981` / `rgb(16, 185, 129)`), synchronized with the `FluidOrb` WebGL shader.
* **Neutrals (Obsidian System):**
  * Light Mode: Background `rgb(250, 251, 253)`, Card `rgb(255, 255, 255)`, Border `rgb(226, 232, 240)`, Text `rgb(15, 23, 42)`.
  * Dark Mode: Canvas `rgb(10, 14, 20)`, Card `rgb(16, 22, 30)`, Border `rgb(28, 38, 52)`, Text `rgb(248, 250, 252)`.
* **Semantic Accents:**
  * Success: Emerald (`rgb(16, 185, 129)` / `rgb(52, 211, 153)` dark).
  * Warning: Amber (`rgb(217, 119, 6)` / `rgb(251, 191, 36)` dark).
  * Destructive: Rose (`rgb(225, 29, 72)` / `rgb(244, 63, 94)` dark).

---

## 5. Motion & FluidOrb Integration

* **FluidOrb Canvas (`src/components/ui/fluid-orb.tsx`):**
  * Integrated into high-impact visual anchors:
    * **Hero Background & Showcase:** Provides organic, living depth behind the hero headline and interactive showcase mockup.
    * **AI Generation Status (Wizard Step 6):** Serves as the dynamic AI processing core, pulsing with phase changes.
    * **Auth Page (`/login`):** Ambient accent card element providing visual sophistication.
    * **Dashboard & Settings:** Compact accent badge / status sphere communicating live state.
* **Tactile Micro-Interactions:**
  * Buttons and clickable cards respond with `active:scale-[0.98]` or `-translate-y-0.5` on hover.
  * Transitions standardized at `transition-all duration-200 ease-out`.

---

## 6. Mobile Responsiveness & Viewport Discipline

* **Root-Level Overflow Isolation:**
  * `html, body { overflow-x: hidden; }` prevents horizontal scroll jitter caused by scaled ambient WebGL canvas orbs (`scale-125`).
  * `.no-scrollbar` utility enables touch swipeable tab strips without jarring desktop scrollbars on iOS Safari and Chrome Android.
* **Header & Navigation Drawer:**
  * Sticky `h-14` navbar collapses navigation links on mobile into an animated hamburger menu (`Menu` / `X`).
  * Minimum 44px touch target height for mobile action items.
  * Primary guest CTA dynamically adapts label (`Create portfolio` on desktop, `Create` on small viewports <390px) to prevent button wrapping.
* **Fluid Breakpoints:**
  * Real Portfolios Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (single column on phones, 2-column split on tablets, 3 columns on desktop).
  * Interactive Demo Chrome: Browser URL chrome and tab strip stack with `flex-col sm:flex-row`, keeping Alex Chen sample output legible on all screens.
  * Studio Editor: Transitions from desktop split-screen view to responsive tabbed view with touch-scrollable section ribbon on mobile.