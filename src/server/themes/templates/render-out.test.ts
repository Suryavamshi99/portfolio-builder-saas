import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "vitest";

import { NO_CUSTOMISATIONS, type Customisations } from "../facts";
import { renderTheme, templateIds } from "./index";
import { RICH_FACTS, SPARSE_FACTS } from "./fixtures";

// Not a real test: `RENDER_OUT=<dir> [RENDER_THEME=<id>] [RENDER_CUSTOM='{"accent":"#c2185b"}'] npx vitest run src/server/themes/templates/render-out.test.ts`
// writes <dir>/<id>.rich.html and <id>.sparse.html so a template can be opened in a browser next to its sample site.
const out = process.env["RENDER_OUT"];
it.skipIf(!out)("writes rendered templates to RENDER_OUT", () => {
  const custom: Customisations = { ...NO_CUSTOMISATIONS, ...JSON.parse(process.env["RENDER_CUSTOM"] ?? "{}") };
  const only = process.env["RENDER_THEME"];
  mkdirSync(out as string, { recursive: true });
  for (const id of templateIds().filter((i) => !only || i === only)) {
    writeFileSync(join(out as string, `${id}.rich.html`), renderTheme(id, RICH_FACTS, custom));
    writeFileSync(join(out as string, `${id}.sparse.html`), renderTheme(id, SPARSE_FACTS, custom));
  }
});
