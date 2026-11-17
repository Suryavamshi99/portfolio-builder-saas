import type { Theme } from "./types";

/**
 * The 13 design languages. Each brief describes a look and how the page behaves, never a person: every fact on the
 * finished page still comes only from the user's resume. Names, tiers and profession tags are working choices for the
 * owner to confirm.
 */
export const THEMES: Theme[] = [
  {
    id: "paper-sprint",
    name: "Sprint Wall",
    tagline: "Warm paper and bold type, like a product team's sprint wall.",
    profession: "Product",
    feel: "Editorial",
    tier: "free",
    palette: ["#f4f1ea", "#15171c", "#ffe14d", "#2f5cf0"],
    fonts: ["Syne", "Inter", "IBM Plex Mono", "Newsreader"],
    brief: `Design language: editorial product studio on warm paper.
Colours: paper #f4f1ea with a slightly darker paper #ebe6da for bands, near-black ink #15171c, one strong blue #2f5cf0, and a marker-yellow highlight #ffe14d used sparingly behind key words.
Type: Syne for large display headings (heavy, tight), Inter for body, IBM Plex Mono for small labels and numbers, Newsreader italic for pull quotes.
Layout: a slim sticky top bar with the name and section links. A hero with a very large headline and a short line under it. Then sections in this order when the resume has them: how they work, projects as big cards with a mock "device" frame or browser frame on one side, a big single result number, journey as a horizontal timeline, experience as a ledger of rows, wins, skills, contact.
Feel: confident and tidy, generous whitespace, thick rules, small mono captions. Cards lift slightly on hover. Reveal sections with a gentle rise on scroll. Show only what the resume supports; leave a section out rather than fill it.`,
  },
  {
    id: "wheat-brass",
    name: "Boardroom",
    tagline: "Calm serif pages that read like client slides.",
    profession: "Consulting",
    feel: "Editorial",
    tier: "free",
    palette: ["#f3ecdd", "#2b2317", "#e4cb91", "#b08a3e"],
    fonts: ["Fraunces", "Manrope"],
    brief: `Design language: consulting deck, printed on cream stock.
Colours: background #f3ecdd, text #2b2317, wheat #e4cb91 for panels, brass #b08a3e as the accent for rules and numbers, olive #8c8a5c as a quiet secondary.
Type: Fraunces for headings (large, high contrast, a little italic for emphasis), Manrope for body and labels.
Layout: each section reads like a slide: a short "answer first" headline, then supporting points in two or three columns, thin brass rules, small slide numbers in the corner. Cases appear as a structured sequence: situation, what they did, result. Experience as a clean table. Use simple inline-SVG charts only when the resume gives real numbers.
Feel: calm, authoritative, precise. Slow, subtle scroll reveals. Keep the writing tight and conclusion-first, using only facts from the resume.`,
  },
  {
    id: "route-board",
    name: "Road Trip",
    tagline: "Your projects as stops on a route.",
    profession: "Operations",
    feel: "App-style",
    tier: "free",
    palette: ["#eeede8", "#161c21", "#18222a", "#ff5a1f"],
    fonts: ["Barlow Condensed", "Inter Tight"],
    brief: `Design language: logistics and trip-planning interface.
Colours: paper #eeede8, ink #161c21, asphalt #11181d and #18222a for dark panels, signal orange #ff5a1f for actions and highlights, fog #dfe0db for dividers.
Type: Barlow Condensed in capitals for headings and labels, Inter Tight for body. Coordinates-style small labels are welcome.
Layout: a dark top bar like a booking tool. The hero is a "trip request" card: role, where they are based, what they are looking for, with a primary orange button. Work appears as numbered stops or work orders along a vertical route line; each stop shows the problem, the action and the result from the resume. A simple "plan your route" contact block and a short FAQ built only from resume facts.
Feel: efficient, operational, dependable. Clear hierarchy, strong buttons, smooth scroll. Only use facts from the resume.`,
  },
  {
    id: "two-ink",
    name: "Poster Pop",
    tagline: "Loud, colourful print-poster style.",
    profession: "Marketing",
    feel: "Editorial",
    tier: "free",
    palette: ["#f6f1e7", "#1a0f14", "#ff7a1a", "#e2007a"],
    fonts: ["Anton", "Bricolage Grotesque", "Space Mono", "Fraunces"],
    brief: `Design language: two-colour risograph print.
Colours: cream paper #f6f1e7, near-black #1a0f14, and exactly two inks: magenta #e2007a and orange #ff7a1a, overlapped with multiply blending so the overlap goes dark.
Type: Anton for huge condensed headlines, Bricolage Grotesque for body, Space Mono for small proof-sheet labels, Fraunces italic for asides.
Layout: a hero headline printed slightly off-register (two offset copies in the two inks). Campaigns or projects shown as "proof sheets" with crop marks and small mono captions. A short "brief me" contact block. Sections only for what the resume has: work, about, experience, wins, skills.
Feel: bold, a little cheeky, tactile. Light hover effects that shift the ink layers. Keep copy punchy but strictly factual to the resume.`,
  },
  {
    id: "stream-shelf",
    name: "Binge Shelf",
    tagline: "Your projects as shows on a streaming shelf.",
    profession: "Marketing",
    feel: "App-style",
    tier: "paid",
    palette: ["#141414", "#232323", "#ffffff", "#ff7a1a"],
    fonts: ["Inter", "Bebas Neue"],
    brief: `Design language: a streaming catalogue.
Colours: charcoal #141414, card #232323, text white, muted #b3b3b3, one orange accent #ff7a1a.
Type: Bebas Neue for the wordmark and row titles, Inter for everything else.
Layout: a billboard hero featuring the strongest project from the resume with a title, one-line summary and two buttons. Below, horizontal rows of poster-style cards (projects, then skills, then experience). Clicking a card opens a detail panel with the story from the resume. Rows scroll sideways; cards grow slightly on hover.
Feel: cinematic and immersive, dark, high contrast. Do not invent ratings, match scores or view counts. Only use facts from the resume.`,
  },
  {
    id: "deep-signal",
    name: "Data Glow",
    tagline: "Dark and glowing, with dots that settle into place.",
    profession: "Data",
    feel: "Playable",
    tier: "paid",
    palette: ["#03141a", "#0a2f37", "#3ee3c6", "#8ff5e2"],
    fonts: ["Cormorant Garamond", "Inter"],
    brief: `Design language: deep-water data lab.
Colours: background #03141a, panels #06222a and #0a2f37, text #eaf8f5, muted #a3c9c3, aqua accents #3ee3c6 and #8ff5e2.
Type: Cormorant Garamond for large elegant headings, Inter for body and chart labels.
Layout: a hero over a canvas of drifting points that gradually line up into a clean trend as the visitor scrolls (decorative only, no data claims). Projects as analysis write-ups: question, method, finding, taken only from the resume. Small inline-SVG charts only when the resume contains the numbers. Skills as a quiet list.
Feel: precise, calm and curious. Respect reduced-motion by making the canvas static. Do not invent any metric.`,
  },
  {
    id: "pixel-hall",
    name: "Pixel Quest",
    tagline: "Your career as a retro game, one level per chapter.",
    profession: "HR",
    feel: "Playable",
    tier: "paid",
    palette: ["#1b1240", "#6b55d9", "#6ce398", "#ff4fd8"],
    fonts: ["Silkscreen", "Tiny5", "IBM Plex Sans"],
    brief: `Design language: 8-bit adventure.
Colours: night #1b1240, sky #6b55d9, panel green #6ce398, paper #c9f7d9, ink #0c4d2b, neon accents pink #ff4fd8, cyan #3ef0ff, lime #c6ff4a, orange #ff8a3d, gold #ffd23f.
Type: Silkscreen and Tiny5 for headings and HUD, IBM Plex Sans for readable body text.
Layout: a start screen with a title and "press start". Each career area (experience, projects, skills, wins) is a "level" card or room with pixel-art decorations drawn in CSS or inline SVG, a progress bar for how many are visited, and keyboard and tap controls. Always include a visible "skip the game and read the full resume" link that shows everything as plain readable sections.
Feel: playful and warm. Everything the visitor reads must come from the resume; game flavour text must not state facts about the person.`,
  },
  {
    id: "deal-stage",
    name: "Movie Poster",
    tagline: "Every win gets its own poster card.",
    profession: "Sales",
    feel: "Editorial",
    tier: "paid",
    palette: ["#141210", "#f4ecdc", "#d9a441", "#d1504e"],
    fonts: ["Poiret One", "Big Shoulders Display", "Bricolage Grotesque"],
    brief: `Design language: a theatre bill and a trophy cabinet.
Colours: ink #141210, cream #f4ecdc, gold #d9a441, brick #d1504e, with small supporting colours plum #5c2b3d, teal #27957d and cobalt #4183c6 used to colour-code individual cards.
Type: Big Shoulders Display for huge headings, Poiret One for elegant small caps, Bricolage Grotesque for body.
Layout: a dramatic hero with an oversized name, a marquee ribbon of role keywords from the resume, then achievements or deals as poster cards, each in its own accent colour, with the number and what they did. Journey as a stage-curtain timeline, then contact on a gold band.
Feel: theatrical and confident, with smooth parallax. Only state results that appear in the resume.`,
  },
  {
    id: "grid-ledger",
    name: "Spreadsheet",
    tagline: "Your numbers in a live spreadsheet.",
    profession: "Finance",
    feel: "App-style",
    tier: "paid",
    palette: ["#f9fbfd", "#edf2fa", "#d3e3fd", "#0b57d0"],
    fonts: ["Inter", "Roboto", "Roboto Mono"],
    brief: `Design language: a spreadsheet workbook (no vendor logos or product names).
Colours: background #f9fbfd, toolbar #edf2fa, ink #1f1f1f, muted #5f6368, gridlines #e1e1e1, header #f8f9fa, selection #d3e3fd with blue #0b57d0.
Type: Inter or Roboto for UI, Roboto Mono for cell values.
Layout: a toolbar, a formula bar showing the selected cell's text, column letters and row numbers, and sheet tabs along the bottom: Summary, Experience, Projects, Skills, Contact. Each tab is a table built from resume facts; clicking a cell shows its full text in the formula bar. Keyboard arrows move the selection.
Feel: familiar, orderly and clever. Do not invent figures; only cells with resume facts. Keep a plain-text fallback for small screens.`,
  },
  {
    id: "atlas-desk",
    name: "Map View",
    tagline: "Your career as places on a map.",
    profession: "Founder's Office",
    feel: "App-style",
    tier: "paid",
    palette: ["#f0f4f9", "#ffffff", "#c2e7ff", "#0b57d0"],
    fonts: ["Inter", "Roboto"],
    brief: `Design language: a map and places application (no vendor logos or product names).
Colours: surface #f0f4f9, white cards, ink #1f1f1f, muted #5e5e5e, lines #e3e3e3, blue #0b57d0 and light blue #c2e7ff.
Type: Inter or Roboto.
Layout: a stylised map drawn in inline SVG or CSS as the backdrop (abstract shapes, no real geography claims). A floating search bar showing the person's name and role. A left drawer with place cards: each employer, project or education entry from the resume becomes a "place" with a short summary, dates and photos only if provided. A layers chip row to filter by experience, projects and education. A timeline directions panel from first role to latest.
Feel: friendly and exploratory. Everything shown must be a fact from the resume. Provide a plain list view for small screens.`,
  },
  {
    id: "play-desk",
    name: "Mini World",
    tagline: "Drive around a tiny 3D world; each stop is a chapter.",
    profession: "Founder's Office",
    feel: "3D",
    tier: "paid",
    palette: ["#17121b", "#2f2836", "#d5ff95", "#ef8f4f"],
    fonts: ["Amatic SC", "Nunito"],
    brief: `Design language: a toy-like 3D scene on a dark plum stage.
Colours: plum #17121b to #3b3243, lime #d5ff95, pink #ffceca, sand #ef8f4f, teal #2f9c97, white text.
Type: Amatic SC for big handwritten headings, Nunito for body.
Layout: a full-screen canvas scene drawn with an inline script (WebGL via a small hand-written renderer, or CSS 3D transforms if simpler) of a desk with a few chunky objects. Each object is a hotspot that opens a panel with part of the resume (experience, projects, skills, contact). Drag or arrow keys rotate the view. A persistent "read it as a page" button shows the same content as a plain accessible page, and that plain view is what loads when scripts or WebGL are unavailable.
Feel: charming and tactile. Only state facts from the resume. The page must be one self-contained HTML file with no external scripts.`,
  },
  {
    id: "mascot-guide",
    name: "Mascot",
    tagline: "A friendly character walks visitors through your page.",
    profession: "Sales",
    feel: "3D",
    tier: "paid",
    palette: ["#ebebea", "#111111", "#ffffff", "#5fb57a"],
    fonts: ["Archivo Black", "Inter"],
    brief: `Design language: a bold poster with a friendly illustrated mascot.
Colours: paper #ebebea, ink #111111, white, one fresh green #5fb57a.
Type: Archivo Black for huge headings, Inter for body.
Layout: a hero with an oversized name and a simple mascot drawn in inline SVG (a geometric character built from shapes, no real person likeness) whose eyes follow the cursor and who waves a pointing arm toward the next section. Sections: about, numbers (only real ones from the resume), work, experience, journey, wins, skills, contact. Smooth anchor scrolling with the mascot appearing in the margin with short pointer lines.
Feel: warm, loud and lovable. Only state facts from the resume. Respect reduced-motion by keeping the mascot static.`,
  },
  {
    id: "design-file",
    name: "Design Canvas",
    tagline: "Your work as frames you can pan and zoom.",
    profession: "Product",
    feel: "App-style",
    tier: "paid",
    palette: ["#e9e7e2", "#ffffff", "#dfff7a", "#3d3bf3"],
    fonts: ["Inter Tight", "IBM Plex Mono"],
    brief: `Design language: a collaborative design tool (no vendor logos or product names).
Colours: canvas #e9e7e2 with a faint dot grid #cfccc5, white panels, frame paper #fbf8f2, ink #141414, selection blue #0d99ff with soft #e5f4ff, accent blue #3d3bf3, lime #dfff7a for primary buttons, a red #e5322d tag.
Type: Inter Tight for UI and headings, IBM Plex Mono for small values.
Layout: a top toolbar with the file name and a Share button. A left layers panel listing frames (About, Experience, Projects, Wins, Skills, Contact). A large pannable and zoomable canvas holding those frames laid out side by side; clicking a frame selects it and shows its facts in a right inspector panel. Add a "Read all" toggle that lays every frame out as one plain page, and make that the default on small screens.
Feel: precise and tool-like. Do not simulate other visitors, comments or collaborators. Only state facts from the resume.`,
  },
];
