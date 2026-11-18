import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

import { NO_CUSTOMISATIONS } from "../facts";
import { extractFactsHeuristic } from "../extract-facts";
import { renderTheme, templateIds } from "./index";

// Not a real test: `RESUME_FILE=<resume.txt> RENDER_OUT=<dir> npx vitest run src/server/themes/templates/render-resume.test.ts`
// parses a plain-text resume with the no-model fallback and renders every theme from it, so the whole chain can be seen in a browser.
const file = process.env["RESUME_FILE"];
const out = process.env["RENDER_OUT"];
it.skipIf(!file || !out)("renders every theme from a resume file", () => {
  const facts = extractFactsHeuristic({ resumeText: readFileSync(file as string, "utf8"), links: {} });
  expect(facts.name.length).toBeGreaterThan(0);
  mkdirSync(out as string, { recursive: true });
  writeFileSync(join(out as string, "facts.json"), JSON.stringify(facts, null, 2));
  for (const id of templateIds()) writeFileSync(join(out as string, `${id}.html`), renderTheme(id, facts, NO_CUSTOMISATIONS));
});
