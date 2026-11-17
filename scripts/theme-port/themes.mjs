/**
 * Porting config: one entry per theme. `sample` and `inner` locate the extracted Portfolio Wall site (read only).
 * `person` is the sample's persona, replaced by placeholders and checked absent from the output.
 * `patches` are exact string edits; each must match the stated count or the port stops.
 */
export const SAMPLES_ROOT =
  process.env.THEME_SAMPLES_ROOT ??
  "/private/tmp/claude-501/-Users-suryavamshi-portfolio-builder-saas/856c15e4-0458-4c48-b6e7-5a5e79b2fc67/scratchpad/templates";

const T = (sample, inner, first, last, extra = {}) => ({ sample, inner, person: { first, last }, patches: [], ...extra });

export const THEMES = {
  "design-file": T("cur-48-dhiraj-chouhan--product-management", "kavya-menon-portfolio", "Kavya", "Menon", {
    initials: "KM",
    jsRename: { KAVYA: "OWNER" },
    fontMap: { '"Plex Mono"': '"IBM Plex Mono"' },
    googleFonts: ["Inter+Tight:wght@100..900", "IBM+Plex+Mono:wght@400;500"],
    patches: [
      // The sample's pins are the owner's own notes and invented replies; a user's page has none.
      { in: "js", from: "flag.style.left = (PROJ[0].x + PROJ[0].w * 0.5) + 'px'; flag.style.top = PROJ[0].y + 'px';", to: "if (PROJ[0]) { flag.style.left = (PROJ[0].x + PROJ[0].w * 0.5) + 'px'; flag.style.top = PROJ[0].y + 'px'; } else flag.remove();" },
      { in: "js", from: "PROJ[0].id", to: "(PROJ[0] || {}).id", count: 3 },
      { in: "js", from: "PROJ[0].name", to: "(PROJ[0] || {}).name" },
      { in: "js", from: "const img = (src, alt, cls = '', extra = '') => `<img", to: "const img = (src, alt, cls = '', extra = '') => !src ? '' : `<img" },
      { in: "js", from: " (${pn.pronouns})`]", to: "`]" },
      { in: "html", from: ", Product Manager</span>", to: "</span>" },
      { in: "js", from: "function buildPins() {", to: "function buildPins() { PINS = []; return;" },
      // The sample simulates other visitors moving around the file. On a real page that would be invented activity.
      { in: "js", from: "function buildVisitors() {", to: "function buildVisitors() { VIS.length = 0;" },
      // Hard-coded prose and numbers from the sample person: replaced by the user's own data or removed.
      { in: "js", from: "/ Product manager · ${esc(pn.location.split(' (')[0])}", to: "/ ${esc(pn.location)}" },
      { in: "js", from: "const tags = ['User interviews', 'SQL', 'Experiment design', 'Roadmapping'];", to: "const tags = Object.values(D.skills || {}).flat().slice(0, 4);" },
      { in: "js", from: "<div class=\"ab-card c1\"><b>−18%</b>manual ticket reassignments, routing beta at Freshworks</div>", to: "" },
      { in: "js", from: "<div class=\"ab-card c2\"><b>430</b>clinic bookings on WhatsApp in 10 weeks</div>", to: "" },
      { in: "js", from: "Available from. Looking for PM and APM roles in B2B SaaS or consumer services.", to: "${esc(pn.looking_for)}" },
      { in: "js", from: "<h2 class=\"fr-h2\">Four years at Freshworks, then a PGP and an internship</h2>", to: "<h2 class=\"fr-h2\">Roles and education</h2>" },
      { in: "js", from: "<p>Five results from Freshworks, Masters' Union, Slotwise and NIT Calicut. The project frames above show where each number came from.</p>", to: "" },
      { in: "js", from: "<li><a href=\"${esc(c.calendly)}\" target=\"_blank\" rel=\"noopener\"><span>Book a call</span><b>calendly.com/example</b></a></li>", to: "" },
      { in: "js", from: "<li><a href=\"${esc(c.substack)}\" target=\"_blank\" rel=\"noopener\"><span>Newsletter</span><b>Sunday Teardowns</b></a></li>", to: "" },
      { in: "js", from: "<b>linkedin.com/in/example</b>", to: "<b>LinkedIn</b>" },
      { in: "js", from: "<p>Hi, this file is my portfolio. Select any frame to see its facts in the panel on the right.</p><p>The numbered pins are my notes on each project, with replies from people I worked with.</p><p>Press <kbd>P</kbd> to click through the projects, or Read all for one long page.</p>", to: "<p>Select any frame to see its facts in the panel on the right.</p><p>Press <kbd>P</kbd> to click through the projects, or Read all for one long page.</p>" },
    ],
  }),
  sprintboard: T("orig-01-product-kavya", "kavya-menon-portfolio", "Kavya", "Menon", {
    initials: "KM",
    googleFonts: ["Syne:wght@400..800", "Inter:wght@100..900", "IBM+Plex+Mono:wght@400;500", "Newsreader:wght@200..800"],
  }),
  "boardroom-model": T("orig-02-consulting-riya", "riya-malhotra-portfolio", "Riya", "Malhotra", {
    initials: "RM",
    googleFonts: ["Fraunces:wght@100..900", "Manrope:wght@200..800"],
  }),
  "route-run": T("orig-03-supply-ops-aditya", "aditya-kulkarni-portfolio", "Aditya", "Kulkarni", {
    initials: "AK",
    googleFonts: ["Barlow+Condensed:wght@300;400;500;600", "Inter+Tight:wght@100..900"],
  }),
  "brief-room": T("orig-05-marketing-kabir", "kabir-sethi-portfolio", "Kabir", "Sethi", {
    initials: "KS",
    googleFonts: ["Anton", "Roboto+Flex", "Space+Mono:wght@400;700", "Bricolage+Grotesque:wght@300..800", "Fraunces:wght@300..800", "Gaegu:wght@700"],
  }),
  "stream-channel": T("cur-49-hank-leukart--marketing", "kabir-sethi-portfolio", "Kabir", "Sethi", {
    initials: "KS",
    fontMap: { '"Bebas"': '"Bebas Neue"' },
    googleFonts: ["Inter:wght@100..900", "Bebas+Neue", "JetBrains+Mono:wght@400"],
    patches: [
      { in: "html", from: "Every number on it comes from his own work.", to: "Every number on it comes from their own work." },
      { in: "js", from: "so he knows what to", to: "so they know what to" },
      { in: "js", from: "What he brings to a team", to: "What they bring to a team" },
      { in: "js", from: "tools he uses every week", to: "tools they use every week" },
      { in: "js", from: "Why hire him", to: "Why hire them" },
      { in: "js", from: "How he works", to: "How they work" },
    ],
  }),
  "signal-lab": T("orig-09-data-ishita", "ishita-banerjee-portfolio", "Ishita", "Banerjee", {
    initials: "IB",
    googleFonts: ["Cormorant+Garamond:wght@300;400", "Inter:wght@300..600"],
  }),
  "pixel-quest": T("cur-30-pixel-art-resume--hr", "nandini-reddy-portfolio", "Nandini", "Reddy", {
    initials: "NR",
    googleFonts: ["IBM+Plex+Sans:wght@400;600", "Silkscreen:wght@400;700", "Tiny5"],
  }),
  "deal-floor": T("cur-27-samuel-day--sales", "simran-kaur-gill-portfolio", "Simran", "Kaur Gill", {
    initials: "SG",
    fontMap: { '"Big Shoulders"': '"Big Shoulders Display"', '"Bricolage"': '"Bricolage Grotesque"' },
    googleFonts: ["Poiret+One", "Big+Shoulders+Display:wght@700;900", "Bricolage+Grotesque:wght@400..800"],
  }),
  "deal-sheet": T("prd-10-google-sheets--finance", "siddharth-jain-portfolio", "Siddharth", "Jain", {
    initials: "SJ",
    googleFonts: ["Google+Sans+Flex:wght@400..700", "Roboto:wght@400;700", "Material+Symbols+Outlined"],
  }),
  "map-room": T("prd-08-google-maps--founders-office", "vihaan-bhatt-portfolio", "Vihaan", "Bhatt", {
    initials: "VB",
    googleFonts: ["Google+Sans:wght@400..700", "Google+Sans+Text:wght@400;700", "Roboto:wght@400;700", "Material+Symbols+Outlined"],
  }),
  "driveable-desk": T("cur-12-bruno-simon--vihaan", "vihaan-bhatt-portfolio", "Vihaan", "Bhatt", {
    initials: "VB",
    googleFonts: ["Amatic+SC:wght@700", "Nunito:wght@400..800"],
  }),
  "guide-character": T("cur-03-mascot-portfolio-hero--vihaan", "vihaan-bhatt-portfolio", "Vihaan", "Bhatt", {
    initials: "VB",
    googleFonts: ["Archivo+Black", "Inter:wght@100..900"],
  }),
};
