# Product Marketing Context

**Document version:** v1
**Last updated:** 2026-10-24

> Auto-drafted from the codebase (README, landing page `src/routes/index.tsx`, `docs/pricing-strategy.md`, `docs/PAYMENTS_GO_LIVE.md`) and the 2026-10-24 marketing plan. Items marked **[TBD]** or **[unverified]** need the owner's confirmation. Competitor details are from memory, not checked.

## Product Overview
**One-liner:** Turn your resume into a live portfolio website, written just for you, in about 30 seconds.
**What it does:** You upload a resume. Shipfolio writes a one-of-a-kind website from it (not a template), checks it against your resume so it only states what is true, and gives you a live link, a downloadable site, or a push to your own GitHub or Vercel. You can build free with a watermarked preview.
**Product category:** Resume-to-portfolio website builder (people search "portfolio website from resume", "AI portfolio builder", "free portfolio maker").
**Product type:** SaaS, consumer / prosumer, self-serve.
**Business model:** Free watermarked preview. One payment unlocks Pro: **$9 (₹499 in India)**, includes clean HTML, zip export, GitHub push, Vercel deploy and **1 year of hosting** with a custom domain. Hosting then renews at **$7.99/yr (₹449)**. Payments by Dodo. Also works with the user's own Claude, ChatGPT or Gemini.

## Target Audience
**Target companies:** Individuals, not companies.
**Decision-makers:** The user is the buyer.
**Primary use case:** "I need a portfolio site to show recruiters, and I don't have the time or skill to build one."
**Jobs to be done:**
- Look credible to a recruiter or client without hiring a designer.
- Get a link I can put on my resume and LinkedIn today.
- Own my site and not be locked into a tool.
**Use cases:**
- Freshers and students in placement season (CS, design, MBA), mainly India.
- Early-career professionals changing jobs (consulting, analytics, sales, product).
- Career switchers and freelancers who need a quick site.
- Developers who want a site and the code to keep.

## Personas
B2C only; one buyer. Variants of the same person:
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Fresher / student | Getting shortlisted, low cost, speed | No portfolio, no design skill, tight budget | A professional site in minutes for the price of a few coffees (₹499) |
| Early-career professional | Looking senior and polished | Resume reads flat; no time | Your experience, presented so recruiters click through |
| Developer / freelancer | Owning the code, clients | Doesn't want to spend a weekend on a site | Clean HTML you own, push to GitHub, deploy anywhere |

## Problems & Pain Points
**Core problem:** A resume is a flat list. Recruiters want something to click through, but building a site takes hours or money.
**Why alternatives fall short:**
- Free DIY (GitHub Pages, Notion): free but slow, and the result often looks plain. **[unverified]**
- Template builders (Carrd, Framer, Wix): you still fill in the template and make design decisions; monthly plans. **[unverified]**
- Hiring a designer: costs far more than a student can pay.
- Doing nothing: the most common choice.
**What it costs them:** Hours or weeks of time, a weaker first impression, missed shortlists.
**Emotional tension:** "Everyone else has one." Fear of looking unprofessional; procrastination guilt.

## Competitive Landscape
**Direct:** Other AI portfolio builders (names [TBD], research needed). Fall short on: [TBD].
**Secondary:** Template builders (Carrd, Framer, Webflow, Wix) and link-in-bio pages. Fall short because the user does the design work and pays monthly.
**Indirect:** GitHub Pages / Notion / Google Sites, a freelance designer, or a plain PDF resume. Fall short on time, cost or polish.

## Differentiation
**Key differentiators:**
- Each site is written for you from your resume, not filled into a template.
- Fact-checked against your resume; it does not invent claims.
- You own the output: clean HTML, zip, GitHub push, your own Vercel, custom domain.
- Free to build and preview; $9 / ₹499 once, not a monthly plan.
- Fast: builds take roughly 20–30 seconds on production (measured by the owner).
- Works with your own Claude, ChatGPT or Gemini.
**How we do it differently:** AI writes a bespoke page, then automated checks compare it with the resume.
**Why that's better:** Less work, a result that does not look like everyone else's, and no lock-in.
**Why customers choose us:** "Convenient", "fast", "no hosting or design to think about" (see Customer Language).

## Objections
| Objection | Response |
|-----------|----------|
| "Is AI going to make things up about me?" | The site is checked against your resume; it only uses what you provided. You can edit it. |
| "Why pay when GitHub Pages is free?" | Free is fine if you have a weekend. $9 / ₹499 buys the design, hosting for a year and a custom domain. You can also download the code and host it free. |
| "Will it look like everyone else's?" | No fixed templates; each page is written for the person. See the examples. |
| "Is my data safe?" | Private by default, keys encrypted; privacy page is live. |
| "What happens after year one?" | Hosting renews at $7.99 / ₹449 and you can cancel. Your downloaded files are yours. |

**Anti-persona:** Agencies and teams needing custom design systems, people wanting a multi-page business site or an online store, anyone who wants pixel-level control.

## Switching Dynamics
**Push:** Resume is flat; recruiters ask for a portfolio; DIY is taking too long.
**Pull:** Live site in minutes, looks sharp, you own it, low one-time price.
**Habit:** Sending a PDF; "I'll do it later"; sticking with Notion or a half-built site.
**Anxiety:** Will it be accurate? Will it look generic? Will the price jump? Can I leave?

## Customer Language
**How they describe the problem:** **[TBD, no interviews yet.]** Placeholders to confirm: "I need a portfolio", "my resume doesn't show what I did".
**How they describe us** (from the landing page, shown "with permission"):
- "Went from a stack of PDF drafts to a live site in one sitting — genuinely convenient."
- "Turned a few years of experience into something recruiters could click through, not just skim."
- "I didn't have to think about hosting or design, just my own story."
- "Loved how fast it was. My numbers finally had a place that looked as sharp as they are."
- "Made turning consulting case work into something presentable way less painful than I expected."
**Words to use:** resume, portfolio, live link, your site, in minutes, yours to keep, free preview.
**Words to avoid:** "no subscription" (hosting renews from year two), "revolutionary", "AI-powered synergy", "platform", and any claim that cannot be backed.
**Glossary:**
| Term | Meaning |
|------|---------|
| Studio | Where you preview, edit and publish your site |
| Free preview | Watermarked build you can view before paying |
| Pro | The $9 / ₹499 one-time unlock |
| Hosting | Your site at shipfolio.xyz/s/yourname, free for year one with Pro, then $7.99 / ₹449 per year |

## Brand Voice
| Attribute | Means | Doesn't mean | Example line |
|-----------|-------|--------------|--------------|
| Plain | Short words, short sentences | Dumbed down | "Live in minutes, not weeks" |
| Honest | Says what it does and what it costs; no invented claims | Hedging | "Free to build · Private by default" |
| Quick | Respects the reader's time | Rushed or sloppy | "Resume to live portfolio in minutes" |
| Encouraging | Treats the reader's work as worth showing | Cheerleading | "My numbers finally had a place that looked as sharp as they are" (customer) |
Full voice rules are in `brand/brandguidelines.md`.

**Tone by context:**
- Support: warm, direct, fix first.
- Launch: story-led, specific, no hype.
- Errors: say what happened and what to do next; never blame the user.
- Sales: no pressure; price shown up front.
- Social: personal, founder voice, one idea per post.
**Terms we own:** "resume to live portfolio", "yours to keep".
**Never use (and why):** "no subscription" (not true after year one); "AI magic" (vague); invented user counts (we do not have them).

## Proof Points
**Metrics:** None verified yet. Do not cite user counts. Build time ~20–30 s on prod (owner measurement, 2026-10).
**Customers:** Five named users on the landing page with permission to share (see quotes above).
**Testimonials:** See Customer Language.
**Value themes:**
| Theme | Proof |
|-------|-------|
| Fast | 20–30 s builds; "loved how fast it was" |
| No design work | "Didn't have to think about hosting or design" |
| Credible result | "Recruiters could click through" |
| You own it | Clean HTML, zip, GitHub push, custom domain (Pro) |

## Goals
**Business goal:** 1,000 free signups in the 10-day sprint starting 2026-10-24, then first paid buyers and a repeatable channel.
**Conversion action:** Sign up and upload a resume, then upgrade to Pro.
**Current metrics:** Real external numbers **[TBD]**. Database snapshot 2026-10-24: 7 accounts, 4 portfolios, 1 purchase (mostly owner / test).

## Paid Ads (optional)
Not running ads. Budget $0. Skip until CAC is measured.

## Learnings
*Decisions and tested lessons. Newest first. Keep it to about 20 active entries.*
| Date | Learning | Evidence | Applies to | Status |
|------|----------|----------|------------|--------|
| 2026-10-15 | Never say "no subscription" in the UI or copy | Owner principle; hosting renews from year two | All copy | active |
| 2026-10-15 | Fewer clicks means more payments | Owner principle | Checkout, onboarding | active |
| 2026-10-24 | Free-build capacity is ~30/day, so traffic spikes need a queue message | Project notes | Launch plan | watch |

## Changelog
*Newest first. One line per revision: what changed and why.*
- v1 (2026-10-24) — Initial context auto-drafted from the codebase and the 10-day marketing plan.
