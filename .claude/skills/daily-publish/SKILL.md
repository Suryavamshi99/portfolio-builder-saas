---
name: daily-publish
description: Generate every content piece for one day of the Shipfolio marketing sprint (posts, images, video script), ready to publish. Runs Brainstorm, Draft, Audit using the marketing-skills social, copywriting, image and video skills, and saves everything to marketing-content/day-N/. Use when the user says "daily publish", "day 3 content", "generate today's posts", or "what do I post today".
---

# Daily Publish

Produces one day's publish-ready content in three fixed phases: **1) Brainstorm, 2) Draft, 3) Audit**. Output goes in `marketing-content/day-N/` (`day-1`, `day-2`, ...). The user only posts and replies; this skill never posts anything.

Usage: `/daily-publish [N]`. If N is missing, use the next day without a folder (day-1 if none exist). Ask only if the day cannot be worked out.

## Inputs to read first (stop and say so if one is missing)

1. `.agents/product-marketing.md`: positioning, audience, proof, words to avoid.
2. `brand/brandguidelines.md`: voice, messaging pillars, visual rules.
3. The day's row in `~/marketing-plans/shipfolio/sections/09.md` (task, channel, date). This sets which channels and pieces are needed. If the plan is absent, ask the user for the day's channel(s).
4. Previous days' folders: `marketing-content/day-*/results.md` and `audit.md`, so you do not repeat hooks and you carry forward what worked.
5. The marketing plan's `DESIGN.md` (`~/marketing-plans/shipfolio/DESIGN.md`) for image and video specs.

List the pieces the day needs (for example "Reddit post, LinkedIn post, 1 image, 1 short video") before starting, and keep the total to what the user can post in 30 minutes.

## Phase 1: Brainstorm

Skills: `marketing-skills:social`, `marketing-skills:marketing-ideas`, `marketing-skills:content-strategy`, `marketing-skills:community-marketing` (for Reddit and groups), `marketing-skills:launch` (for Show HN and Product Hunt days).

Write `brainstorm.md`:
- The day's goal, channel and audience (from the plan).
- 5-8 angles, each with: hook, the true story or proof behind it, why this channel, risk. Use only real facts from `.agents/product-marketing.md` (the five named testimonials, ~20-30 s build time, $9 / ₹499, free preview). Never invent users, counts, or results.
- Pick one primary angle per piece and say why. Do not reuse an angle from an earlier day unless the format changes.
- Community rules check for the channel (for example subreddit self-promotion rules). Mark anything that must be verified by the user.

## Phase 2: Draft

For each piece, use the matching skill. Save each in its own file.

| Piece | Skills | File |
|---|---|---|
| Post / thread / comment replies | `marketing-skills:social`, `marketing-skills:copywriting` | `01-<channel>-post.md`, `reply-bank.md` |
| Image or carousel | `marketing-skills:image` (brief and, if a tool is available, the file) | `images/<name>.md` plus the image or an HTML source |
| Video / short | `marketing-skills:video` (script, shot list, captions) | `video/script.md`, `video/captions.srt` if useful |
| Directory / Product Hunt / Show HN text | `marketing-skills:copywriting`, `marketing-skills:directory-submissions`, `marketing-skills:launch` | `0N-<name>.md` |

Every piece must include:
- Final copy, ready to paste. One call to action and one link with a UTM: `?utm_source=<channel>&utm_medium=<type>&utm_campaign=sprint1&utm_content=day-N`.
- Alt text for every image; captions for every video.
- A 3-5 line **reply bank** for expected comments (price, "is it free", "will AI make things up", "how is it different from templates").
- Visuals follow `DESIGN.md`: real before/after, Aurora palette, Inter, one idea per asset, sizes per channel.

Rules for drafting: plain language, short sentences, first-person founder voice for posts, no hype words, no "no subscription", price stated as $9 / ₹499 once, hosting renews from year two when pricing is discussed.

## Phase 3: Audit

Skills: `marketing-skills:copy-editing` for every text piece, plus the checklist below. Save to `audit.md`, then **fix every failure in the piece files** and re-run the failed checks. `audit.md` ends with PASS or a list of items the user must resolve.

Checklist (mark each piece pass / fixed / needs user):
- **Facts:** every claim traceable to `.agents/product-marketing.md` or the codebase; no invented numbers, users, quotes or results; testimonial names only from the landing page's permitted list.
- **Voice:** matches `brand/brandguidelines.md` (plain, honest, quick, encouraging); none of the avoided words; no "it's not X, it's Y" reveals, no "no X, no Y, no Z" lists.
- **Pricing:** no "no subscription"; $9 / ₹499 correct; hosting renewal not hidden.
- **Channel fit:** length, format and self-promotion rules for the channel; no spam patterns (identical text across subreddits).
- **Links:** one UTM link per piece, correct domain `https://www.shipfolio.xyz`.
- **Visual:** matches `DESIGN.md` (palette, type, safe area, size); before/after is real and labelled; alt text and captions present; legible at 360 px.
- **Privacy:** no real user data or screenshots without permission noted.
- **Ask:** exactly one call to action.

## Output structure

```
marketing-content/
  day-1/
    README.md        # the day at a glance: what to post, when (IST), in order, ~30 min plan
    brainstorm.md
    01-<channel>-post.md
    02-...
    reply-bank.md
    images/
    video/
    audit.md
    results.md       # blank template: signups per UTM, best comment, hours spent
  day-2/
  ...
```

`README.md` lists each piece, the posting time, the link to paste, and the 3 things the user must check by hand (for example subreddit rules, capacity message, discount code expiry). Create `results.md` with empty fields for the user to fill the next day; read it when planning the next day.

## Hard rules

- Never post, send, or submit anything. Drafts only.
- Do not create external accounts, buy anything, or change prices or discount codes.
- Do not overwrite an existing `day-N` folder; ask first, or write `day-N-v2`.
- If a marketing skill is not installed, say so and continue with the closest equivalent; do not skip a phase.
- Finish with a short summary: files created, audit result, and what the user needs to do in the 30-minute slot.
