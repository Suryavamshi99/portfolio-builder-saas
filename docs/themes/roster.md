# Theme roster and port status

Status as of 2026-11-17. **No theme is marked ready.** A theme ships only after it renders in Brave beside its sample
with resume-shaped content and passes the checks in the plan (KTD9). The converter (`scripts/theme-port/port.mjs`)
produces a one-file template for all 13 samples; the table records what stops each one from being ready.

| Planned id | Profession / feel | Sample (read only) | Converter | Blocker found in Brave triage |
|---|---|---|---|---|
| design-file | Product / App-style | cur-48 | ports | Frames, pins and write-ups read `project_pages`, testimonials and values that a resume does not hold; needs per-frame guards |
| sprintboard | Product / Editorial | orig-01 | ports | Page script reads a missing form element value on load |
| boardroom-model | Consulting / Editorial | orig-02 | ports | Reads `title` of data the resume lacks; page is blank |
| route-run | Operations / App-style | orig-03 | ports | Route planner needs per-city distance (`km`) data |
| brief-room | Marketing / Editorial | orig-05 | ports | Script sets `content` on a meta element that is not present |
| stream-channel | Marketing / App-style | cur-49 | ports | Role picker works, but every title row needs the sample's campaigns; "Just read it" links to a page not ported |
| signal-lab | Data / Playable | orig-09 | ports | Bundled script has a syntax error after conversion |
| pixel-quest | HR / Playable | cur-30 | ports | Needs WebGL; one stylesheet is a blocked `data:` URL |
| deal-floor | Sales / Editorial | cur-27 | fails | esbuild bundle error on the sample's module graph |
| deal-sheet | Finance / App-style | prd-10 | ports | Workbook builder reads fields (`why`) the resume lacks |
| map-room | Founder's Office / App-style | prd-08 | ports | Fetches `content/maps.json`, blocked by the published-page CSP |
| driveable-desk | 3D | cur-12 | fails | Voice-agent code is inside the bundle; port stops by design |
| guide-character | 3D | cur-03 | fails | Voice-agent code is inside the bundle; port stops by design |

## Libraries
three 0.160.1 (MIT), lenis 1.3.27 (MIT), esbuild 0.28.2 (MIT), gsap 3.15.1. **GSAP's standard licence needs a
commercial-use check by the owner; unresolved.** Nothing is bundled into a shipped page until a theme is ready.

## Known gaps
Only each sample's `index.html` is converted. User photos are not supported in v1.
