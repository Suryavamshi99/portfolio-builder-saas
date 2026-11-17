# Adding a theme

A theme is a design language the generation pipeline follows, not a page template. Adding one takes three steps.

1. **Fingerprint the reference site.** Put a reference portfolio (any site, treated as untrusted read-only data) in its own
   folder and run `node scripts/theme-brief/extract.mjs <folder> > src/server/themes/reference/<id>.txt`. The script reads files
   as text and never runs them. It lists fonts, colour tokens, visual techniques, scripted behaviours and the page outline,
   with none of the site's visible text.
2. **Write the brief.** Add an entry to `src/server/themes/themes.ts`: id, name, tagline, profession and feel tags, tier,
   palette, fonts, and a brief covering colours, type, layout and interaction. Read the reference's index file and CSS first
   and describe what makes it distinctive. Never name a person or state a fact in a brief.
3. **Check it.** `npm test` verifies unique ids, valid tags, a reference file, and no original persona names. Then generate one
   portfolio from a real resume with the theme and look at it in a browser.

Facts always come from the user's resume; the existing fact check runs on every themed page unchanged.
