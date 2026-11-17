import type { ThemeManifest } from "../types";

const manifest: ThemeManifest = {
  id: "design-file",
  name: "Design File",
  tagline: "Your work laid out as frames on a design canvas you can pan, zoom and inspect.",
  profession: "Product",
  feel: "App-style",
  tier: "free",
  // Rendered in Brave beside its original with sample and minimal content on 2026-11-17: same canvas, layers panel and
  // inspector; the original's photo, simulated visitors and comment pins are left out because a resume holds none.
  ready: true,
  sections: [
    { id: "f-experience", label: "Experience" },
    { id: "f-wins", label: "Wins" },
    { id: "f-skills", label: "Skills" },
    { id: "f-contact", label: "Contact" },
  ],
  questions: [],
  cssVars: [
    { name: "--blue", label: "Accent colour" },
    { name: "--lime", label: "Highlight colour" },
    { name: "--paper", label: "Page paper colour" },
  ],
  fonts: ["Inter Tight", "Inter", "IBM Plex Mono"],
  fontVars: { display: "--font", body: "--font" },
  radiusVar: "--r-panel",
};

export default manifest;
