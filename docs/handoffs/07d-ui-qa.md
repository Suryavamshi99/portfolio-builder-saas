# Handoff 07d: Visual QA pass of the new screens (find and fix UI bugs)

**Worktree / branch:** `/Users/suryavamshi/portfolio-builder-saas-07d` on `feat/07d-ui-qa`. **Rules:** `docs/handoffs/_rules.md`. UI files only (`src/routes/*.tsx`, `src/components/**`, `src/routes/-studio/**`, `src/lib/api-client.ts`); no migrations, nothing under `src/server/` or `src/routes/api/`.

## What to do
The app is live at `https://www.shipfolio.xyz` and the code is on `main`. Use your browser tool to walk every screen below **at 1280 px and 390 px width**, in light and dark theme if the app has both, as a logged-in test account (sign up with a throwaway email; payments are OFF in production so everything is unlocked). Screenshot each, and fix what is broken in code on this branch.

Screens: (1) wizard `/onboarding`: steps 1-6, especially the new "How should we generate it?" step with the three cards (Free / Claude-ChatGPT / Gemini key), the consent tick on the Free card, the progress and failure screens; (2) `/connect` (connector URL, copy button, both tabs, status badge); (3) `/studio`: toolbar, Publish dialog (name check states: checking / available / taken / reserved / not allowed; preview of the full address `https://www.shipfolio.xyz/s/<name>`), Export menu, Version history, regenerate-with-instructions and its progress; (4) `/settings`: Connected apps, GitHub, Custom domain sections.

Look for: overflow or clipped text at 390 px, buttons that do nothing or stay disabled forever, missing loading/empty/error states, raw JSON or error codes shown to users, copy buttons that don't copy, wrong or stale wording (for example mentions of an email being sent, of Gemma/OpenRouter model names, of the removed copy-paste path), keyboard focus problems (Tab order, Esc closes dialogs), contrast problems, and layout jumps. **Do not change behaviour or API calls**, and do not change the contracts in `api-client.ts`.

## Report
In your Handoff report list every issue as: screen, what was wrong, what you changed (or "not fixed, because ..."), and the screenshot file name (save screenshots under `docs/handoffs/07d-screens/`, PNG, under 400 KB each, at most 24 files). Any problem that needs a server change goes under "open questions" with the exact request/response you saw.

## Handoff report
